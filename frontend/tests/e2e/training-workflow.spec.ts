import { test, expect, request, type APIRequestContext, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
const apiBase = process.env.E2E_API_BASE ?? "";
const password = process.env.E2E_PASSWORD ?? "";
let worker: APIRequestContext, approver: APIRequestContext, receiver: APIRequestContext, host: APIRequestContext, outsider: APIRequestContext;
async function login(loginId: string) {
  const context = await request.newContext({ baseURL: apiBase });
  const response = await context.post("/api/v1/auth/login", { data: { loginId, password } });
  expect(response.ok()).toBeTruthy(); const token = (await response.json()).data.accessToken; await context.dispose();
  return request.newContext({ baseURL: apiBase, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}
async function api(context: APIRequestContext, path: string, data?: unknown) {
  const response = data === undefined ? await context.get("/api/v1" + path) : await context.post("/api/v1" + path, { data });
  const body = await response.json(); expect(response.ok(), path + ": " + (body.message || JSON.stringify(body))).toBeTruthy(); return body.data;
}
function date(offset: number) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); }
function fields(name: string) { return { trainingName: name, institution: "격리 교육기관", trainingStartDate: date(-3), trainingEndDate: date(-1), reason: "격리 업무 검증" }; }
function form(code: string, values: Record<string, unknown>, draft = false) { return { templateCode: code, title: "격리 교육 검증 " + code, content: "교육 검증", formDataJson: JSON.stringify({ fields: values }), priority: "NORMAL", agreementEmpIds: [], approverEmpIds: [120002], receiverEmpIds: [120005], referenceEmpIds: [], readerEmpIds: [], draft }; }
function link(source: any, current = source.approvalId) { return { sourceTrainingApprovalId: String(source.approvalId), sourceTrainingRevisionId: String(current) }; }
async function approveBoth(doc: any) {
  const handed = await api(approver, `/approvals/${doc.approvalId}/approve`, {}); expect(handed.currentStage).toBe("RECEIVER_PROGRESS"); expect(handed.status).toBe("IN_PROGRESS");
  await api(receiver, `/approvals/${doc.approvalId}/purchase-request/submit-approval`, { agreementEmpIds: [], approverEmpIds: [120003] });
  const final = await api(host, `/approvals/${doc.approvalId}/approve`, {}); expect(final.status).toBe("APPROVED"); return final;
}
async function openEditor(page: Page, code: string) {
  await page.goto("/portal/employee/approvals"); await page.getByRole("button", { name: "작성", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "양식 선택" }); await picker.getByRole("button", { name: /5\. 교육/ }).click();
  await picker.getByRole("button", { name: new RegExp("\\b" + code + "\\b") }).click();
  await picker.getByRole("button", { name: "확인", exact: true }).click();
}
async function pageLogin(page: Page) {
  await page.goto("/"); await page.getByLabel("아이디", { exact: true }).fill("qa.worker"); await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "LOGIN", exact: true }).click(); await expect(page.getByRole("navigation")).toBeVisible();
}
async function saveUiDraft(page: Page) {
  const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/approvals/drafts"));
  await page.getByRole("button", { name: "임시저장", exact: true }).click(); const saved = await response;
  expect(saved.ok(), await saved.text()).toBeTruthy(); return (await saved.json()).data;
}

