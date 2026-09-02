import "./rich-text-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApprovalFormBody, type ApprovalFormContext } from "../src/pages/ApprovalFormBody";
import { ApprovalTemplatePreview } from "../src/pages/ApprovalTemplatePreview";
import { ApprovalPage } from "../src/pages/ApprovalPage";
import { ApprovalHistorySection, ApprovalReferenceReadStatus } from "../src/pages/ApprovalPurchaseTrainingDetails";
import { EquipmentProposalUserSection } from "../src/pages/ApprovalEquipmentProposalParts";
import { LeaveRequestEditor } from "../src/pages/ApprovalLeaveParts";
import { TemplateSelectModalV2 } from "../src/pages/ApprovalTemplateParts";
import { createApprovalDocumentActions } from "../src/pages/createApprovalDocumentActions";
import { createApprovalForm } from "../src/utils/approvalForm";
import { LEAVE_TYPE_OPTIONS, parseLeaveSelections, todayDate, type ApprovalForm, type ApprovalTemplateOption } from "../src/utils/approvalDomain";
import type { ApprovalLine, Employee, LeaveUsage, User } from "../src/types";

const user: User = { empId: 7, loginId: "preview-test", empName: "테스트 작성자", genderCode: "FEMALE", roleCode: "USER", deptId: 2, deptName: "테스트부서", permissions: [] };
const employee = { ...user, workCategory: "MANAGEMENT", positionName: "대리" } as Employee;
const context: ApprovalFormContext = { user, employees: [employee], leaveUsage: null, compTimeSummary: null, holidays: [], leaveTypeOptions: LEAVE_TYPE_OPTIONS };
const template = (code: string, extra: Partial<ApprovalTemplateOption> = {}): ApprovalTemplateOption => ({ code, name: `${code} 테스트 양식`, description: "양식 설명", version: 4, ...extra });
const requests: string[] = [];

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  requests.length = 0;
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method ?? "GET", "GET", "Preview must never write to the server");
    const url = String(input);
    requests.push(url);
    const data = url.includes("/work-schedules/candidates") ? [employee] : [];
    return Response.json({ success: true, data, message: null });
  });
});
afterEach(() => { cleanup(); mock.restoreAll(); });

test("reference mailbox is reachable separately from receipt and requests shared documents without action filters", async () => {
  let documentStatus = "IN_PROGRESS";
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method ?? "GET", "GET");
    const url = String(input);
    requests.push(url);
    const matches = (url.includes("box=shared") && documentStatus === "IN_PROGRESS")
      || (url.includes("dashboardFilter=completedInvolved") && documentStatus === "APPROVED");
    const content = matches ? [{ approvalId: 42, title: "참조 문서 테스트", templateCode: "DRAFT", templateVersion: 1,
      status: documentStatus, currentStage: documentStatus === "IN_PROGRESS" ? "APPROVAL_PROGRESS" : "COMPLETED", pdfStatus: "NONE", priority: "NORMAL",
      requesterName: "작성자", requestedAt: "2026-09-01T09:00:00", documentNo: "DRAFT-42" }] : [];
    const data = url.includes("/emps?") ? { content: [employee], totalPages: 1 } :
      url.includes("/approvals?") ? { content, totalElements: content.length } :
      url.includes("/approvals/boxes") ? [{ box: "shared", label: "참조문서" }, { box: "received", label: "수신함" }] : [];
    return Response.json({ success: true, data });
  });
  render(<ApprovalPage user={user} portal="employee" launch={null} target={null} />);
  fireEvent.click(screen.getByRole("button", { name: "참조문서", exact: true }));
  await screen.findByText("참조 문서 테스트");
  assert.ok(screen.getByRole("button", { name: "참조문서", exact: true }).classList.contains("active"));
  const sharedRequests = requests.filter((url) => url.includes("box=shared"));
  assert.ok(sharedRequests.length > 0);
  assert.ok(sharedRequests.every((url) => !url.includes("dashboardFilter")));
  documentStatus = "APPROVED";
  fireEvent.click(screen.getByRole("button", { name: "새로고침", exact: true }));
  await waitFor(() => assert.equal(screen.queryByText("참조 문서 테스트") === null, true));
  fireEvent.click(screen.getByRole("button", { name: "결재 완료문서", exact: true }));
  await screen.findByText("참조 문서 테스트");
  fireEvent.change(screen.getByRole("combobox", { name: "내 역할" }), { target: { value: "SHARED" } });
  await waitFor(() => assert.ok(requests.some((url) => url.includes("dashboardFilter=completedInvolved") && url.includes("role=SHARED"))));
  assert.ok(screen.getByText("참조 문서 테스트"));
  fireEvent.click(screen.getByRole("button", { name: "전자결재", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "수신함", exact: true }));
  await waitFor(() => assert.equal(screen.queryByText("참조 문서 테스트") === null, true));
  assert.ok(requests.some((url) => url.includes("box=received")));
  assert.ok(screen.getByRole("button", { name: "수신함", exact: true }).classList.contains("active"));
});

