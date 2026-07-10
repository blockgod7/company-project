import { LogOut, Search, Shield, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, clearTokens, setTokens } from "./api";
import schunkLogo from "./assets/schunk-carbon-logo.png";
import { AccessDenied } from "./components/AccessDenied";
import { ApprovalPage } from "./pages/ApprovalPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { BoardPage } from "./pages/BoardPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DrawingManagementPage } from "./pages/DrawingManagementPage";
import { GlobalSearchPage } from "./pages/GlobalSearchPage";
import { LoginPage } from "./pages/LoginPage";
import { NoticePage } from "./pages/NoticePage";
import { NotificationPage } from "./pages/NotificationPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { menu, routeLabels } from "./utils/approvalDomain";
import type { ApprovalLaunch, Route } from "./utils/approvalDomain";
import type { GlobalSearchTarget } from "./utils/search";
import type { GlobalSearchItem, GlobalSearchResponse, User } from "./types";
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [route, setRoute] = useState<Route>("dashboard");
  const [approvalLaunch, setApprovalLaunch] = useState<ApprovalLaunch | null>(null);
  const [globalSearchTarget, setGlobalSearchTarget] = useState<GlobalSearchTarget | null>(null);
  const [globalSearchKeyword, setGlobalSearchKeyword] = useState("");
  const [globalSearchResult, setGlobalSearchResult] = useState<GlobalSearchResponse | null>(null);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState("");
  const [message, setMessage] = useState("");
  const isAdmin = user?.roleCode === "ADMIN";

  async function loadMe() {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    }
  }

  useEffect(() => {
    if (localStorage.getItem("accessToken")) void loadMe();
    const expire = () => {
      setMessage("세션이 만료되었습니다. 다시 로그인해 주세요.");
      setUser(null);
      setRoute("dashboard");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);

  function logout() {
    void api<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearTokens();
    setUser(null);
    setRoute("dashboard");
    setApprovalLaunch(null);
  }

  function navigate(route: Route) {
    if (route !== "approvals") {
      setApprovalLaunch(null);
    }
    setGlobalSearchTarget(null);
    setRoute(route);
  }

  function openApprovals(target?: ApprovalLaunch) {
    setApprovalLaunch(target ?? null);
    setGlobalSearchTarget(null);
    setRoute("approvals");
  }

  function openGlobalSearchItem(item: GlobalSearchItem, keyword: string) {
    setApprovalLaunch(null);
    setGlobalSearchTarget({
      type: item.type,
      targetId: item.targetId,
      parentId: item.parentId,
      keyword,
      nonce: Date.now()
    });
    setRoute(item.route);
  }

  async function submitGlobalSearch(event?: FormEvent) {
    event?.preventDefault();
    const keyword = globalSearchKeyword.trim();
    setGlobalSearchError("");
    setRoute("search");
    if (keyword.length < 2) {
      setGlobalSearchResult(null);
      setGlobalSearchError("검색어는 2글자 이상 입력해 주세요.");
      return;
    }
    setGlobalSearchLoading(true);
    try {
      const result = await api<GlobalSearchResponse>(`/global-search?keyword=${encodeURIComponent(keyword)}&limit=20`);
      setGlobalSearchResult(result);
    } catch (err) {
      setGlobalSearchError(err instanceof Error ? err.message : "전역 검색 중 오류가 발생했습니다.");
    } finally {
      setGlobalSearchLoading(false);
    }
  }

  const globalSearchTotal = globalSearchResult?.groups.reduce((sum, group) => sum + group.totalCount, 0) ?? 0;

  if (!user) {
    return (
      <LoginPage
        onLogin={(login) => {
          setTokens(login.accessToken);
          setUser(login);
          setMessage("");
        }}
        message={message}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="brand-logo" src={schunkLogo} alt="SCHUNK Carbon Technology" />
          <div>
            <strong>슝크카본테크놀로지</strong>
            <span>SCHUNK Groupware</span>
          </div>
        </div>
        <div className="profile">
          <div className="avatar"><UserRound size={38} /></div>
          <strong>{user.empName}</strong>
          <span>{user.deptName ?? "소속 미지정"} · {user.roleCode}</span>
        </div>
        <nav className="side-nav">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.route} className={route === item.route ? "side active" : "side"} onClick={() => navigate(item.route)}>
                <Icon size={19} /> {item.label}
              </button>
            );
          })}
          {isAdmin && (
            <button className={route === "audit" ? "side active" : "side"} onClick={() => navigate("audit")}>
              <Shield size={19} /> 감사 로그
            </button>
          )}
        </nav>
        <button className="logout-link" onClick={logout}>
          <LogOut size={17} /> 로그아웃
        </button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <span>Schunk Carbon Technology Ltd.</span>
            <strong>{routeLabels[route]}</strong>
          </div>
          <div className="topbar-search">
            <form className="topbar-search-form" onSubmit={submitGlobalSearch}>
              <Search size={17} />
              <input
                value={globalSearchKeyword}
                onChange={(event) => setGlobalSearchKeyword(event.target.value)}
                placeholder="김민수, 도면번호, 문서제목 검색"
              />
              <button type="submit" disabled={globalSearchLoading}>{globalSearchLoading ? "검색 중" : "검색"}</button>
            </form>
          </div>
          <div className="userbar">
            <Search size={17} />
            <span>{user.empName}</span>
            <span className="role">{user.roleCode}</span>
            <button className="icon-button" onClick={logout} title="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          {route === "search" && (
            <GlobalSearchPage
              keyword={globalSearchKeyword}
              setKeyword={setGlobalSearchKeyword}
              result={globalSearchResult}
              loading={globalSearchLoading}
              error={globalSearchError}
              total={globalSearchTotal}
              onSubmit={submitGlobalSearch}
              onOpen={openGlobalSearchItem}
              onClear={() => {
                setGlobalSearchKeyword("");
                setGlobalSearchResult(null);
                setGlobalSearchError("");
              }}
            />
          )}
          {route === "dashboard" && <DashboardPage user={user} go={navigate} openApprovals={openApprovals} />}
          {route === "notices" && <NoticePage user={user} target={globalSearchTarget} />}
          {route === "boards" && <BoardPage user={user} target={globalSearchTarget} />}
          {route === "approvals" && <ApprovalPage user={user} launch={approvalLaunch} target={globalSearchTarget} />}
          {route === "pdm" && <DrawingManagementPage user={user} openApprovals={openApprovals} target={globalSearchTarget} />}
          {route === "notifications" && <NotificationPage go={navigate} target={globalSearchTarget} />}
          {route === "organization" && <OrganizationPage target={globalSearchTarget} />}
          {route === "audit" && (isAdmin ? <AuditLogPage target={globalSearchTarget} /> : <AccessDenied />)}
        </main>
      </div>
    </div>
  );
}

export default App;
