import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, clearTokens, setTokens } from "./api";
import { AppRouteContent } from "./components/AppRouteContent";
import { AppShell } from "./components/AppShell";
import { RouteNotFound } from "./components/RouteNotFound";
import { useGlobalSearch } from "./hooks/useGlobalSearch";
import {
  canAccessAdminPortal,
  canViewPlannedFeatures,
  matchNavigation,
  pathForRoute,
  pathForSearchItem
} from "./navigation";
import { LoginPage } from "./pages/LoginPage";
import { PasswordChangePage } from "./pages/PasswordChangePage";
import type { User } from "./types";
import type { ApprovalLaunch, Route } from "./utils/approvalDomain";

type AuthStatus = "checking" | "authenticated" | "anonymous";

function App() {
  const location = useLocation();
  const navigateUrl = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [approvalLaunch, setApprovalLaunch] = useState<ApprovalLaunch | null>(null);
  const [message, setMessage] = useState("");
  const navigation = useMemo(() => matchNavigation(location.pathname), [location.pathname]);
  const plannedFeatureCode = location.pathname.match(/^\/planned-features\/([A-Z0-9_-]+)\/?$/i)?.[1] ?? null;
  const route = navigation?.route ?? "dashboard";
  const isAdmin = user?.roleCode === "ADMIN";
  const canViewPreview = user ? canViewPlannedFeatures(user) : false;
  const canUseAdminPortal = user ? canAccessAdminPortal(user) : false;
  const globalSearch = useGlobalSearch({
    clearApprovalLaunch: () => setApprovalLaunch(null),
    navigateToRoute: (nextRoute) => navigateUrl(pathForRoute(nextRoute)),
    navigateToItem: (item) => navigateUrl(pathForSearchItem(item))
  });

  async function loadMe() {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      setAuthStatus("authenticated");
    } catch {
      clearTokens();
      setUser(null);
      setAuthStatus("anonymous");
    }
  }

  useEffect(() => {
    if (localStorage.getItem("accessToken")) {
      void loadMe();
    } else {
      setAuthStatus("anonymous");
    }
    const expire = () => {
      setMessage("세션이 만료되었습니다. 다시 로그인해 주세요.");
      setUser(null);
      setAuthStatus("anonymous");
      setApprovalLaunch(null);
      navigateUrl("/login", { replace: true });
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, [navigateUrl]);

  useEffect(() => {
    if (authStatus === "anonymous" && location.pathname !== "/login") {
      navigateUrl("/login", {
        replace: true,
        state: { from: `${location.pathname}${location.search}` }
      });
      return;
    }
    if (authStatus !== "authenticated") return;
    if (location.pathname === "/login") {
      const requested = (location.state as { from?: string } | null)?.from;
      navigateUrl(requested || pathForRoute("dashboard"), { replace: true });
      return;
    }
    if (navigation && navigation.canonicalPath !== location.pathname) {
      navigateUrl(navigation.canonicalPath, { replace: true });
    }
  }, [authStatus, location.pathname, location.search, navigateUrl, navigation]);

  function logout() {
    void api<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearTokens();
    setUser(null);
    setAuthStatus("anonymous");
    setApprovalLaunch(null);
    globalSearch.resetTarget();
    navigateUrl("/login", { replace: true });
  }

  function navigate(nextRoute: Route) {
    if (nextRoute !== "approvals") {
      setApprovalLaunch(null);
    }
    globalSearch.resetTarget();
    navigateUrl(pathForRoute(nextRoute));
  }

  function openApprovals(target?: ApprovalLaunch) {
    setApprovalLaunch(target ?? null);
    globalSearch.resetTarget();
    navigateUrl(pathForRoute("approvals"));
  }

  if (authStatus === "checking") {
    return <div className="route-loading" role="status">인증 상태를 확인하고 있습니다.</div>;
  }

  if (authStatus === "anonymous" || !user) {
    return (
      <LoginPage
        onLogin={(login) => {
          setTokens(login.accessToken);
          setUser(login);
          setAuthStatus("authenticated");
          setMessage("");
          const requested = (location.state as { from?: string } | null)?.from;
          navigateUrl(requested || pathForRoute("dashboard"), { replace: true });
        }}
        message={message}
      />
    );
  }

  if (user.mustChangePassword) {
    return <PasswordChangePage empName={user.empName} onChanged={() => setUser({ ...user, mustChangePassword: false })} onLogout={logout} />;
  }

  if (navigation?.portal === "admin" && !canUseAdminPortal) {
    return <Navigate to={pathForRoute("dashboard")} replace />;
  }

  return (
    <AppShell
      user={user}
      route={route}
      canUseAdminPortal={canUseAdminPortal}
      portal={navigation?.portal ?? "employee"}
      currentPath={location.pathname}
      searchKeyword={globalSearch.keyword}
      searchLoading={globalSearch.loading}
      onSearchKeywordChange={globalSearch.setKeyword}
      onSearchSubmit={globalSearch.submit}
      onNavigate={navigate}
      onNavigatePath={(path) => navigateUrl(path)}
      onLogout={logout}
    >
      {navigation ? (
        <AppRouteContent
          route={route}
          user={user}
          isAdmin={isAdmin}
          canViewPreview={canViewPreview}
          approvalLaunch={approvalLaunch}
          plannedFeatureCode={plannedFeatureCode}
          globalSearch={{ ...globalSearch, target: navigation.target ?? globalSearch.target }}
          navigate={navigate}
          openApprovals={openApprovals}
        />
      ) : (
        <RouteNotFound onHome={() => navigate("dashboard")} />
      )}
    </AppShell>
  );
}

export default App;