test("reference history distinguishes an opened share from an actual read", () => {
  const referenceLine = { lineId: 1, lineType: "REFERENCE", lineOrder: 1, approverName: "참조 직원", status: "READ", readAt: null } as ApprovalLine;
  const view = render(<ApprovalHistorySection lines={[referenceLine]} />);
  assert.ok(screen.getByText("미열람 · 상신 이후 열람 가능"));
  view.rerender(<ApprovalHistorySection lines={[{ ...referenceLine, readAt: "2026-09-02T09:30:00" }]} />);
  assert.equal(screen.queryByText("미열람 · 상신 이후 열람 가능"), null);
  assert.ok(screen.getByText(/^읽음 · /));
});

test("common reference read panel stays separate from the document body", () => {
  const line = { lineId: 1, lineType: "REFERENCE", approverName: "참조 직원", status: "READ", readAt: null } as ApprovalLine;
  const view = render(<ApprovalReferenceReadStatus lines={[line]} />);
  assert.ok(screen.getByText("참조 열람 현황"));
  assert.ok(screen.getByText("미열람"));
  assert.equal(view.container.querySelector("details")?.open, false);
  view.rerender(<ApprovalReferenceReadStatus lines={[{ ...line, readAt: "2026-09-02T09:30:00" }]} />);
  assert.ok(screen.getByText(/^읽음 · /));
  view.rerender(<ApprovalReferenceReadStatus lines={[]} />);
  assert.equal(view.container.childElementCount, 0);
});

const calendarUsage: LeaveUsage = { usedAnnualDays: "0", reservedAnnualDays: "0", totalAnnualDays: "15", remainingAnnualDays: "15", selections: [], occupiedSelections: [], exclusions: [], balanceYear: 2026, pendingCancelSelections: [] };
function renderLeaveCalendar(extra: Partial<ApprovalFormContext> = {}, mode: "request" | "cancel" = "request") {
  let latest = createApprovalForm(template(mode === "request" ? "LEAVE" : "LEAVE_CANCEL"), user, [employee], null);
  function Editor() {
    const [form, setForm] = useState(latest);
    return <LeaveRequestEditor {...context} leaveUsage={calendarUsage} {...extra} mode={mode} form={form} onChange={(next) => { latest = next; setForm(next); }} />;
  }
  const view = render(<Editor />);
  function september() {
    const [year, month] = view.container.querySelector(".leave-calendar-toolbar strong")!.textContent!.match(/\d+/g)!.map(Number);
    const delta = (2026 - year) * 12 + 9 - month;
    for (let i = 0; i < Math.abs(delta); i++) fireEvent.click(screen.getByRole("button", { name: delta > 0 ? "다음" : "이전", exact: true }));
  }
  september();
  function day(dayNumber: number) {
    const cell = [...view.container.querySelectorAll<HTMLElement>(".leave-calendar-day:not(.outside)")].find((item) => item.querySelector(":scope > span")?.textContent === String(dayNumber));
    assert.ok(cell, `Calendar day ${dayNumber} exists`);
    return cell;
  }
  return { ...view, day, september, freshDocument: () => {
    latest = createApprovalForm(template("LEAVE"), user, [employee], null);
    view.rerender(<Editor key="new-document" />);
    september();
  }, selections: () => parseLeaveSelections(latest.fieldValues), values: () => latest.fieldValues };
}

