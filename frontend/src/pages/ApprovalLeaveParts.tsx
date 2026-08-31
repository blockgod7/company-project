import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  FileText,
  Flag,
  History,
  Inbox,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { api, authenticatedFetch, jsonBody } from "../api";
import schunkLogo from "../assets/schunk-carbon-logo.png";
import { ApprovalListTable, ApprovalRetentionAuditTable, DeletedApprovalListTable } from "../components/ApprovalTables";
import { CardHeader } from "../components/CardHeader";
import { AttachmentBox, DraftAttachmentPicker, EditorHeader, EditorTools, ReadDetail, RichContent } from "../components/ContentTools";
import { ApprovalLineTableEditor, EmployeeMultiPicker } from "../components/EmployeePickers";
import { Empty, EmptyDetail } from "../components/Empty";
import { DetailPage, ListSummary, Toolbar, TwoPane } from "../components/PageLayout";
import { uploadAttachments } from "../utils/attachments";
import type { DraftAttachment } from "../utils/attachments";
import { BEREAVEMENT_EVENT_TYPES } from "../utils/bereavement";
import type { BereavementOption } from "../utils/bereavement";
import {
  approvalProgress,
  delegatedActionText,
  documentPrefix,
  isDelegatedAction,
  lineActedName,
  lineAssignedName,
  lineDueText,
  lineStatusLabel,
  lineTypeLabel,
  priorityLabel,
  receiverProgress,
  retentionAuditActionLabel,
  stageLabel,
  statusLabel,
  templateName
} from "../utils/approvalLabels";
import {
  approvalContent,
  approvalDraftData,
  approvalLinePerson,
  approvalOpinionLines,
  approvalTemplateByCode,
  APPROVAL_TEMPLATE_CATEGORIES,
  blankMoldFixturePart,
  blankPurchaseItem,
  categorizedTemplateGroups,
  currentUserDeptName,
  DEFAULT_APPROVAL_SEARCH,
  DEFAULT_APPROVAL_TEMPLATES,
  DEFAULT_TOTAL_ANNUAL_DAYS,
  defaultApprovalForm,
  defaultDelegationForm,
  defaultLineIds,
  defaultLinePayload,
  defaultOperationSettingsForm,
  employeeDisplay,
  employeesByIds,
  ENABLE_TEMPLATE_FALLBACK,
  equipmentProposalCapacityLabel,
  equipmentProposalGeneratedTitle,
  equipmentProposalItemFallback,
  equipmentProposalItemLabel,
  equipmentProposalTitle,
  firstReceiverLineOrder,
  firstSelectableApprovalTemplate,
  formatApprovalLines,
  formatDayValue,
  formatEmployeeList,
  formatShortDate,
  idsFromJson,
  isDeptManagerUser,
  isDraftTemplateCode,
  isEquipmentProposalTemplateCode,
  isLeaveCancelTemplateCode,
  isLeaveTemplateCode,
  isMoldFixtureTemplateCode,
  isPurchaseTemplateCode,
  isReceiverRoutedTemplateCode,
  isRequiredTemplateField,
  isTrainingReportTemplateCode,
  isTrainingRequestTemplateCode,
  isTrainingTemplateCode,
  lastReceiverLineOrder,
  LEAVE_TYPE_OPTIONS,
  leaveCancelContent,
  leaveDateRangeText,
  leaveDayValue,
  leaveRequestContent,
  leaveSummary,
  leaveUsageFieldValues,
  localDateKey,
  moldFixturePartsJson,
  normalizeMoldFixtureParts,
  normalizePurchaseItems,
  parseLeaveSelections,
  parseMoldFixtureParts,
  parsePurchaseItems,
  parseTemplateFields,
  productionEngineeringManagerId,
  PURCHASE_BU_CODES,
  PURCHASE_RECEIVER_LOGIN_ID,
  purchaseBuTotal,
  purchaseDefaultFieldValues,
  purchaseItemsJson,
  purchaseReceiptDate,
  purchaseReceiverId,
  purchaseRequestContent,
  remainingAnnualDaysText,
  selectableApprovalTemplates,
  templateAdminFormFromOption,
  templateOptionFromApi,
  todayDate,
  TRAINING_RECEIVER_LOGIN_ID,
  trainingReceiverId,
  trainingReportContent,
  trainingReportDefaultFieldValues,
  trainingRequestClosingText,
  trainingRequestContent,
  trainingRequestDefaultFieldValues,
  validatePurchaseRequest,
  validateTrainingReport,
  validateTrainingRequest,
  withLeaveCancelTemplate
} from "../utils/approvalDomain";
import type {
  ApprovalBox,
  ApprovalBoxApi,
  ApprovalCategory,
  ApprovalDashboardFilter,
  ApprovalDelegationForm,
  ApprovalForm,
  ApprovalLaunch,
  ApprovalOperationSettingsForm,
  ApprovalSearchForm,
  ApprovalTemplateAdminForm,
  ApprovalTemplateCategory,
  ApprovalTemplateField,
  ApprovalTemplateOption,
  ContentMode,
  LeaveSelection,
  MoldFixturePart,
  PurchaseRequestItem
} from "../utils/approvalDomain";
import { formatDate } from "../utils/date";
import type { GlobalSearchTarget } from "../utils/search";
import type {
  Approval,
  ApprovalHoliday,
  ApprovalDelegationApi,
  ApprovalDefaultLineApi,
  ApprovalDefaultLineStepApi,
  ApprovalLine,
  ApprovalOperationSettings,
  ApprovalSummary,
  ApprovalTemplateApi,
  AuditLog,
  CompTimeSummary,
  Employee,
  EquipmentProposal,
  LeaveExclusion,
  LeaveUsage,
  PageResponse,
  User
} from "../types";
import { PurchaseDraftStampHeader, TrainingDraftStampHeader } from "./ApprovalParts";
function leaveAbsenceDayValue(type: string) {
  return ["오전반차", "오후반차", "공가(오전)", "공가(오후)"].includes(type) ? 0.5 : 1;
}
function compTimeExpiryNotice(summary: CompTimeSummary | null) {
  if (todayDate().split("-")[1] !== "12") return "";
  const dateValue = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const today = dateValue(todayDate());
  const expiryGroups = new Map<string, number>();
  summary?.credits.forEach((credit) => {
    if (credit.status !== "ACTIVE" || Number(credit.availableDays) <= 0) return;
    const daysUntilExpiry = Math.floor((dateValue(credit.expiresOn) - today) / 86_400_000);
    if (daysUntilExpiry < 0 || daysUntilExpiry > 31) return;
    expiryGroups.set(credit.expiresOn, (expiryGroups.get(credit.expiresOn) ?? 0) + Number(credit.availableDays));
  });
  if (!expiryGroups.size) return "";
  return [...expiryGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, days]) => {
      const [year, month, day] = date.split("-").map(Number);
      return `${formatDayValue(days)}일 · ${year}년 ${month}월 ${day}일 만료`;
    })
    .join(" / ");
}
export function LeaveRequestEditor({ mode, user, employees, form, leaveUsage, compTimeSummary, holidays, leaveTypeOptions = LEAVE_TYPE_OPTIONS, headerActions, onBalanceYearChange, onChange }: { mode: "request" | "cancel"; user: User; employees: Employee[]; form: ApprovalForm; leaveUsage: LeaveUsage | null; compTimeSummary: CompTimeSummary | null; holidays: ApprovalHoliday[]; leaveTypeOptions?: string[]; headerActions?: ReactNode; onBalanceYearChange?: (year: number) => void; onChange: (form: ApprovalForm) => void }) {
  const values = form.fieldValues;
  const selections = parseLeaveSelections(values);
  const cancelMode = mode === "cancel";
  const deptName = currentUserDeptName(user, employees, user.deptName ?? "");
  const requester = employees.find((employee) => employee.empId === user.empId);
  const availableLeaveTypeOptions = user.genderCode === "FEMALE" ? leaveTypeOptions : leaveTypeOptions.filter((type) => !["여성휴가", "출산전후휴가", "유산·사산휴가"].includes(type));
  const selectedCompTimeDays = selections.filter((selection) => selection.type === "대체휴무").length;
  const availableCompTimeDays = Number(compTimeSummary?.availableDays ?? 0);
  const expiryNotice = compTimeExpiryNotice(compTimeSummary);
  const requestedDays = formatDayValue(values.days);
  const annualDays = formatDayValue(values.annualLeaveDays ?? values.days);
  const usedBefore = formatDayValue(leaveUsage?.usedAnnualDays ?? values.usedAnnualDays ?? "0");
  const totalDays = formatDayValue(leaveUsage?.totalAnnualDays ?? values.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS);
  const effectiveRemainingAnnualDays = Number(leaveUsage?.remainingAnnualDays ?? totalDays) - Number(leaveUsage?.reservedAnnualDays ?? 0);
  const unpaidLeaveEligible = effectiveRemainingAnnualDays < 10;
  const remainingDays = cancelMode
    ? formatDayValue(Number(totalDays) - Number(usedBefore) + Number(annualDays))
    : remainingAnnualDaysText(totalDays, usedBefore, annualDays);
  const overbooked = !cancelMode && Number(leaveUsage?.reservedAnnualDays ?? 0) + Number(annualDays) > Number(leaveUsage?.remainingAnnualDays ?? totalDays);

  function updateValues(nextValues: Record<string, string>) {
    onChange({
      ...form,
      title: form.title.trim() ? form.title : cancelMode ? "휴가 취소계" : "휴가계",
      content: cancelMode ? leaveCancelContent(nextValues) : leaveRequestContent(nextValues),
      fieldValues: nextValues
    });
  }

  function applySelections(nextSelections: LeaveSelection[]) {
    const sorted = [...nextSelections].sort((a, b) => a.date.localeCompare(b.date));
    const requestedDays = sorted.reduce((sum, selection) => sum + leaveAbsenceDayValue(selection.type), 0);
    const annualLeaveDays = sorted.reduce((sum, selection) => sum + selection.days, 0);
    const nextValues = {
      ...values,
      startDate: sorted[0]?.date ?? "",
      endDate: sorted[sorted.length - 1]?.date ?? "",
      days: formatDayValue(requestedDays),
      annualLeaveDays: formatDayValue(annualLeaveDays),
      usedAnnualDays: usedBefore,
      totalAnnualDays: totalDays,
      remainingAnnualDays: cancelMode ? formatDayValue(Number(totalDays) - Number(usedBefore) + annualLeaveDays) : remainingAnnualDaysText(totalDays, usedBefore, annualLeaveDays),
      leaveType: leaveSummary(sorted),
      leaveSelectionsJson: JSON.stringify(sorted)
    };
    updateValues(nextValues);
    if (cancelMode && sorted[0]?.date) {
      onBalanceYearChange?.(Number(sorted[0].date.slice(0, 4)));
    }
  }

  return (
    <div className="leave-request-editor">
      <section className="leave-web-card leave-overview">
        <div className="leave-web-head">
          <div><span className="eyebrow">전자결재 · 휴가</span><h2>{cancelMode ? "휴가 취소 신청" : "휴가 신청"}</h2><p>{cancelMode ? "승인된 휴가 중 취소할 날짜를 선택하세요." : "날짜마다 휴가 종류를 선택하면 사용량이 자동 계산됩니다."}</p></div>
          {headerActions}
        </div>
        <div className="leave-applicant-row"><div><span>신청자</span><strong>{user.empName} · {requester?.positionName ?? requester?.jobTitle ?? "직급 미지정"}</strong></div><div><span>부서</span><strong>{deptName || "부서 미지정"}</strong></div><div><span>신청일</span><strong>{todayDate()}</strong></div></div>
      </section>
      <div className={`leave-balance-grid${cancelMode ? " is-cancel" : ""}`}>
        <section className="leave-metrics" aria-label="휴가 현황"><div><span>총 휴가 일수</span><strong>{totalDays}<small>일</small></strong></div><div><span>신청 전 휴가 사용 일수</span><strong>{usedBefore}<small>일</small></strong><em>최종 결재 완료 기준</em></div><div className="accent"><span>{cancelMode ? "이번 취소 휴가 일수" : "이번 신청 휴가 일수"}</span><strong>{requestedDays}<small>일</small></strong><em>{cancelMode ? `취소 후 연차 잔여 ${remainingDays}일` : `신청 후 연차 잔여 ${remainingDays}일`}</em></div></section>
        {!cancelMode && <div className={`leave-comp-time-summary${selectedCompTimeDays > availableCompTimeDays ? " insufficient" : ""}`}><div><strong>대체휴무</strong>{expiryNotice && <span>{expiryNotice}</span>}</div><div><b>사용 가능 {formatDayValue(availableCompTimeDays)}일</b><span>결재 중 예약 {formatDayValue(compTimeSummary?.reservedDays ?? 0)}일 · 이번 선택 {selectedCompTimeDays}일</span></div></div>}
      </div>
      {overbooked && <p className="leave-overbooked">결재 중인 휴가 {leaveUsage?.reservedAnnualDays}일을 포함하면 총 휴가 일수를 초과합니다. 진행 중 문서를 회수하거나 휴가관리자에게 확인해 주세요.</p>}
      <section className="leave-web-card"><div className="leave-section-title"><div><CalendarDays size={20} /><div><h3>{cancelMode ? "취소 날짜" : "신청 날짜"}</h3><p>날짜를 선택한 뒤 해당 날짜 안에서 휴가 종류를 지정하세요.</p></div></div><strong>{leaveDateRangeText(values)}</strong></div><LeaveCalendarInline mode={mode} selections={selections} lockedSelections={(cancelMode ? leaveUsage?.selections : leaveUsage?.occupiedSelections) ?? []} pendingCancelSelections={leaveUsage?.pendingCancelSelections ?? []} holidays={holidays} leaveTypeOptions={availableLeaveTypeOptions} compTimeSummary={compTimeSummary} unpaidLeaveEligible={unpaidLeaveEligible} onChange={applySelections} /></section>
      <LeaveConditionalDetails selections={selections} values={values} workCategory={requester?.workCategory ?? "FIELD"} onChange={(next) => updateValues({ ...values, ...next })} />
      <section className="leave-web-card leave-routing"><LeaveRouteRow title="결재" people={[{ employee: requester, role: "작성" }, ...employeesByIds(employees, form.approverEmpIds).map((employee, index, list) => ({ employee, role: index === list.length - 1 ? "승인" : "검토" }))]} /><LeaveRouteRow title="수신" people={employeesByIds(employees, form.receiverEmpIds).map((employee) => ({ employee, role: "수신" }))} /></section>
      <p className="muted-text">{cancelMode ? "최종 결재 완료된 휴가 날짜만 선택할 수 있고, 취소계 승인 후 연차가 복구됩니다." : "연차와 하계휴가는 1일, 오전·오후반차는 0.5일로 계산하며 주말과 등록 휴일은 선택할 수 없습니다."}</p>
      {!!leaveUsage?.exclusions?.length && (
        <div className="leave-exclusion-summary">
          <strong>관리자 휴일 지정으로 자동 제외된 내역</strong>
          {leaveUsage.exclusions.map((item) => <span key={item.exclusionId}>{item.date} · {item.type} · {item.holidayName} · {item.restoredDays}일 복원</span>)}
        </div>
      )}
    </div>
  );
}