test.describe("교육 업무 흐름 격리 검증", () => {
  test.skip(process.env.E2E_ISOLATED !== "true", "Never writes to business data; requires isolated fixture.");
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    expect(apiBase).toBe("http://127.0.0.1:8081"); expect(password).not.toBe("");
    [worker, approver, receiver, host, outsider] = await Promise.all([login("qa.worker"), login("qa.approver"), login("qa.admin"), login("qa.delegate"), login("qa.outsider")]);
  });
  test.afterAll(async () => { await Promise.all([worker, approver, receiver, host, outsider].filter(Boolean).map(c => c.dispose())); });

  test("최종 승인 후 캘린더, UI 보고서 작성, 접수 완료 후 이수", async ({ page }) => {
    const source = await api(worker, "/approvals", form("TRAINING_REQUEST", fields("교육 흐름 QA")));
    expect((await api(worker, "/trainings/me")).some((s: any) => s.sourceApprovalId === source.approvalId)).toBeFalsy();
    await approveBoth(source);
    const schedule = (await api(worker, "/trainings/me")).find((s: any) => s.sourceApprovalId === source.approvalId);
    expect(schedule.status).toBe("ENDED"); expect(schedule.reportable).toBeTruthy();
    expect(await api(outsider, "/trainings/me")).toEqual([]);
    await pageLogin(page); await expect(page.locator(".calendar-training-list")).toContainText("교육 흐름 QA");
    await openEditor(page, "TRAINING_REPORT");
    await page.getByLabel("원 교육신청서", { exact: true }).selectOption(String(source.approvalId));
    await page.getByRole("textbox", { name: "문서 제목", exact: true }).fill("교육 결과 QA");
    await page.getByLabel("주요 교육 내용", { exact: true }).fill("실무 교육 내용을 정리했습니다.");
    const draft = await saveUiDraft(page);
    expect(JSON.parse(draft.formDataJson).fields.sourceTrainingApprovalId).toBe(String(source.approvalId));
    const submitted = await api(worker, `/approvals/${draft.approvalId}/submit`, form("TRAINING_REPORT", { ...link(source), mainContent: "실무 교육 결과" }));
    await api(approver, `/approvals/${submitted.approvalId}/approve`, {});
    const secondLine = await receiver.post(`/api/v1/approvals/${submitted.approvalId}/purchase-request/submit-approval`, { data: { approverEmpIds: [120003] } });
    expect(secondLine.status()).toBe(400);
    await api(receiver, `/approvals/${submitted.approvalId}/receive`, {});
    expect((await api(worker, `/approvals/${submitted.approvalId}`)).status).toBe("IN_PROGRESS");
    const complete = await api(receiver, `/approvals/${submitted.approvalId}/complete-receipt`, { comment: "접수 확인" }); expect(complete.status).toBe("APPROVED");
    expect((await api(worker, "/trainings/me")).find((s: any) => s.sourceApprovalId === source.approvalId).status).toBe("COMPLETED");
    const blocked = await worker.post("/api/v1/approvals", { data: form("TRAINING_CHANGE", { ...link(source), changeAction: "CANCEL", changeReason: "차단 확인" }) }); expect(blocked.status()).toBe(400);
    await page.goto("/"); await expect(page.locator(".calendar-training-list")).toContainText("이수 완료");
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("과거 교육 변경·취소와 원본 PDF 보존", async ({ page }) => {
    const source = await api(worker, "/approvals", form("TRAINING_REQUEST", fields("변경취소 QA"))); await approveBoth(source);
    const before = await api(worker, `/approvals/${source.approvalId}`);
    const originalPdf = await worker.get(`/api/v1/approvals/${source.approvalId}/pdf`); expect(originalPdf.ok()).toBeTruthy();
    const hash = createHash("sha256").update(await originalPdf.body()).digest("hex");
    await pageLogin(page); await openEditor(page, "TRAINING_CHANGE");
    await page.getByLabel("원 교육신청서", { exact: true }).selectOption(String(source.approvalId));
    await page.getByRole("textbox", { name: "문서 제목", exact: true }).fill("교육 변경 QA");
    await page.getByRole("textbox", { name: /^교육명/ }).fill("수정된 교육 QA");
    await page.getByRole("textbox", { name: /^사유/ }).fill("일정 및 교육명 정정");
    const draft = await saveUiDraft(page);
    const values = { ...fields("수정된 교육 QA"), ...link(source), changeAction: "CHANGE", changeReason: "교육명 정정" };
    const change = await api(worker, `/approvals/${draft.approvalId}/submit`, form("TRAINING_CHANGE", values));
    expect((await api(worker, "/trainings/me")).find((s: any) => s.sourceApprovalId === source.approvalId).trainingName).toBe("변경취소 QA");
    await approveBoth(change);
    expect((await api(worker, "/trainings/me")).find((s: any) => s.sourceApprovalId === source.approvalId).trainingName).toBe("수정된 교육 QA");
    const cancel = await api(worker, "/approvals", form("TRAINING_CHANGE", { ...link(source, change.approvalId), changeAction: "CANCEL", changeReason: "교육 불참" })); await approveBoth(cancel);
    expect((await api(worker, `/trainings/me?from=${date(-30)}&to=${date(1)}`)).some((s: any) => s.sourceApprovalId === source.approvalId)).toBeFalsy();
    const after = await api(worker, `/approvals/${source.approvalId}`); expect(after.status).toBe("APPROVED"); expect(after.formDataJson).toBe(before.formDataJson);
    const pdf = await worker.get(`/api/v1/approvals/${source.approvalId}/pdf`); expect(createHash("sha256").update(await pdf.body()).digest("hex")).toBe(hash);
  });

  test("동시 보고서 작성과 다른 직원의 원 교육 연결을 차단", async () => {
    const source = await api(worker, "/approvals", form("TRAINING_REQUEST", fields("동시작성 QA"))); await approveBoth(source);
    const attempts = await Promise.all([1, 2].map(() => worker.post("/api/v1/approvals/drafts", { data: form("TRAINING_REPORT", link(source), true) })));
    expect(attempts.map(r => r.status()).sort()).toEqual([200, 400]);
    const denied = await outsider.post("/api/v1/approvals/drafts", { data: form("TRAINING_REPORT", link(source), true) }); expect(denied.status()).toBe(400);
    const reversed = await worker.post("/api/v1/approvals", { data: form("TRAINING_REQUEST", { ...fields("잘못된 기간"), trainingStartDate: date(2), trainingEndDate: date(1) }) }); expect(reversed.status()).toBe(400);
  });
});