test("leave calendar carries afternoon half-day to the next date and recalculates totals", () => {
  const calendar = renderLeaveCalendar();
  fireEvent.click(calendar.day(1));
  fireEvent.change(calendar.day(1).querySelector("select")!, { target: { value: "오후반차" } });
  fireEvent.click(calendar.day(2));
  assert.deepEqual(calendar.selections(), [{ date: "2026-09-01", type: "오후반차", days: 0.5 }, { date: "2026-09-02", type: "오후반차", days: 0.5 }]);
  assert.equal(calendar.values().days, "1");
  assert.equal(calendar.values().annualLeaveDays, "1");
  assert.equal(calendar.day(2).querySelector<HTMLSelectElement>("select")?.value, "오후반차");
});

test("leave defaults follow the last edit, not chronological order, across months and removals", () => {
  const calendar = renderLeaveCalendar();
  fireEvent.click(calendar.day(10));
  fireEvent.change(calendar.day(10).querySelector("select")!, { target: { value: "오후반차" } });
  fireEvent.click(calendar.day(1));
  fireEvent.change(calendar.day(1).querySelector("select")!, { target: { value: "오전반차" } });
  fireEvent.click(calendar.day(2));
  assert.equal(calendar.day(2).querySelector<HTMLSelectElement>("select")?.value, "오전반차");
  fireEvent.click(calendar.day(1));
  fireEvent.click(screen.getByRole("button", { name: "다음", exact: true }));
  fireEvent.click(calendar.day(1));
  assert.ok(calendar.selections().some((item) => item.date === "2026-10-01" && item.type === "오전반차"));
  assert.ok(calendar.selections().some((item) => item.date === "2026-09-10" && item.type === "오후반차"));
});

test("leave carry-forward respects occupied half-days and full days", () => {
  const locked = (date: string, type: string, days: string) => ({ date, type, days, approvalId: 99, documentNo: "LEAVE-99" });
  const calendar = renderLeaveCalendar({ leaveUsage: { ...calendarUsage, occupiedSelections: [locked("2026-09-02", "오후반차", "0.5"), locked("2026-09-03", "연차", "1")] } });
  fireEvent.click(calendar.day(1));
  fireEvent.change(calendar.day(1).querySelector("select")!, { target: { value: "오후반차" } });
  fireEvent.click(calendar.day(2));
  assert.equal(calendar.day(2).querySelector<HTMLSelectElement>("select")?.value, "오전반차");
  assert.ok((calendar.day(3) as HTMLButtonElement).disabled);
  fireEvent.click(calendar.day(3));
  assert.equal(calendar.selections().length, 2);
  fireEvent.click(calendar.day(4));
  assert.equal(calendar.day(4).querySelector<HTMLSelectElement>("select")?.value, "오전반차");
});

test("leave carry-forward cannot spend unavailable compensatory leave", () => {
  const calendar = renderLeaveCalendar({ compTimeSummary: { empId: user.empId, empName: user.empName, availableDays: 2, reservedDays: 0, credits: [] } });
  fireEvent.click(calendar.day(1));
  fireEvent.change(calendar.day(1).querySelector("select")!, { target: { value: "대체휴무" } });
  fireEvent.click(calendar.day(2));
  assert.equal(calendar.day(2).querySelector<HTMLSelectElement>("select")?.value, "대체휴무");
  fireEvent.click(calendar.day(3));
  assert.equal(calendar.day(3).querySelector<HTMLSelectElement>("select")?.value, "연차");
  assert.equal(calendar.selections().filter((item) => item.type === "대체휴무").length, 2);
});

test("leave preference survives removing all dates but stays scoped to one document", () => {
  const calendar = renderLeaveCalendar();
  fireEvent.click(calendar.day(1));
  fireEvent.change(calendar.day(1).querySelector("select")!, { target: { value: "오후반차" } });
  fireEvent.click(calendar.day(1));
  fireEvent.click(calendar.day(2));
  assert.equal(calendar.day(2).querySelector<HTMLSelectElement>("select")?.value, "오후반차");
  calendar.freshDocument();
  fireEvent.click(calendar.day(1));
  assert.equal(calendar.day(1).querySelector<HTMLSelectElement>("select")?.value, "연차");
});

test("leave defaults never select a type outside the available catalog", () => {
  const calendar = renderLeaveCalendar({ leaveTypeOptions: ["무급휴가", "오후반차"] });
  fireEvent.click(calendar.day(1));
  fireEvent.click(calendar.day(2));
  assert.deepEqual(calendar.selections().map((item) => item.type), ["오후반차", "오후반차"]);
});

