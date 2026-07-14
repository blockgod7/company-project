import { AccessDenied } from "./AccessDenied";
import { ApprovalPage } from "../pages/ApprovalPage";
import { AuditLogPage } from "../pages/AuditLogPage";
import { BoardPage } from "../pages/BoardPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DrawingManagementPage } from "../pages/DrawingManagementPage";
import { EquipmentManagementPage } from "../pages/EquipmentManagementPage";
import { GlobalSearchPage } from "../pages/GlobalSearchPage";
import { NoticePage } from "../pages/NoticePage";
import { NotificationPage } from "../pages/NotificationPage";
import { OrganizationPage } from "../pages/OrganizationPage";
import type { GlobalSearchItem, GlobalSearchResponse, User } from "../types";
import type { ApprovalLaunch, Route } from "../utils/approvalDomain";
import type { GlobalSearchTarget } from "../utils/search";

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

export function AppRouteContent({
  route,
  user,
  isAdmin,
  approvalLaunch,
  globalSearch,
  navigate,
  openApprovals
}: AppRouteContentProps) {
  return (
    <main className="content">
      {route === "search" && (
        <GlobalSearchPage
          keyword={globalSearch.keyword}
          setKeyword={globalSearch.setKeyword}
          result={globalSearch.result}
          loading={globalSearch.loading}
          error={globalSearch.error}
          total={globalSearch.total}
          onSubmit={globalSearch.submit}
          onOpen={globalSearch.openItem}
          onClear={globalSearch.clear}
        />
      )}
      {route === "dashboard" && <DashboardPage user={user} go={navigate} openApprovals={openApprovals} />}
      {route === "notices" && <NoticePage user={user} target={globalSearch.target} />}
      {route === "boards" && <BoardPage user={user} target={globalSearch.target} />}
      {route === "approvals" && <ApprovalPage user={user} launch={approvalLaunch} target={globalSearch.target} />}
      {route === "pdm" && <DrawingManagementPage user={user} openApprovals={openApprovals} target={globalSearch.target} />}
      {route === "equipment" && <EquipmentManagementPage user={user} isAdmin={isAdmin} />}
      {route === "notifications" && <NotificationPage go={navigate} target={globalSearch.target} />}
      {route === "organization" && <OrganizationPage target={globalSearch.target} />}
      {route === "audit" && (isAdmin ? <AuditLogPage target={globalSearch.target} /> : <AccessDenied />)}
    </main>
  );
}