function LeaveRouteRow({ title, people }: { title: string; people: { employee?: Employee; role: string }[] }) {
  return <div className="leave-route-row"><strong className="leave-route-label">{title}</strong><div className="leave-person-list">{people.length ? people.map(({ employee, role }, index) => <div className="leave-person-card" key={`${role}-${employee?.empId ?? index}`}><span>{index + 1}</span><div><em>{role}</em><strong>{employee?.empName ?? "미지정"}</strong><small>{employee?.deptName ?? "부서 미지정"} · {employee?.positionName ?? employee?.jobTitle ?? "직급 미지정"}</small></div></div>) : <p className="muted-text">지정된 사람이 없습니다.</p>}</div><span className="leave-route-help">상단 ‘결재 정보’에서 수정</span></div>;
}

function LeaveConditionalDetails({ selections, values, workCategory, onChange }: { selections: LeaveSelection[]; values: Record<string, string>; workCategory: "MANAGEMENT" | "FIELD"; onChange: (values: Record<string, string>) => void }) {
  const types = new Set(selections.map((selection) => selection.type));
  const needsReason = ["무급휴가", "공가", "공가(오전)", "공가(오후)", "공상"].some((type) => types.has(type));
  const [bereavementOptions, setBereavementOptions] = useState<BereavementOption[]>([]);
  const [bereavementError, setBereavementError] = useState("");
  const relationOptions = bereavementOptions.filter((item) => item.eventType === values.familyEventType);
  useEffect(() => {
    if (!types.has("경조")) {
      setBereavementOptions([]);
      setBereavementError("");
      return;
    }
    const firstDate = selections.filter((item) => item.type === "경조").map((item) => item.date).sort()[0];
    if (!firstDate) return;
    let active = true;
    void api<BereavementOption[]>(`/bereavement-policies/options?date=${firstDate}`)
      .then((options) => {
        if (!active) return;
        setBereavementOptions(options);
        setBereavementError(options.length ? "" : "해당 날짜에 적용되는 경조휴가 기준이 없습니다. 휴가관리자가 ‘휴가정책 > 경조 유형·관계별 기준표’에서 허용일수와 시행일을 등록해야 합니다.");
      })
      .catch((caught) => {
        if (!active) return;
        setBereavementOptions([]);
        setBereavementError(caught instanceof Error ? caught.message : "경조휴가 기준을 불러오지 못했습니다.");
      });
    return () => { active = false; };
  }, [selections.map((item) => `${item.date}:${item.type}`).join("|")]);
  if (!selections.length || (!needsReason && !["병가", "산재요양", "배우자 출산휴가", "출산전후휴가", "여성휴가", "대체휴무", "경조", "난임치료휴가", "조퇴", "공상"].some((type) => types.has(type)))) return null;
  return <section className="leave-web-card leave-details"><div className="leave-section-title"><div><FileText size={20} /><div><h3>선택 날짜 상세</h3><p>선택한 휴가에 필요한 항목만 표시됩니다.</p></div></div></div><div className="leave-policy-badges">{(types.has("병가") || types.has("무급휴가") || (types.has("조퇴") && workCategory === "FIELD")) && <span className="unpaid">무급 · 연차 미차감</span>}{["공가", "공가(오전)", "공가(오후)", "경조", "여성휴가", "대체휴무", "배우자 출산휴가", "출산전후휴가", "공상"].some((type) => types.has(type)) && <span>유급 · 연차 미차감</span>}{types.has("조퇴") && workCategory === "MANAGEMENT" && <span>관리직 조퇴 · 유급 · 연차 미차감</span>}{types.has("여성휴가") && <span>월 1회 · 종일 사용</span>}{types.has("산재요양") && <span>연차 미차감 · 산재 처리 별도 확인</span>}</div><div className="leave-details-grid">
    {needsReason && <label className="wide">구체적인 신청 사유 <b>필수</b><textarea required value={values.leaveReason ?? ""} onChange={(event) => onChange({ leaveReason: event.target.value })} /></label>}
    {types.has("병가") && <label className="wide">병가 증빙 <small>진단서 필수 · 첨부파일에서 등록</small><input readOnly value="달력 기준 연속 14일 이상 선택하고 진단서를 첨부해 주세요. 첨부 여부만 확인합니다." /></label>}
    {types.has("난임치료휴가") && <label className="wide">난임치료 증빙 <small>필수 · 첨부파일에서 등록</small><input readOnly value="난임치료 관련 서류를 첨부해 주세요. 첨부 여부만 확인합니다." /></label>}
    {types.has("조퇴") && <><label>조퇴 시작 시간 <b>필수</b><input required type="time" value={values.earlyLeaveStartTime ?? ""} onChange={(event) => onChange({ earlyLeaveStartTime: event.target.value, earlyLeavePayType: workCategory === "MANAGEMENT" ? "관리직 · 유급" : "현장직 · 무급" })} /></label><label>급여 구분<input readOnly value={workCategory === "MANAGEMENT" ? "관리직 · 유급" : "현장직 · 무급"} /></label></>}
    {types.has("경조") && <><label>경조 유형<select required value={values.familyEventType ?? ""} onChange={(event) => onChange({ familyEventType: event.target.value, familyRelation: "" })}><option value="">선택</option>{BEREAVEMENT_EVENT_TYPES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label>{values.familyEventType === "DEATH" ? "상신자와 고인의 관계" : "대상 관계"}<select required disabled={!values.familyEventType || !relationOptions.length} value={values.familyRelation ?? ""} onChange={(event) => onChange({ familyRelation: event.target.value })}><option value="">{values.familyEventType && !relationOptions.length ? "등록된 기준 없음" : "선택"}</option>{relationOptions.map((item) => <option key={`${item.eventType}-${item.familyRelation}`} value={item.familyRelation}>{item.familyRelationLabel} · {item.allowedDays}일 · {item.payType === "PAID" ? "유급" : "무급"}{item.evidenceRequired ? " · 증빙필수" : ""}</option>)}</select></label>{bereavementError && <p className="wide error">{bereavementError}</p>}</>}
    {types.has("산재요양") && <><label>예상 휴업 시작일<input type="date" value={values.accidentExpectedStartDate ?? ""} onChange={(event) => onChange({ accidentExpectedStartDate: event.target.value })} /></label><label>예상 휴업 종료일<input type="date" value={values.accidentExpectedEndDate ?? ""} onChange={(event) => onChange({ accidentExpectedEndDate: event.target.value })} /></label><label className="wide">산재 접수정보<input value={values.accidentReceiptInfo ?? ""} onChange={(event) => onChange({ accidentReceiptInfo: event.target.value })} /></label></>}
    {(types.has("배우자 출산휴가") || types.has("출산전후휴가")) && <><label>출산 예정일<input type="date" value={values.expectedBirthDate ?? ""} onChange={(event) => onChange({ expectedBirthDate: event.target.value })} /></label><label>실제 출산일 <small>출산 후 확정 가능</small><input type="date" value={values.actualBirthDate ?? ""} onChange={(event) => onChange({ actualBirthDate: event.target.value })} /></label>{types.has("배우자 출산휴가") && <><label className="wide"><span>다태아(쌍둥이 이상)</span><input type="checkbox" checked={values.multipleBirthYn === "Y"} onChange={(event) => onChange({ multipleBirthYn: event.target.checked ? "Y" : "N" })} /></label><div className="wide leave-comp-time-note"><strong>사용 한도 자동 확인</strong><span>{values.multipleBirthYn === "Y" ? "다태아 25일" : "기본 20일"} · 기존 사용/결재 중 포함 · 법정 사용기간을 상신 시 다시 검사합니다.</span></div></>}</>}
  </div></section>;
}

function LeaveCalendarInline({ mode, selections, lockedSelections, pendingCancelSelections, holidays, leaveTypeOptions, compTimeSummary, unpaidLeaveEligible, onChange }: { mode: "request" | "cancel"; selections: LeaveSelection[]; lockedSelections: LeaveUsage["selections"]; pendingCancelSelections: LeaveUsage["pendingCancelSelections"]; holidays: ApprovalHoliday[]; leaveTypeOptions: string[]; compTimeSummary: CompTimeSummary | null; unpaidLeaveEligible: boolean; onChange: (selections: LeaveSelection[]) => void }) {
  const initialDate = selections[0]?.date ? new Date(`${selections[0].date}T00:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const selectedMap = new Map(selections.map((selection) => [selection.date, selection]));
  const lockedByDate = new Map<string, LeaveUsage["selections"]>();
  lockedSelections.forEach((selection) => lockedByDate.set(selection.date, [...(lockedByDate.get(selection.date) ?? []), selection]));
  const pendingCancelKeys = new Set(pendingCancelSelections.map((selection) => `${selection.approvalId ?? "legacy"}|${selection.date}|${selection.type}`));
  const pendingLegacyKeys = new Set(pendingCancelSelections.filter((selection) => selection.approvalId == null).map((selection) => `${selection.date}|${selection.type}`));
  const cancelMode = mode === "cancel";
  const holidayMap = new Map(holidays.filter((holiday) => holiday.active).map((holiday) => [holiday.holidayDate, holiday.holidayName]));
  const compTimeWorkMap = new Map<string, number>();
  compTimeSummary?.credits.forEach((credit) => compTimeWorkMap.set(credit.workDate, (compTimeWorkMap.get(credit.workDate) ?? 0) + Number(credit.grantedDays)));
  const availableCompTimeDays = Number(compTimeSummary?.availableDays ?? 0);
  const selectedCompTimeDays = selections.filter((selection) => selection.type === "대체휴무").length;
  const monthCells = calendarCells(visibleMonth, holidayMap);

  function moveMonth(delta: number) { setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1)); }
  function cancelKey(selection: LeaveSelection | LeaveUsage["selections"][number]) {
    const approvalId = (selection as LeaveSelection).sourceApprovalId
      ?? (selection as LeaveUsage["selections"][number]).approvalId;
    return `${approvalId ?? "legacy"}|${selection.date}|${selection.type}`;
  }
  function cancellationPending(selection: LeaveUsage["selections"][number]) {
    return pendingCancelKeys.has(cancelKey(selection)) || pendingLegacyKeys.has(`${selection.date}|${selection.type}`);
  }
  function allowedTypes(lockedItems: LeaveUsage["selections"] = []) {
    const eligibleOptions = unpaidLeaveEligible ? leaveTypeOptions : leaveTypeOptions.filter((type) => type !== "무급휴가");
    if (!lockedItems.length) return eligibleOptions;
    const occupiedSlots = new Set(lockedItems.map((item) => ["오전반차", "공가(오전)"].includes(item.type) ? "AM" : ["오후반차", "공가(오후)"].includes(item.type) ? "PM" : "FULL"));
    if (occupiedSlots.has("FULL") || (occupiedSlots.has("AM") && occupiedSlots.has("PM"))) return [];
    if (occupiedSlots.has("AM")) return eligibleOptions.filter((type) => ["오후반차", "공가(오후)"].includes(type));
    if (occupiedSlots.has("PM")) return eligibleOptions.filter((type) => ["오전반차", "공가(오전)"].includes(type));
    return [];
  }
  function selectedYearAllows(date: string) {
    const year = date.slice(0, 4);
    const annualYears = new Set(selections.map((item) => item.date.slice(0, 4)));
    return !annualYears.size || annualYears.has(year);
  }
  function toggleRequestDate(date: string) {
    const lockedItems = lockedByDate.get(date) ?? [];
    if (selectedMap.has(date)) { onChange(selections.filter((selection) => selection.date !== date)); return; }
    if (!selectedYearAllows(date)) return;
    const selectedDate = new Date(`${date}T00:00:00`);
    if (selectedDate.getDay() === 0 || selectedDate.getDay() === 6 || holidayMap.has(date)) return;
    const options = allowedTypes(lockedItems);
    if (!options.length) return;
    const locked = lockedItems[0];
    const type = locked?.type === "오전반차" || locked?.type === "공가(오전)" ? "오후반차" : locked?.type === "오후반차" || locked?.type === "공가(오후)" ? "오전반차" : "연차";
    onChange([...selections, { date, type, days: leaveDayValue(type) }].sort((a, b) => a.date.localeCompare(b.date)));
  }
  function toggleCancelSelection(locked: LeaveUsage["selections"][number]) {
    const key = cancelKey(locked);
    if (cancellationPending(locked)) return;
    if (selections.some((selection) => cancelKey(selection) === key)) {
      onChange(selections.filter((selection) => cancelKey(selection) !== key));
      return;
    }
    if (!selectedYearAllows(locked.date)) return;
    onChange([
      ...selections,
      {
        date: locked.date,
        type: locked.type,
        days: Number(locked.days || 0),
        ...(locked.approvalId ? { sourceApprovalId: locked.approvalId } : {}),
        sourceDocumentNo: locked.documentNo
      }
    ].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type)));
  }
  function compTimeUnavailable(currentType: string) {
    const otherSelectedDays = selectedCompTimeDays - (currentType === "대체휴무" ? 1 : 0);
    return !cancelMode && availableCompTimeDays - otherSelectedDays < 1;
  }
  function changeType(date: string, type: string) {
    const current = selectedMap.get(date);
    if (type === "대체휴무" && compTimeUnavailable(current?.type ?? "")) return;
    onChange(selections.map((selection) => selection.date === date ? { ...selection, type, days: leaveDayValue(type) } : selection));
  }

  return <div className="leave-calendar-inline">
    <div className="leave-calendar-toolbar"><button type="button" className="ghost" onClick={() => moveMonth(-1)}>이전</button><strong>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</strong><button type="button" className="ghost" onClick={() => moveMonth(1)}>다음</button></div>
    <div className="leave-calendar-grid">{["일", "월", "화", "수", "목", "금", "토"].map((day) => <div key={day} className="leave-calendar-week">{day}</div>)}{monthCells.map((cell) => {
      const selected = selectedMap.get(cell.date); const lockedItems = lockedByDate.get(cell.date) ?? []; const locked = lockedItems[0]; const options = allowedTypes(lockedItems); const compTimeWorkedDays = compTimeWorkMap.get(cell.date);
      if (cancelMode) {
        const selectedOnDate = lockedItems.some((item) => selections.some((selection) => cancelKey(selection) === cancelKey(item)));
        const unavailable = !lockedItems.length || lockedItems.every(cancellationPending);
        return <div key={cell.date} className={`leave-calendar-day cancel-day${cell.inMonth ? "" : " outside"}${cell.weekend ? " weekend" : ""}${cell.holidayName ? " holiday" : ""}${selectedOnDate ? " selected" : ""}${lockedItems.length ? " locked" : ""}${unavailable ? " unavailable" : ""}`} aria-disabled={unavailable}>
          <span>{cell.day}</span>{cell.holidayName && <em className="leave-calendar-holiday">{cell.holidayName}</em>}
          {!!lockedItems.length && <div className="leave-calendar-cancel-options">{lockedItems.map((item) => {
            const pending = cancellationPending(item);
            const itemSelected = selections.some((selection) => cancelKey(selection) === cancelKey(item));
            return <button type="button" key={cancelKey(item)} className={`leave-calendar-cancel-option${itemSelected ? " selected" : ""}${pending ? " pending" : ""}`} disabled={pending} onClick={() => toggleCancelSelection(item)} title={pending ? "휴가 취소 결재가 진행 중입니다." : item.documentNo ? `원본 문서 ${item.documentNo}` : undefined}>
              <strong>{pending ? "취소 결재 중" : itemSelected ? `취소 ${item.type}` : `기존 ${item.type}`}</strong>{item.documentNo && <small>{item.documentNo}</small>}
            </button>;
          })}</div>}
        </div>;
      }
      const unavailable = cell.weekend || Boolean(cell.holidayName) || Boolean(lockedItems.length && !options.length);
      return <button type="button" key={cell.date} className={`leave-calendar-day${cell.inMonth ? "" : " outside"}${cell.weekend ? " weekend" : ""}${cell.holidayName ? " holiday" : ""}${selected ? " selected" : ""}${lockedItems.length ? " locked" : ""}${unavailable ? " unavailable" : ""}`} onClick={() => toggleRequestDate(cell.date)} disabled={unavailable} title={unavailable ? cell.holidayName || (locked ? `${locked.type} 사용 중` : "선택할 수 없는 날짜") : ""}>
        <span>{cell.day}</span>{cell.holidayName && <em className="leave-calendar-holiday">{cell.holidayName}</em>}{compTimeWorkedDays != null && <small className="leave-calendar-comp-time">대체근무 {formatDayValue(compTimeWorkedDays)}일 적립</small>}{locked && <small className="leave-calendar-locked-type">{lockedItems.length > 1 ? "기존 휴가 2건" : `기존 ${locked.type}`}</small>}{selected && <select className="leave-calendar-type-select" value={selected.type} onClick={(event) => event.stopPropagation()} onChange={(event) => changeType(cell.date, event.target.value)}>{(options.length ? options : (unpaidLeaveEligible ? leaveTypeOptions : leaveTypeOptions.filter((type) => type !== "무급휴가"))).map((option) => <option key={option} value={option} disabled={option === "대체휴무" && compTimeUnavailable(selected.type)}>{option === "대체휴무" ? `대체휴무 (잔여 ${formatDayValue(availableCompTimeDays)}일)` : option}</option>)}</select>}
      </button>;
    })}</div>
    <div className="leave-selection-list"><div className="leave-selection-summary">{cancelMode ? `선택 ${selections.length}건 · 취소 ${formatDayValue(selections.reduce((sum, item) => sum + leaveAbsenceDayValue(item.type), 0))}일 · 일반 연차 복원 ${formatDayValue(selections.reduce((sum, item) => sum + item.days, 0))}일` : `선택 ${selections.length}일 · 일반 연차 차감 ${formatDayValue(selections.reduce((sum, item) => sum + item.days, 0))}일`}</div>{selections.length ? <p className="leave-selection-inline-summary">{selections.map((selection) => `${selection.date} ${selection.type}${selection.sourceDocumentNo ? ` (${selection.sourceDocumentNo})` : ""}`).join(", ")}</p> : <p className="muted-text">달력에서 날짜를 선택하세요.</p>}</div>
  </div>;
}

function LeaveStamp({ title, writer, approvers }: { title: string; writer: string; approvers: Employee[] }) {
  const columns = [
    ...(writer ? [{ label: "작성", name: writer, position: "신청자" }] : []),
    ...approvers.map((employee, index) => ({
      label: title === "수신" ? "수신" : index === approvers.length - 1 ? "승인" : "검토",
      name: employee.empName,
      position: employee.positionName ?? employee.jobTitle ?? ""
    }))
  ];
  if (!columns.length) columns.push({ label: "", name: "", position: "" });
  const columnWidth = "72px";
  const maxWidth = `${34 + columns.length * 72}px`;
  return (
    <div className={`leave-stamp ${title === "수신" ? "align-right" : "align-left"}`} style={{ gridTemplateColumns: `34px repeat(${columns.length}, ${columnWidth})`, maxWidth }}>
      <div className="leave-stamp-side">{title}</div>
      {columns.map((column, index) => <div key={`head-${index}`} className="leave-stamp-cell head">{column.label}</div>)}
      {columns.map((column, index) => (
        <div key={`body-${index}`} className="leave-stamp-cell body">
          <span>{column.position}</span>
          <strong>{column.name}</strong>
        </div>
      ))}
    </div>
  );
}

function LeaveCalendarModal({ mode, selections, lockedSelections, holidays, onCancel, onConfirm }: { mode: "request" | "cancel"; selections: LeaveSelection[]; lockedSelections: LeaveUsage["selections"]; holidays: ApprovalHoliday[]; onCancel: () => void; onConfirm: (selections: LeaveSelection[]) => void }) {
  const initialDate = selections[0]?.date ? new Date(`${selections[0].date}T00:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [draftSelections, setDraftSelections] = useState<LeaveSelection[]>(selections);
  const selectedMap = new Map(draftSelections.map((selection) => [selection.date, selection]));
  const lockedMap = new Map(lockedSelections.map((selection) => [selection.date, selection]));
  const cancelMode = mode === "cancel";
  const holidayMap = new Map(holidays.filter((holiday) => holiday.active).map((holiday) => [holiday.holidayDate, holiday.holidayName]));
  const monthCells = calendarCells(visibleMonth, holidayMap);
  const totalDays = draftSelections.reduce((sum, selection) => sum + selection.days, 0);

  function moveMonth(delta: number) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1));
  }

  function toggleDate(date: string) {
    const approvedSelection = lockedMap.get(date);
    if (cancelMode && !approvedSelection) {
      return;
    }
    if (!cancelMode && lockedMap.has(date)) {
      return;
    }
    if (selectedMap.has(date)) {
      setDraftSelections(draftSelections.filter((selection) => selection.date !== date));
      return;
    }
    const selectedDate = new Date(`${date}T00:00:00`);
    if (!cancelMode && (selectedDate.getDay() === 0 || selectedDate.getDay() === 6 || holidayMap.has(date))) {
      return;
    }
    if (cancelMode && approvedSelection) {
      setDraftSelections([...draftSelections, { date, type: approvedSelection.type, days: Number(approvedSelection.days || 0) }].sort((a, b) => a.date.localeCompare(b.date)));
      return;
    }
    setDraftSelections([...draftSelections, { date, type: "연차", days: 1 }].sort((a, b) => a.date.localeCompare(b.date)));
  }

  function changeType(date: string, type: string) {
    setDraftSelections(draftSelections.map((selection) => selection.date === date ? { ...selection, type, days: leaveDayValue(type) } : selection));
  }

  return (
    <div className="modal-backdrop">
      <div className="leave-calendar-modal">
        <div className="modal-head">
          <h2>신청일 선택</h2>
          <div className="leave-calendar-head-actions">
            <button type="button" onClick={() => onConfirm(draftSelections)}>확인</button>
            <button type="button" className="ghost icon-button" onClick={onCancel} aria-label="닫기"><X size={18} /></button>
          </div>
        </div>
        <div className="leave-calendar-toolbar">
          <button type="button" className="ghost" onClick={() => moveMonth(-1)}>이전</button>
          <strong>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</strong>
          <button type="button" className="ghost" onClick={() => moveMonth(1)}>다음</button>
        </div>
        <div className="leave-calendar-grid">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => <div key={day} className="leave-calendar-week">{day}</div>)}
          {monthCells.map((cell) => {
            const selected = selectedMap.get(cell.date);
            const locked = lockedMap.get(cell.date);
            const unavailable = cancelMode && !locked;
            const requestUnavailable = !cancelMode && (cell.weekend || Boolean(cell.holidayName)) && !selected;
            return (
              <button
                type="button"
                key={cell.date}
                className={`leave-calendar-day${cell.inMonth ? "" : " outside"}${cell.weekend ? " weekend" : ""}${cell.holidayName ? " holiday" : ""}${selected ? " selected" : ""}${!cancelMode && locked ? " locked" : ""}${unavailable || requestUnavailable ? " unavailable" : ""}`}
                onClick={() => toggleDate(cell.date)}
                disabled={Boolean(!cancelMode && locked) || unavailable || requestUnavailable}
              >
                <span>{cell.day}</span>
                {cell.holidayName && <em className="leave-calendar-holiday">{cell.holidayName}</em>}
                {cancelMode && locked && !selected && <strong className="leave-calendar-locked-type">{locked.type}</strong>}
                {!cancelMode && locked && <strong className="leave-calendar-locked-type">{locked.type}</strong>}
                {selected && cancelMode && <strong className="leave-calendar-locked-type">{selected.type}</strong>}
                {selected && !cancelMode && (
                  <select
                    className="leave-calendar-type-select"
                    value={selected.type}
                    aria-label={`${cell.date} 신청구분`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => changeType(cell.date, event.target.value)}
                  >
                    {LEAVE_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                )}
              </button>
            );
          })}
        </div>
        <div className="leave-selection-list">
          <div className="leave-selection-summary">선택 {draftSelections.length}일 · {cancelMode ? "취소 연차" : "연차 사용"} {formatDayValue(totalDays)}일</div>
          {lockedSelections.length > 0 && <p className="leave-locked-summary">결재 완료 {lockedSelections.length}일 · 이미 사용 {formatDayValue(lockedSelections.reduce((sum, selection) => sum + Number(selection.days || 0), 0))}일</p>}
          {draftSelections.length ? (
            <p className="leave-selection-inline-summary">{draftSelections.map((selection) => `${selection.date} ${selection.type}(${formatDayValue(selection.days)}일)`).join(", ")}</p>
          ) : <p className="muted-text">{cancelMode ? "최종 결재 완료된 휴가 날짜만 선택할 수 있습니다." : "달력에서 신청일을 선택하세요."}</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>취소</button>
          <button type="button" onClick={() => onConfirm(draftSelections)}>확인</button>
        </div>
      </div>
    </div>
  );
}

