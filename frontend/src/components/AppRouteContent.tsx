import { lazy, Suspense } from "react";
import { AccessDenied } from "./AccessDenied";
import { DashboardPage } from "../pages/DashboardPage";
import { AdminPortalPage } from "../pages/AdminPortalPage";
import { canAccessAdminPortal, canManageApproval, canViewPlannedFeatures } from "../navigation";
import type { GlobalSearchItem, GlobalSearchResponse, User } from "../types";
import type { ApprovalLaunch, Route } from "../utils/approvalDomain";
import type { GlobalSearchTarget } from "../utils/search";

const ApprovalPage = lazy(() => import("../pages/ApprovalPage").then((module) => ({ default: module.ApprovalPage })));
const AuditLogPage = lazy(() => import("../pages/AuditLogPage").then((module) => ({ default: module.AuditLogPage })));
const BoardPage = lazy(() => import("../pages/BoardPage").then((module) => ({ default: module.BoardPage })));
const DrawingManagementPage = lazy(() => import("../pages/DrawingManagementPage").then((module) => ({ default: module.DrawingManagementPage })));
const EquipmentManagementPage = lazy(() => import("../pages/EquipmentManagementPage").then((module) => ({ default: module.EquipmentManagementPage })));
const EmployeeManagementPage = lazy(() => import("../pages/EmployeeManagementPage").then((module) => ({ default: module.EmployeeManagementPage })));
const GlobalSearchPage = lazy(() => import("../pages/GlobalSearchPage").then((module) => ({ default: module.GlobalSearchPage })));
const NoticePage = lazy(() => import("../pages/NoticePage").then((module) => ({ default: module.NoticePage })));
const PlannedFeaturePage = lazy(() => import("../pages/PlannedFeaturePage").then((module) => ({ default: module.PlannedFeaturePage })));
const NotificationPage = lazy(() => import("../pages/NotificationPage").then((module) => ({ default: module.NotificationPage })));
const OrganizationPage = lazy(() => import("../pages/OrganizationPage").then((module) => ({ default: module.OrganizationPage })));

type GlobalSearchState = {
  keyword: string;
  setKeyword: (keyword: string) => void;
  result: GlobalSearchResponse | null;
  loading: boolean;
  error: string;
  selectedTypes: string[];
  toggleType: (type: string) => void;
  status: string;
  setStatus: (status: string) => void;
  total: number;
  target: GlobalSearchTarget | null;
  submit: () => void;
  openItem: (item: GlobalSearchItem, keyword: string) => void;
  clear: () => void;
};

type AppRouteContentProps = {
  route: Route;
  user: User;
  isAdmin: boolean;
  canViewPreview: boolean;
  approvalLaunch: ApprovalLaunch | null;
  plannedFeatureCode: string | null;
  globalSearch: GlobalSearchState;
  navigate: (route: Route) => void;
  openApprovals: (target?: ApprovalLaunch) => void;
};

export function AppRouteContent({ route, user, isAdmin, canViewPreview, approvalLaunch, plannedFeatureCode, globalSearch, navigate, openApprovals }: AppRouteContentProps) {
  return (
    <main className="content">
      <Suspense fallback={<div className="route-loading" role="status">화면을 불러오는 중입니다…</div>}>
        {route === "search" && <GlobalSearchPage keyword={globalSearch.keyword} setKeyword={globalSearch.setKeyword} result={globalSearch.result} loading={globalSearch.loading} error={globalSearch.error} total={globalSearch.total} onSubmit={globalSearch.submit} onOpen={globalSearch.openItem} onClear={globalSearch.clear} selectedTypes={globalSearch.selectedTypes} onToggleType={globalSearch.toggleType} status={globalSearch.status} onStatusChange={globalSearch.setStatus} />}
        {route === "dashboard" && <DashboardPage user={user} go={navigate} openApprovals={openApprovals} />}
        {route === "adminDashboard" && (canAccessAdminPortal(user) ? <AdminPortalPage user={user} go={navigate} /> : <AccessDenied />)}
        {route === "notices" && <NoticePage user={user} target={globalSearch.target} />}
        {route === "boards" && <BoardPage user={user} target={globalSearch.target} />}
        {route === "approvals" && <ApprovalPage key="employee-approvals" user={user} launch={approvalLaunch} target={globalSearch.target} portal="employee" />}
        {route === "approvalAdmin" && (canManageApproval(user) ? <ApprovalPage key="admin-approvals" user={user} launch={null} target={globalSearch.target} portal="admin" /> : <AccessDenied />)}
        {route === "pdm" && (canViewPreview ? <DrawingManagementPage user={user} openApprovals={openApprovals} target={globalSearch.target} /> : <AccessDenied />)}
        {route === "equipment" && (canViewPreview ? <EquipmentManagementPage user={user} isAdmin={isAdmin} /> : <AccessDenied />)}
        {route === "plannedFeature" && (canViewPlannedFeatures(user) ? <PlannedFeaturePage featureCode={plannedFeatureCode} onBack={() => navigate("dashboard")} /> : <AccessDenied />)}
        {route === "notifications" && <NotificationPage go={navigate} target={globalSearch.target} />}
        {route === "organization" && <OrganizationPage target={globalSearch.target} />}
        {route === "employees" && ((user.permissions.includes("EMPLOYEE_ADMIN") || user.permissions.includes("WORK_CATEGORY_ADMIN") || user.permissions.includes("ACCOUNT_ADMIN") || user.permissions.includes("WORK_REQUEST_ADMIN")) ? <EmployeeManagementPage user={user} /> : <AccessDenied />)}
        {route === "audit" && (isAdmin ? <AuditLogPage target={globalSearch.target} /> : <AccessDenied />)}
      </Suspense>
    </main>
  );
}
