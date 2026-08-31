import { expect, test, request, type APIRequestContext, type Page } from "@playwright/test";

const isolated = process.env.E2E_ISOLATED === "true";
const apiBase = process.env.E2E_API_BASE ?? "";
const password = process.env.E2E_PASSWORD ?? "";
const workerId = 120001;
const approverId = 120002;
let worker: APIRequestContext, approver: APIRequestContext, admin: APIRequestContext;
let delegate: APIRequestContext, outsider: APIRequestContext;

async function loginApi(loginId: string) {
  const anonymous = await request.newContext({ baseURL: apiBase });
  const response = await anonymous.post("/api/v1/auth/login", { data: { loginId, password } });
  expect(response.status(), "fixture login must succeed only on the isolated server").toBe(200);
  const payload = await response.json();
  await anonymous.dispose();
  return request.newContext({ baseURL: apiBase, extraHTTPHeaders: { Authorization: "Bearer " + payload.data.accessToken } });
}
async function api(context: APIRequestContext, path: string, data?: unknown) {
  const response = data === undefined ? await context.get("/api/v1" + path)
    : await context.post("/api/v1" + path, { data });
  const body = await response.json();
  expect(response.ok(), path + ": " + body.code + " " + (body.message ?? "")).toBeTruthy();
  return body.data;
}
function form(templateCode: string, fields: Record<string, unknown>, draft = false) {
  return { title: "격리 실사용 검증 " + templateCode, templateCode, content: "격리 검증",
    formDataJson: JSON.stringify({ fields }), priority: "NORMAL", agreementEmpIds: [],
    approverEmpIds: [approverId], receiverEmpIds: [120005], referenceEmpIds: [], readerEmpIds: [], draft };
}
function leave(date: string, type = "연차", sourceApprovalId?: number) {
  return form(sourceApprovalId ? "LEAVE_CANCEL" : "LEAVE", {
    leaveSelectionsJson: JSON.stringify([{ date, type, ...(sourceApprovalId ? { sourceApprovalId } : {}) }]),
    reason: "격리 검증", content: "격리 검증", startDate: date, endDate: date, leaveType: type
  });
}
function work(date: string, startTime = "08:00", endTime = "12:00", compTime = true, empId = workerId, workType = "SPECIAL") {
  return { empId, workDate: date, startTime, endTime, compTime, workType, workContent: "격리 근무 검증" };
}
async function approve(id: number) {
  const approved = await api(approver, "/approvals/" + id + "/approve", { comment: "검증 승인" });
  expect(approved.status).toBe("APPROVED");
  return approved;
}
async function loginPage(page: Page, loginId = "qa.worker") {
  await page.goto("/");
  await page.getByLabel("아이디", { exact: true }).fill(loginId);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
}
async function editor(page: Page, templateCode: string) {
  await page.goto("/portal/employee/approvals");
  await page.getByRole("button", { name: "작성", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "양식 선택" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: templateCode.startsWith("LEAVE") ? /2\. 휴가, 출장/ : /3\. 근무/ }).click();
  await picker.getByRole("button", { name: new RegExp("\\b" + templateCode + "\\b") }).click();
  await picker.getByRole("button", { name: "확인", exact: true }).click();
}