function calendarCells(month: Date, holidayMap: Map<string, string>) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const date = localDateKey(current);
    const day = current.getDay();
    return {
      date,
      day: current.getDate(),
      inMonth: current.getMonth() === month.getMonth(),
      weekend: day === 0 || day === 6,
      holidayName: holidayMap.get(date) ?? ""
    };
  });
}

export function LeaveRequestDetailView({ approval, exclusions = [] }: { approval: Approval; exclusions?: LeaveExclusion[] }) {
  const values = approvalDraftData(approval).fieldValues;
  const cancelMode = isLeaveCancelTemplateCode(approval.templateCode);
  const approvers = approval.lines.filter((line) => line.lineType === "APPROVAL").sort((a, b) => a.lineOrder - b.lineOrder);
  const receivers = approval.lines.filter((line) => line.lineType === "RECEIVER").sort((a, b) => a.lineOrder - b.lineOrder);
  const selections = parseLeaveSelections(values);
  const usedBefore = formatDayValue(values.usedAnnualDays ?? "0");
  const totalDays = formatDayValue(values.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS);
  const requestDays = formatDayValue(values.days ?? "0");

  return (
    <article className="leave-request-detail">
      <section className="leave-web-card leave-web-head leave-detail-head">
        <div>
          <span className="eyebrow">전자결재 · {approval.documentNo ?? "임시 문서"}</span>
          <h2>{cancelMode ? "휴가 취소" : "휴가 신청"}</h2>
          <p>{approval.title}</p>
        </div>
        <div className="leave-detail-status">
          <span>{statusLabel(approval.status)}</span>
          <small>{stageLabel(approval.currentStage)}</small>
        </div>
      </section>

      <section className="leave-applicant-row">
        <div><span>신청자</span><strong>{approval.requesterName} · {approval.requesterPositionName ?? "-"}</strong></div>
        <div><span>부서</span><strong>{approval.draftDeptName ?? approval.requesterDeptName ?? "-"}</strong></div>
        <div><span>신청일</span><strong>{formatDate(approval.requestedAt).slice(0, 10)}</strong></div>
      </section>

      <section className="leave-metrics">
        <div><span>총 휴가 일수</span><strong>{totalDays}<small>일</small></strong><em>해당 연도 최종 확정 수량</em></div>
        <div><span>신청 전 휴가 사용 일수</span><strong>{usedBefore}<small>일</small></strong><em>결재 완료된 휴가 기준</em></div>
        <div className="accent"><span>{cancelMode ? "이번 취소 휴가 일수" : "이번 신청 휴가 일수"}</span><strong>{requestDays}<small>일</small></strong><em>{cancelMode ? "승인 시 복원되는 수량" : "이 문서의 연차 차감 수량"}</em></div>
      </section>

      <section className="leave-web-card leave-detail-selections">
        <div className="leave-section-title"><div><CalendarDays size={20} /><div><h3>{cancelMode ? "취소 날짜" : "신청 날짜"}</h3><p>{leaveDateRangeText(values)}</p></div></div></div>
        <div className="leave-detail-date-list">
          {selections.length ? selections.map((selection) => (
            <div key={`${selection.date}-${selection.type}`}>
              <strong>{selection.date}</strong>
              <span>{selection.type}</span>
              <small>{formatDayValue(leaveAbsenceDayValue(selection.type))}일{cancelMode && selection.sourceDocumentNo ? ` · 원본 ${selection.sourceDocumentNo}` : ""}</small>
            </div>
          )) : <div><strong>{values.startDate || "-"}</strong><span>{values.leaveType || "-"}</span><small>{requestDays}일</small></div>}
        </div>
        {values.leaveReason && <div className="leave-detail-reason"><span>신청 사유</span><p>{values.leaveReason}</p></div>}
      </section>

      <section className="leave-web-card leave-routing leave-detail-routing">
        <div className="leave-route-row">
          <strong className="leave-route-label">결재</strong>
          <div className="leave-person-list">
            <div className="leave-person-card"><span>1</span><div><em>작성</em><strong>{approval.requesterName}</strong><small>{approval.draftDeptName ?? approval.requesterDeptName ?? "-"} · {approval.requesterPositionName ?? "-"}</small></div></div>
            {approvers.map((line, index) => <div className="leave-person-card" key={line.lineId}><span>{index + 2}</span><div><em>{index === approvers.length - 1 ? "승인" : "검토"} · {lineStatusLabel(line.status)}</em><strong>{line.empNameSnapshot ?? line.approverName}</strong><small>{line.deptNameSnapshot ?? line.approverDeptName ?? "-"} · {line.positionSnapshot ?? line.approverPositionName ?? "-"}</small></div></div>)}
          </div>
        </div>
        <div className="leave-route-row">
          <strong className="leave-route-label">수신</strong>
          <div className="leave-person-list">
            {receivers.length ? receivers.map((line, index) => <div className="leave-person-card" key={line.lineId}><span>{index + 1}</span><div><em>수신 · {lineStatusLabel(line.status)}</em><strong>{line.empNameSnapshot ?? line.approverName}</strong><small>{line.deptNameSnapshot ?? line.approverDeptName ?? "-"} · {line.positionSnapshot ?? line.approverPositionName ?? "-"}</small></div></div>) : <span className="muted-text">지정된 수신자가 없습니다.</span>}
          </div>
        </div>
      </section>
      {!!exclusions.length && (
        <section className="approval-detail-section leave-exclusion-detail">
          <h3>자동 연차 복원 내역</h3>
          {exclusions.map((item) => (
            <div key={item.exclusionId} className="leave-exclusion-row">
              <strong>{item.date} · {item.type}</strong>
              <span>{item.holidayName} 지정으로 자동 제외</span>
              <span>{item.restoredDays}일 복원 · {formatDate(item.excludedAt)}</span>
            </div>
          ))}
        </section>
      )}
    </article>
  );
}