test("leave cancellation retains each source leave type instead of copying the previous type", () => {
  const calendar = renderLeaveCalendar({ leaveUsage: { ...calendarUsage, selections: [
    { date: "2026-09-01", type: "오후반차", days: "0.5", approvalId: 91, documentNo: "LEAVE-91" },
    { date: "2026-09-02", type: "연차", days: "1", approvalId: 92, documentNo: "LEAVE-92" }
  ] } }, "cancel");
  fireEvent.click(calendar.day(1).querySelector("button")!);
  fireEvent.click(calendar.day(2).querySelector("button")!);
  assert.deepEqual(calendar.selections().map(({ type, sourceApprovalId }) => ({ type, sourceApprovalId })), [{ type: "오후반차", sourceApprovalId: 91 }, { type: "연차", sourceApprovalId: 92 }]);
});

const routes = [
  ["DRAFT", ".classic-draft-editor"],
  ["EQUIPMENT_PROPOSAL", ".equipment-proposal-editor"],
  ["MOLD_FIXTURE_PROPOSAL", ".equipment-proposal-editor"],
  ["LEAVE", ".leave-request-editor"], ["LEAVE_CANCEL", ".leave-request-editor"],
  ["WORK_REQUEST", ".work-request-form.request"],
  ["WORK_REQUEST_CHANGE", ".work-request-form.change"],
  ["EMERGENCY_CALL_REQUEST", ".work-request-form.emergency"],
  ["PURCHASE", ".purchase-request-form"],
  ["TRAINING_REQUEST", ".training-editor.request"],
  ["TRAINING_CHANGE", ".training-editor.change"],
  ["TRAINING_REPORT", ".training-editor.report"],
  ["MONTHLY_MAINTENANCE", ".template-field-grid"],
  ["ANNUAL_MAINTENANCE", ".template-field-grid"],
  ["EQUIPMENT_REPAIR", ".template-field-grid"],
  ["CUSTOM_NEW_FORM", ".template-field-grid"]
];

for (const [code, selector] of routes) {
  test(`${code}: preview uses the current composing form, with disabled controls`, async () => {
    const option = template(code, { fieldsJson: JSON.stringify([{ name: "currentField", label: "최신 항목" }]) });
    const view = render(<ApprovalTemplatePreview template={option} context={context} />);
    await act(async () => {});
    assert.ok(view.container.querySelector(selector), `${code} uses its real editor`);
    assert.equal(view.container.querySelector(".template-paper, .template-mini-stamp, .template-work-preview, .template-leave-web-preview"), null);
    assert.ok(view.container.querySelector("fieldset.approval-form-readonly[disabled]"));
    for (const input of view.container.querySelectorAll("input, textarea, select, button")) assert.ok(input.matches(":disabled"));
    assert.equal(view.container.querySelector('[contenteditable="true"]'), null);
    assert.equal(view.container.querySelector('[role="dialog"]'), null);
  });
}

test("catalog refresh updates the selected version, name, description, fields and options without reselecting", async () => {
  const old = template("CUSTOM_NEW_FORM", { name: "이전 양식", version: 1, fieldsJson: '[{"name":"old","label":"이전 항목"}]' });
  const latest = { ...old, name: "수정 양식", description: "수정된 설명", version: 5, fieldsJson: '[{"name":"new","label":"새 항목","type":"select","options":["새 선택지"]}]' };
  const props = { selected: old, fallbackActive: false, context, onSelect: () => {}, onCancel: () => {}, onConfirm: () => {} };
  const view = render(<TemplateSelectModalV2 {...props} templates={[old]} />);
  assert.ok(screen.getByLabelText("이전 항목"));
  view.rerender(<TemplateSelectModalV2 {...props} templates={[latest]} />);
  assert.equal(screen.queryByLabelText("이전 항목"), null);
  const field = screen.getByLabelText("새 항목") as HTMLSelectElement;
  assert.ok([...field.options].some((item) => item.text === "새 선택지"));
  assert.match(view.container.querySelector(".template-preview-note")?.textContent ?? "", /수정 양식 · v5/);
  assert.match(view.container.querySelector(".template-description-box")?.textContent ?? "", /수정된 설명/);
  assert.equal((screen.getByLabelText("문서 제목") as HTMLInputElement).value, "수정 양식");
});