test.describe("휴가·근무신청 실사용 통합 검증", () => {
  test.skip(!isolated, "Requires an isolated PostgreSQL fixture; never runs against business data.");
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    expect(apiBase).toMatch(/^http:\/\/127\.0\.0\.1:8081$/);
    expect(password).not.toBe("");
    [worker, approver, admin, delegate, outsider] = await Promise.all([
      loginApi("qa.worker"), loginApi("qa.approver"), loginApi("qa.admin"),
      loginApi("qa.delegate"), loginApi("qa.outsider")
    ]);
  });
  test.afterAll(async () => {
    await Promise.all([worker, approver, admin, delegate, outsider].filter(Boolean).map(context => context.dispose()));
  });

  test("연차 신청·승인·수신·취소가 잔액 및 권한과 일치한다", async () => {
    const before = await api(worker, "/approvals/leave-usage/me?year=2026");
    const document = await api(worker, "/approvals", leave("2026-09-01"));
    expect(document.status).toBe("IN_PROGRESS");
    let usage = await api(worker, "/approvals/leave-usage/me?year=2026");
    expect(Number(usage.reservedAnnualDays)).toBe(Number(before.reservedAnnualDays) + 1);
    expect((await outsider.get("/api/v1/approvals/" + document.approvalId)).status()).toBe(403);
    expect((await worker.post("/api/v1/approvals/" + document.approvalId + "/approve", { data: {} })).status()).toBe(403);
    await approve(document.approvalId);
    await api(admin, "/approvals/" + document.approvalId + "/receive", {});
    await api(admin, "/approvals/" + document.approvalId + "/complete-receipt", {});
    usage = await api(worker, "/approvals/leave-usage/me?year=2026");
    expect(Number(usage.usedAnnualDays)).toBe(Number(before.usedAnnualDays) + 1);
    expect(Number(usage.reservedAnnualDays)).toBe(Number(before.reservedAnnualDays));
    const cancel = await api(worker, "/approvals", leave("2026-09-01", "연차", document.approvalId));
    await approve(cancel.approvalId);
    usage = await api(worker, "/approvals/leave-usage/me?year=2026");
    expect(Number(usage.usedAnnualDays)).toBe(Number(before.usedAnnualDays));
    const pdf = await worker.get("/api/v1/approvals/" + document.approvalId + "/pdf");
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("회수·반려 시 연차 예약을 풀고 오전·오후반차는 별도로 복원한다", async () => {
    const before = await api(worker, "/approvals/leave-usage/me?year=2026");
    for (const action of ["withdraw", "reject"]) {
      const doc = await api(worker, "/approvals", leave("2026-09-02"));
      await api(action === "withdraw" ? worker : approver, "/approvals/" + doc.approvalId + "/" + action, { comment: "검증 " + action });
      const usage = await api(worker, "/approvals/leave-usage/me?year=2026");
      expect(Number(usage.reservedAnnualDays)).toBe(Number(before.reservedAnnualDays));
    }
    const morning = await api(worker, "/approvals", leave("2026-09-04", "오전반차"));
    await approve(morning.approvalId);
    const afternoon = await api(worker, "/approvals", leave("2026-09-04", "오후반차"));
    await approve(afternoon.approvalId);
    const cancel = await api(worker, "/approvals", leave("2026-09-04", "오전반차", morning.approvalId));
    await approve(cancel.approvalId);
    const usage = await api(worker, "/approvals/leave-usage/me?year=2026");
    expect(Number(usage.usedAnnualDays)).toBe(Number(before.usedAnnualDays) + 0.5);
  });

  test("4시간 제한·자동 적립·중복 방지·대체휴무 사용 및 취소가 연결된다", async () => {
    const short = await worker.post("/api/v1/approvals", { data: form("WORK_REQUEST", {
      workEntriesJson: JSON.stringify([work("2026-08-29", "08:00", "11:59")]) }) });
    expect(short.status()).toBe(400);
    expect((await short.json()).code).toBe("COMP_TIME_MINIMUM_NOT_MET");
    const doc = await api(worker, "/approvals", form("WORK_REQUEST", { workEntriesJson: JSON.stringify([work("2026-08-29")]) }));
    await approve(doc.approvalId);
    let summary = await api(worker, "/comp-time/me");
    expect(Number(summary.availableDays)).toBe(1);
    expect(summary.credits).toHaveLength(1);
    const repeated = await api(worker, "/approvals", form("WORK_REQUEST", { workEntriesJson: JSON.stringify([work("2026-08-29", "14:00", "18:00")]) }));
    await approve(repeated.approvalId);
    expect((await api(worker, "/comp-time/me")).credits).toHaveLength(1);
    const used = await api(worker, "/approvals", leave("2026-09-03", "대체휴무"));
    summary = await api(worker, "/comp-time/me");
    expect(Number(summary.reservedDays)).toBe(1);
    await approve(used.approvalId);
    expect(Number((await api(worker, "/comp-time/me")).availableDays)).toBe(0);
    const cancel = await api(worker, "/approvals", leave("2026-09-03", "대체휴무", used.approvalId));
    await approve(cancel.approvalId);
    expect(Number((await api(worker, "/comp-time/me")).availableDays)).toBe(1);
    expect((await outsider.get("/api/v1/comp-time/manage?empId=" + workerId)).status()).toBe(403);
  });

  test("근무 변경·회수·반려·취소가 원 일정 상태를 보존한다", async () => {
    const doc = await api(worker, "/approvals", form("WORK_REQUEST", { workEntriesJson: JSON.stringify([work("2026-09-05")]) }));
    await approve(doc.approvalId);
    const schedules = () => api(worker, "/work-schedules/me?from=2026-09-05&to=2026-09-05");
    let source = (await schedules()).find((item: any) => item.approvalId === doc.approvalId);
    expect(source.status).toBe("PLANNED");
    const changeRow = { sourceWorkEntryId: source.workEntryId, actionType: "CHANGE", newWorkDate: "2026-09-05",
      newStartTime: "08:00", newEndTime: "13:00", newWorkContent: "변경 검증", newCompTime: true, reason: "변경 검증" };
    const change = await api(worker, "/approvals", form("WORK_REQUEST_CHANGE", { workChangesJson: JSON.stringify([changeRow]) }));
    expect((await schedules()).find((item: any) => item.workEntryId === source.workEntryId).status).toBe("CANCEL_PENDING");
    await approve(change.approvalId);
    expect((await schedules()).find((item: any) => item.workEntryId === source.workEntryId).status).toBe("CANCELED");
    source = (await schedules()).find((item: any) => item.approvalId === change.approvalId);
    expect(source.workMinutes).toBe(300);
    for (const action of ["withdraw", "reject", "approve"]) {
      const cancel = await api(worker, "/approvals", form("WORK_REQUEST_CHANGE", {
        workChangesJson: JSON.stringify([{ sourceWorkEntryId: source.workEntryId, actionType: "CANCEL", reason: "취소 검증" }]) }));
      if (action === "approve") await approve(cancel.approvalId);
      else await api(action === "withdraw" ? worker : approver, "/approvals/" + cancel.approvalId + "/" + action, { comment: "검증" });
      expect((await schedules()).find((item: any) => item.workEntryId === source.workEntryId).status)
        .toBe(action === "approve" ? "CANCELED" : "PLANNED");
    }
  });

  test("대리신청은 같은 부서만 허용하고 관리자 전용 API를 보호한다", async () => {
    const candidates = await api(delegate, "/work-schedules/candidates");
    expect(candidates.some((item: any) => item.empId === workerId)).toBeTruthy();
    expect(candidates.some((item: any) => item.empId === 120004)).toBeFalsy();
    const crossDepartment = await delegate.post("/api/v1/approvals", { data: form("WORK_REQUEST", {
      workEntriesJson: JSON.stringify([work("2026-09-12", "20:00", "00:00", true, 120004, "SPECIAL_NIGHT")]) }) });
    expect(crossDepartment.status()).toBe(403);
    const valid = await api(delegate, "/approvals", form("WORK_REQUEST", {
      workEntriesJson: JSON.stringify([work("2026-09-12", "20:00", "00:00", true, workerId, "SPECIAL_NIGHT_OVERTIME")]) }));
    await approve(valid.approvalId);
    expect((await worker.get("/api/v1/annual-leaves?year=2026")).status()).toBe(403);
    const manual = await admin.post("/api/v1/comp-time/credits", { data: { empId: workerId, grantedDays: 1 } });
    expect([404, 405]).toContain(manual.status());
  });

  test("실제 화면에서 휴가계·근무신청서를 열고 4시간 미만을 차단한다", async ({ page }, testInfo) => {
    await loginPage(page);
    await editor(page, "LEAVE");
    await expect(page.getByRole("heading", { name: "휴가 신청", exact: true })).toBeVisible();
    const calendarToolbar = page.locator(".leave-calendar-toolbar");
    for (let attempts = 0; !(await calendarToolbar.innerText()).includes("2026년 9월") && attempts < 12; attempts++) {
      await calendarToolbar.getByRole("button", { name: "다음", exact: true }).click();
    }
    const dateCell = page.locator("button.leave-calendar-day:not(.outside)").filter({ hasText: /^7$/ });
    await dateCell.click();
    await page.locator(".leave-calendar-type-select").selectOption("오전반차");
    await expect(page.locator(".leave-selection-summary")).toContainText("일반 연차 차감 0.5일");
    await page.screenshot({ path: testInfo.outputPath("leave-editor.png"), fullPage: true });
    const leaveSaved = page.waitForResponse(response => response.url().endsWith("/api/v1/approvals/drafts") && response.request().method() === "POST");
    await page.getByRole("button", { name: "임시저장", exact: true }).click();
    const leaveResponse = await leaveSaved;
    expect(leaveResponse.ok()).toBeTruthy();
    const leaveDraft = (await leaveResponse.json()).data;
    expect(leaveDraft.status).toBe("DRAFT");
    expect(JSON.parse(JSON.parse(leaveDraft.formDataJson).fields.leaveSelectionsJson)[0])
      .toMatchObject({ date: "2026-09-07", type: "오전반차", days: 0.5 });
    await editor(page, "WORK_REQUEST");
    await expect(page.getByRole("heading", { name: "근무자별 신청 내역", exact: true })).toBeVisible();
    await page.getByLabel("근무일자", { exact: true }).fill("2026-09-19");
    await page.getByRole("checkbox", { name: "특근", exact: true }).check();
    await page.getByLabel("근무내용", { exact: true }).fill("화면 입력과 저장 검증");
    await page.getByLabel("시작", { exact: true }).fill("08:30");
    const compTime = page.locator(".work-form-comp-time input[type=checkbox]");
    await page.getByLabel("종료", { exact: true }).fill("12:29");
    await expect(compTime).toBeDisabled();
    await page.getByLabel("종료", { exact: true }).fill("12:30");
    await expect(compTime).toBeEnabled();
    await compTime.check();
    await page.getByLabel("종료", { exact: true }).fill("12:00");
    await expect(compTime).toBeDisabled();
    await expect(compTime).not.toBeChecked();
    await page.getByLabel("종료", { exact: true }).fill("12:30");
    await compTime.check();
    await page.screenshot({ path: testInfo.outputPath("work-editor.png"), fullPage: true });
    const savedResponse = page.waitForResponse(response => response.url().endsWith("/api/v1/approvals/drafts") && response.request().method() === "POST");
    await page.getByRole("button", { name: "임시저장", exact: true }).click();
    const response = await savedResponse;
    expect(response.ok()).toBeTruthy();
    const saved = (await response.json()).data;
    expect(saved.status).toBe("DRAFT");
    const persisted = await api(worker, "/approvals/" + saved.approvalId);
    const rows = JSON.parse(JSON.parse(persisted.formDataJson).fields.workEntriesJson);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ empId: workerId, workDate: "2026-09-19", startTime: "08:30", endTime: "12:30", compTime: true });
  });

  test("관리자 연차 조정은 즉시 반영되고 일반 직원의 수정은 차단된다", async () => {
    const data = { empId: workerId, leaveYear: 2026, finalDays: 24, reason: "격리 검증 연차 조정" };
    expect((await worker.put("/api/v1/annual-leaves", { data })).status()).toBe(403);
    const updated = await admin.put("/api/v1/annual-leaves", { data });
    expect(updated.ok()).toBeTruthy();
    expect(Number((await updated.json()).data.finalDays)).toBe(24);
    expect(Number((await api(worker, "/approvals/leave-usage/me?year=2026")).totalAnnualDays)).toBe(24);
  });

  test("같은 직원·날짜의 동시 승인은 한 번만 대체휴무를 적립한다", async () => {
    const docs = await Promise.all(["08:00", "14:00"].map((start, index) => api(worker, "/approvals",
      form("WORK_REQUEST", { workEntriesJson: JSON.stringify([work("2026-08-22", start, index ? "18:00" : "12:00")]) }))));
    await Promise.all(docs.map(doc => approve(doc.approvalId)));
    const credits = (await api(worker, "/comp-time/me")).credits.filter((credit: any) => credit.workDate === "2026-08-22");
    expect(credits).toHaveLength(1);
    expect(Number(credits[0].grantedDays)).toBe(1);
  });

  test("만료 안내는 12월에만 표시한다", async ({ page }) => {
    await loginPage(page);
    const summary = await api(worker, "/comp-time/me");
    await page.route("**/api/v1/comp-time/me", route => route.fulfill({
      json: { success: true, code: "OK", data: { ...summary, availableDays: 1, reservedDays: 0,
        credits: [{ creditId: 990001, workDate: "2026-08-29", status: "ACTIVE", expiresOn: "2026-12-31", availableDays: 1, grantedDays: 1 }] } }
    }));
    await page.clock.setFixedTime(new Date("2026-11-30T09:00:00+09:00"));
    await editor(page, "LEAVE");
    await expect(page.locator(".leave-comp-time-summary")).not.toContainText("만료");
    await page.clock.setFixedTime(new Date("2026-12-01T09:00:00+09:00"));
    await editor(page, "LEAVE");
    await expect(page.locator(".leave-comp-time-summary")).toContainText("2026년 12월 31일 만료");
  });

  test("종료 시각이 지나면 실제 예약 작업이 근무를 자동 완료한다", async () => {
    test.setTimeout(150_000);
    const end = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 120_000);
    const start = new Date(end.getTime() - 2 * 60 * 60_000);
    const kst = (value: Date) => new Date(value.getTime() + 9 * 60 * 60_000).toISOString();
    const workDate = kst(start).slice(0, 10), endDate = kst(end).slice(0, 10);
    const doc = await api(worker, "/approvals", form("WORK_REQUEST", {
      workEntriesJson: JSON.stringify([work(workDate, kst(start).slice(11, 16), kst(end).slice(11, 16), false, workerId, "OVERTIME")]) }));
    await approve(doc.approvalId);
    const status = async () => (await api(worker, "/work-schedules/me?from=" + workDate + "&to=" + endDate))
      .find((item: any) => item.approvalId === doc.approvalId)?.status;
    expect(await status()).toBe("PLANNED");
    await expect.poll(status, { timeout: 125_000, intervals: [1000, 3000, 5000] }).toBe("COMPLETED");
  });

});