function LeaveDetailStamp({ title, writerName, writerPosition, lines }: { title: string; writerName: string; writerPosition: string; lines: ApprovalLine[] }) {
  const columns = [
    ...(writerName ? [{ label: "작성", name: writerName, position: writerPosition, date: "" }] : []),
    ...lines.map((line, index) => ({
      label: title === "수신" ? "수신" : index === lines.length - 1 ? "승인" : "검토",
      name: line.status === "APPROVED" || line.status === "REJECTED" ? lineStatusLabel(line.status) : line.approverName,
      position: line.positionSnapshot ?? line.approverPositionName ?? "결재자",
      date: line.signedAt ? formatDate(line.signedAt).slice(0, 10) : ""
    }))
  ];
  if (!columns.length) columns.push({ label: "", name: "", position: "", date: "" });
  const columnWidth = "72px";
  const maxWidth = `${34 + columns.length * 72}px`;
  return (
    <div className={`leave-stamp ${title === "수신" ? "align-right" : "align-left"}`} style={{ gridTemplateColumns: `34px repeat(${columns.length}, ${columnWidth})`, maxWidth }}>
      <div className="leave-stamp-side">{title}</div>
      {columns.map((column, index) => <div key={`head-${index}`} className="leave-stamp-cell head">{column.label}</div>)}
      {columns.map((column, index) => (
        <div key={`body-${index}`} className="leave-stamp-cell body">
          <span>{column.position}</span>
          <strong>{column.name}</strong>
          <small>{column.date}</small>
        </div>
      ))}
    </div>
  );
}

function requiredLabel(label: string) {
  return <>{label}<span className="required-mark"> *</span></>;
}