test("draft preview preserves current rich-text size, alignment and table after the draft changes", async () => {
  const option = template("DRAFT");
  const initial = createApprovalForm(option, user, [employee], null);
  const onChange = mock.fn();
  const props = { ...context, template: option, templates: [option], onChange, readOnly: true };
  const view = render(<ApprovalFormBody {...props} form={{ ...initial, content: "이전 본문" }} />);
  const next = { ...initial, title: "현재 제목", content: '<p style="text-align:center"><strong><span style="font-size:24px">서식 본문</span></strong></p><table><tbody><tr><td><p>표 내용</p></td></tr></tbody></table>' };
  view.rerender(<ApprovalFormBody {...props} form={next} />);
  await waitFor(() => assert.equal(view.container.querySelector<HTMLElement>(".rich-text-content span")?.style.fontSize, "24px"));
  assert.equal(view.container.querySelector<HTMLElement>(".rich-text-content p")?.style.textAlign, "center");
  assert.match(view.container.querySelector(".rich-text-content table")?.textContent ?? "", /표 내용/);
  fireEvent.change(screen.getByPlaceholderText("기안 제목을 입력하세요."), { target: { value: "바뀌면 안 됨" } });
  assert.equal(onChange.mock.callCount(), 0);
  assert.equal(view.container.querySelector('[role="toolbar"]'), null);
  assert.equal(requests.length, 0);
});

test("leave preview uses the actual current calendar, not the old August 2026 mock", () => {
  const view = render(<ApprovalTemplatePreview template={template("LEAVE")} context={context} />);
  const now = new Date();
  assert.equal(view.container.querySelector(".leave-calendar-toolbar strong")?.textContent, `${now.getFullYear()}년 ${now.getMonth() + 1}월`);
  assert.ok(view.container.querySelector(".leave-calendar-grid"));
});

test("work preview uses employee work category and never launches the delegate worker picker or changes the draft", async () => {
  const option = template("WORK_REQUEST");
  const form = createApprovalForm(option, user, [employee], null);
  const onChange = mock.fn();
  const view = render(<ApprovalFormBody {...context} form={form} template={option} templates={[option]} onChange={onChange} readOnly />);
  await waitFor(() => assert.ok(!screen.queryByRole("checkbox", { name: "잔업" })));
  assert.equal((screen.getByRole("checkbox", { name: "특근" }) as HTMLInputElement).checked, true);
  const delegated = { ...user, permissions: ["WORK_REQUEST_DELEGATE"] };
  view.rerender(<ApprovalFormBody {...context} user={delegated} form={form} template={option} templates={[option]} onChange={onChange} readOnly />);
  await act(async () => {});
  assert.equal(view.container.querySelector(".modal-backdrop"), null);
  assert.equal(onChange.mock.callCount(), 0);
});

test("opening template selection reloads the catalog instead of retaining the old version", async () => {
  const latest = template("DRAFT", { version: 9 });
  const setPreviewTemplate = mock.fn();
  const setTemplateModalOpen = mock.fn();
  const loadActiveTemplates = mock.fn(async () => [latest]);
  const noop = () => {};
  const loadLeaveUsage = mock.fn(async () => null);
  const loadCompTimeSummary = mock.fn(async () => null);
  const controller = { visibleTemplates: [template("DRAFT", { version: 1 })], loadActiveTemplates, loadLeaveUsage, loadCompTimeSummary, setPreviewTemplate, setTemplateModalOpen, setApprovalError: noop, setDashboardFilter: noop, setSelected: noop, setPendingFiles: noop };
  const actions = createApprovalDocumentActions(user, controller as unknown as Parameters<typeof createApprovalDocumentActions>[1]);
  await actions.startCreate();
  assert.equal(loadActiveTemplates.mock.callCount(), 1);
  assert.equal(loadLeaveUsage.mock.callCount(), 1);
  assert.equal(loadCompTimeSummary.mock.callCount(), 1);
  assert.equal(setPreviewTemplate.mock.calls[0].arguments[0], latest);
  assert.equal(setTemplateModalOpen.mock.calls[0].arguments[0], true);
});

