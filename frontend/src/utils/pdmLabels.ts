import type { PdmDownloadRequest, PdmDrawing, PdmPermissionAdmin } from "../types";

export function fileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

export function fileNameFromContentDisposition(disposition: string | null) {
  if (!disposition) return null;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
  const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (!fileNameMatch?.[1]) return null;
  return decodeURIComponent(fileNameMatch[1].trim());
}

export function pdmStatusLabel(status: PdmDrawing["status"]) {
  return {
    ACTIVE: "사용중",
    OLD_VERSION: "구버전",
    VOIDED: "파기",
    ON_HOLD: "보류"
  }[status];
}

export function approvalStatusLabel(status: PdmDownloadRequest["approvalStatus"]) {
  return {
    DRAFT: "임시저장",
    PENDING: "대기",
    IN_PROGRESS: "진행",
    APPROVED: "승인",
    REJECTED: "반려",
    WITHDRAWN: "회수",
    CANCELED: "취소"
  }[status];
}

export function pdmPermissionLabel(key: string) {
  return {
    canRegister: "파일/폴더 등록",
    canRevise: "개정/파기",
    canView: "조회",
    canDownloadRequest: "다운로드 요청",
    canDownloadApprove: "다운로드 승인"
  }[key] ?? key;
}

export function pdmPermissionTargetKindLabel(permission: PdmPermissionAdmin) {
  if (permission.deptId != null) return "부서 권한 범위";
  if (permission.empId != null) return "직원 권한 배정";
  return "권한";
}

export function pdmPermissionScopeLabel(category: PdmPermissionAdmin["category"]) {
  if (category === "PRODUCT") return "제품도면";
  if (category === "EQUIPMENT") return "설비도면";
  return "전체";
}

export function pdmPermissionNames(permission: PdmPermissionAdmin) {
  return [
    permission.canRegister && "파일/폴더 등록",
    permission.canRevise && "개정/파기",
    permission.canView && "조회",
    permission.canDownloadRequest && "반출요청",
    permission.canDownloadApprove && "반출승인"
  ].filter(Boolean) as string[];
}

export function pdmPermissionMark(enabled: boolean) {
  return enabled ? "예" : "-";
}
