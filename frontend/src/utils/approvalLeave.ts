import {
} from "lucide-react";
import type {
  Approval,
  ApprovalDefaultLineStepApi,
  ApprovalLine,
  ApprovalTemplateApi,
  Employee,
  EquipmentProposal,
  LeaveUsage,
  User
} from "../types";
import { DEFAULT_TOTAL_ANNUAL_DAYS } from "./approvalDomainCore";
import type { ApprovalTemplateOption, LeaveSelection } from "./approvalDomainCore";
export function leaveDayValue(type: string) {
  if (type === "연차" || type === "하계휴가") return 1;
  if (type === "오전반차" || type === "오후반차") return 0.5;
  return 0;
}

export function formatDayValue(value?: string | number | null) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return String(Number(numeric.toFixed(1)));
}

export function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLeaveSelections(values: Record<string, string> | null | undefined): LeaveSelection[] {
  if (!values?.leaveSelectionsJson) return [];
  try {
    const parsed = JSON.parse(values.leaveSelectionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => item && typeof item === "object" && typeof item.date === "string")
      .map((item) => {
        const type = typeof item.type === "string" && item.type.trim() ? item.type.trim() : "연차";
        return {
          date: String(item.date),
          type,
          days: leaveDayValue(type),
          ...(typeof item.sourceApprovalId === "number" && item.sourceApprovalId > 0 ? { sourceApprovalId: item.sourceApprovalId } : {}),
          ...(typeof item.sourceDocumentNo === "string" ? { sourceDocumentNo: item.sourceDocumentNo } : {})
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function leaveSummary(selections: LeaveSelection[]) {
  return selections.map((selection) => `${formatShortDate(selection.date)} ${selection.type}`).join(", ");
}

export function leaveDateRangeText(values: Record<string, string>) {
  const startDate = values.startDate ?? "";
  const endDate = values.endDate ?? "";
  const days = formatDayValue(values.days);
  if (!startDate && !endDate) return `- [ ${days} 일 ]`;
  return `${startDate || endDate} ~ ${endDate || startDate} [ ${days} 일 ]`;
}

export function leaveRequestContent(values: Record<string, string>) {
  return [
    `신청기간: ${leaveDateRangeText(values)}`,
    `신청구분: ${values.leaveType ?? "-"}`,
    `연차 사용일수: ${formatDayValue(values.annualLeaveDays ?? values.days)}일`,
    `신청 후 잔여 연차일수: ${formatDayValue(values.remainingAnnualDays)}일`,
    values.leaveReason ? `신청 사유: ${values.leaveReason}` : "",
    values.earlyLeaveStartTime ? `조퇴 시작: ${values.earlyLeaveStartTime} (${values.earlyLeavePayType ?? ""})` : "",
    values.multipleBirthYn === "Y" ? "배우자 출산: 다태아" : ""
  ].filter(Boolean).join("\n");
}

export function leaveCancelContent(values: Record<string, string>) {
  return [
    `취소기간: ${leaveDateRangeText(values)}`,
    `취소구분: ${values.leaveType ?? "-"}`,
    `취소 연차일수: ${formatDayValue(values.annualLeaveDays ?? values.days)}일`
  ].filter(Boolean).join("\n");
}

export function leaveUsageFieldValues(usage: LeaveUsage | null): Record<string, string> {
  return {
    usedAnnualDays: formatDayValue(usage?.usedAnnualDays ?? "0"),
    totalAnnualDays: formatDayValue(usage?.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS),
    remainingAnnualDays: formatDayValue(usage?.remainingAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS)
  };
}

export function withLeaveCancelTemplate(templates: ApprovalTemplateOption[]) {
  if (templates.some((template) => template.code === "LEAVE_CANCEL")) {
    return templates;
  }
  return [
    ...templates,
    {
      code: "LEAVE_CANCEL",
      name: "휴가 취소계",
      description: "승인 완료된 휴가 취소 신청",
      version: 1,
      fieldsJson: "[]",
      activeYn: "Y" as const,
      sortOrder: 999
    }
  ];
}

export function remainingAnnualDaysText(totalDays: string | number | null | undefined, usedBefore: string | number | null | undefined, requestedDays: string | number | null | undefined) {
  return formatDayValue(Number(totalDays ?? 0) - Number(usedBefore ?? 0) - Number(requestedDays ?? 0));
}