test("creation and preview share versioned defaults, with no changes to source/workflow fields", () => {
  const option = template("TRAINING_REPORT", { version: 8 });
  const setForm = mock.fn();
  const noop = () => {};
  const controller = { templates: [option], previewTemplate: { ...option, version: 1 }, employees: [employee], leaveUsage: null, setForm, setLeavePreviewOpen: noop, setDefaultLineMessage: noop, setTemplateModalOpen: noop, setMode: noop, applyDefaultLine: noop };
  const actions = createApprovalDocumentActions(user, controller as unknown as Parameters<typeof createApprovalDocumentActions>[1]);
  actions.confirmTemplate();
  const actual = setForm.mock.calls[0].arguments[0] as ApprovalForm;
  assert.deepEqual(actual, createApprovalForm(option, user, [employee], null));
  assert.equal(actual.templateVersion, 8);
  assert.equal(actual.fieldValues.educationWorkflowVersion, undefined, "Workflow version remains server-owned");
  assert.equal(actual.fieldValues.reportDate, todayDate());
});

test("template dialog maximizes and restores native resized dimensions without losing selection or search", () => {
  const selected = template("CUSTOM_NEW_FORM", { name: "크기 조절 테스트" });
  const onSelect = mock.fn();
  const onConfirm = mock.fn();
  const onCancel = mock.fn();
  render(<TemplateSelectModalV2 templates={[selected]} selected={selected} fallbackActive={false} context={context} onSelect={onSelect} onConfirm={onConfirm} onCancel={onCancel} />);
  const dialog = screen.getByRole("dialog", { name: "양식 선택" });
  const preview = dialog.querySelector(".approval-template-live-preview");
  fireEvent.change(screen.getByPlaceholderText("검색어 입력"), { target: { value: "크기" } });
  // CSS resize is a browser gesture. These are the inline dimensions it produces.
  dialog.style.width = "1000px";
  dialog.style.height = "620px";
  fireEvent.click(screen.getByRole("button", { name: "크게 보기" }));
  assert.ok(dialog.classList.contains("is-maximized"));
  assert.equal(screen.getByRole("button", { name: "이전 크기" }).getAttribute("aria-pressed"), "true");
  assert.equal((screen.getByPlaceholderText("검색어 입력") as HTMLInputElement).value, "크기");
  assert.ok(dialog.querySelector(".approval-template-live-preview") === preview, "Preview is not remounted when resizing");
  fireEvent.click(screen.getByRole("button", { name: "이전 크기" }));
  assert.ok(!dialog.classList.contains("is-maximized"));
  assert.equal(dialog.style.width, "1000px");
  assert.equal(dialog.style.height, "620px");
  assert.equal(onSelect.mock.callCount(), 0);
  assert.equal(onConfirm.mock.callCount(), 0);
  assert.equal(onCancel.mock.callCount(), 0);
});

test("default size clears manual dimensions even when maximized and leaves confirm/cancel functional", () => {
  const selected = template("DRAFT");
  const onConfirm = mock.fn();
  const onCancel = mock.fn();
  render(<TemplateSelectModalV2 templates={[selected]} selected={selected} fallbackActive={false} context={context} onSelect={() => {}} onConfirm={onConfirm} onCancel={onCancel} />);
  const dialog = screen.getByRole("dialog", { name: "양식 선택" });
  dialog.style.width = "940px";
  dialog.style.height = "540px";
  fireEvent.click(screen.getByRole("button", { name: "크게 보기" }));
  fireEvent.click(screen.getByRole("button", { name: "기본 크기" }));
  assert.ok(!dialog.classList.contains("is-maximized"));
  assert.equal(dialog.style.width, "");
  assert.equal(dialog.style.height, "");
  assert.ok(screen.getByText("오른쪽 아래 모서리를 드래그해 창 크기를 조절하세요."));
  fireEvent.click(screen.getByRole("button", { name: "확인", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "양식 선택 닫기" }));
  assert.equal(onConfirm.mock.callCount(), 1);
  assert.equal(onCancel.mock.callCount(), 1);
});

