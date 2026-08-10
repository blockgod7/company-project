import { lazy, Suspense } from "react";
import { AccessDenied } from "./AccessDenied";
import { DashboardPage } from "../pages/DashboardPage";
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
const NotificationPage = lazy(() => import("../pages/NotificationPage").then((module) => ({ default: module.NotificationPage })));
const OrganizationPage = lazy(() => import("../pages/OrganizationPage").then((module) => ({ default: module.OrganizationPage })));

type GlobalSearchState = {
  keyword: string;
  setKeyword: (keyword: string) => void;
  result: GlobalSearchResponse | null;
  loading: boolean;
  error: string;
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
  approvalLaunch: ApprovalLaunch | null;
  globalSearch: GlobalSearchState;
  navigate: (route: Route) => void;
  openApprovals: (target?: ApprovalLaunch) => void;
};

export function AppRouteContent({ route, user, isAdmin, approvalLaunch, globalSearch, navigate, openApprovals }: AppRouteContentProps) {
  return (
    <main className="content">
      <Suspense fallback={<div className="route-loading" role="status">화면을 불러오는 중입니다…</div>}>
        {route === "search" && <GlobalSearchPage keyword={globalSearch.keyword} setKeyword={globalSearch.setKeyword} result={globalSearch.result} loading={globalSearch.loading} error={globalSearch.error} total={globalSearch.total} onSubmit={globalSearch.submit} onOpen={globalSearch.openItem} onClear={globalSearch.clear} />}
        {route === "dashboard" && <DashboardPage user={user} go={navigate} openApprovals={openApprovals} />}
        {route === "notices" && <NoticePage user={user} target={globalSearch.target} />}
        {route === "boards" && <BoardPage user={user} target={globalSearch.target} />}
        {route === "approvals" && <ApprovalPage user={user} launch={approvalLaunch} target={globalSearch.target} />}
        {route === "pdm" && <DrawingManagementPage user={user} openApprovals={openApprovals} target={globalSearch.target} />}
        {route === "equipment" && <EquipmentManagementPage user={user} isAdmin={isAdmin} />}
        {route === "notifications" && <NotificationPage go={navigate} target={globalSearch.target} />}
        {route === "organization" && <OrganizationPage target={globalSearch.target} />}
        {route === "employees" && (user.permissions.includes("EMPLOYEE_ADMIN") ? <EmployeeManagementPage user={user} /> : <AccessDenied />)}
        {route === "audit" && (isAdmin ? <AuditLogPage target={globalSearch.target} /> : <AccessDenied />)}
      </Suspense>
    </main>
  );
}
