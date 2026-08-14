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
import type { Route } from "./approvalDomainCore";
export const routeLabels: Record<Route, string> = {
  dashboard: "대시보드",
  adminDashboard: "관리 포털",
  approvalAdmin: "전자결재 관리",
  search: "전역 검색",
  notices: "공지사항",
  boards: "게시판",
  approvals: "전자결재",
  pdm: "도면관리",
  equipment: "설비관리",
  plannedFeature: "예정 기능 안내",
  notifications: "알림",
  organization: "조직도",
  employees: "직원 관리",
  audit: "감사 로그"
};