test("equipment header groups exactly five existing fields while long text fields retain full width", () => {
  const values: Record<string, string> = { requestDeptName: "인더스트릿 - 가공", requiredCompletionDate: "2026-09-30", equipmentName: "설비 이름", equipmentCapacity: "10kW", requestType: "개선", currentState: "현재 상태", requirements: "요구사항 내용" };
  const onChange = mock.fn();
  const props = { templateCode: "EQUIPMENT_PROPOSAL", value: (name: string) => values[name] ?? "", onChange };
  const view = render(<EquipmentProposalUserSection {...props} />);
  const fields = view.container.querySelector(".equipment-request-section .equipment-request-fields")!;
  const compactFields = [...fields.querySelectorAll<HTMLLabelElement>(":scope > label:not(.wide)")];
  assert.equal(compactFields.length, 5);
  assert.deepEqual(compactFields.map((label) => label.querySelector<HTMLInputElement | HTMLSelectElement>("input, select")?.value), ["인더스트릿 - 가공", "2026-09-30", "개선", "설비 이름", "10kW"]);
  assert.equal(fields.querySelectorAll(":scope > label.wide textarea").length, 4);
  assert.ok(compactFields[0].querySelector<HTMLInputElement>("input")?.readOnly);
  fireEvent.change(compactFields[3].querySelector("input")!, { target: { value: "변경 설비" } });
  assert.deepEqual(onChange.mock.calls[0].arguments, ["equipmentName", "변경 설비"]);
  fireEvent.change(compactFields[2].querySelector("select")!, { target: { value: "수리" } });
  assert.deepEqual(onChange.mock.calls[1].arguments, ["requestType", "수리"]);
  view.rerender(<EquipmentProposalUserSection {...props} readOnly />);
  for (const input of view.container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")) assert.ok(input.readOnly);
  assert.ok(view.container.querySelector<HTMLSelectElement>("select")?.disabled);
});

for (const code of ["EQUIPMENT_PROPOSAL", "MOLD_FIXTURE_PROPOSAL"]) {
  test(`${code}: PE staff compose and preview the technical section with a purchase receiver`, () => {
    const peUser = { ...user, deptName: "생산기술", roleCode: "USER" as const };
    const peEmployee = { ...employee, deptName: "생산기술" };
    const manager = { ...employee, empId: 41, deptName: "생산기술", roleCode: "MANAGER", positionName: "팀장" };
    const purchaser = { ...employee, empId: 42, deptName: "구매", loginId: "purchase-test" };
    const staff = [peEmployee, manager, purchaser];
    const peContext = { ...context, user: peUser, employees: staff };
    const option = template(code);
    let latest = createApprovalForm(option, peUser, staff, null);
    assert.deepEqual(latest.receiverEmpIds, [42]);
    assert.deepEqual(createApprovalForm(option, user, staff, null).receiverEmpIds, [41]);
    function Editor() {
      const [form, setForm] = useState(latest);
      return <ApprovalFormBody {...peContext} form={form} template={option} templates={[option]} onChange={(next) => { latest = next; setForm(next); }} />;
    }
    const view = render(<Editor />);
    fireEvent.change(screen.getByLabelText("주관부서(PE) 의견"), { target: { value: "기술 검토 입력" } });
    fireEvent.change(screen.getByLabelText("설계 의견"), { target: { value: "설계 검토 입력" } });
    fireEvent.change(screen.getByLabelText("경제성 검토 - 주관 부서"), { target: { value: "경제성 검토 입력" } });
    assert.equal(latest.fieldValues.peOpinion, "기술 검토 입력");
    assert.equal(latest.fieldValues.designOpinion, "설계 검토 입력");
    assert.equal(latest.fieldValues.peEconomicReview, "경제성 검토 입력");
    assert.ok(view.container.textContent?.includes("통합 결재가 끝나면 구매부서"));
    view.rerender(<ApprovalTemplatePreview template={option} context={peContext} />);
    assert.ok(screen.getByLabelText("설계 의견").matches(":disabled"));
    view.rerender(<ApprovalTemplatePreview template={option} context={context} />);
    assert.equal(screen.queryByLabelText("설계 의견"), null);
  });
}

test("equipment compose and preview share the compact layout without changing the mold fixture form", () => {
  const option = template("EQUIPMENT_PROPOSAL");
  const form = createApprovalForm(option, user, [employee], null);
  const view = render(<ApprovalFormBody {...context} form={form} template={option} templates={[option]} onChange={() => {}} />);
  assert.ok(view.container.querySelector(".equipment-request-fields"));
  view.rerender(<ApprovalTemplatePreview template={option} context={context} />);
  assert.ok(view.container.querySelector("fieldset[disabled] .equipment-request-fields"));
  view.rerender(<ApprovalTemplatePreview template={template("MOLD_FIXTURE_PROPOSAL")} context={context} />);
  assert.ok(!view.container.querySelector(".equipment-request-fields"));
  assert.ok(view.container.querySelector(".mold-fixture-form"));
});
