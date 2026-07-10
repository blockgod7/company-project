import { useEffect, useState } from "react";
import { api, clearTokens, setTokens } from "./api";
import { AppRouteContent } from "./components/AppRouteContent";
import { AppShell } from "./components/AppShell";
import { useGlobalSearch } from "./hooks/useGlobalSearch";
import { LoginPage } from "./pages/LoginPage";
import type { User } from "./types";
import type { ApprovalLaunch, Route } from "./utils/approvalDomain";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [route, setRoute] = useState<Route>("dashboard");
  const [approvalLaunch, setApprovalLaunch] = useState<ApprovalLaunch | null>(null);
  const [message, setMessage] = useState("");
  const isAdmin = user?.roleCode === "ADMIN";
  const globalSearch = useGlobalSearch({
    clearApprovalLaunch: () => setApprovalLaunch(null),
    setRoute
  });

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
      setMessage("?몄뀡??留뚮즺?섏뿀?듬땲?? ?ㅼ떆 濡쒓렇?명빐 二쇱꽭??");
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
    globalSearch.resetTarget();
  }

  function navigate(nextRoute: Route) {
    if (nextRoute !== "approvals") {
      setApprovalLaunch(null);
    }
    globalSearch.resetTarget();
    setRoute(nextRoute);
  }

  function openApprovals(target?: ApprovalLaunch) {
    setApprovalLaunch(target ?? null);
    globalSearch.resetTarget();
    setRoute("approvals");
  }

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
    <AppShell
      user={user}
      route={route}
      isAdmin={isAdmin}
      searchKeyword={globalSearch.keyword}
      searchLoading={globalSearch.loading}
      onSearchKeywordChange={globalSearch.setKeyword}
      onSearchSubmit={globalSearch.submit}
      onNavigate={navigate}
      onLogout={logout}
    >
      <AppRouteContent
        route={route}
        user={user}
        isAdmin={isAdmin}
        approvalLaunch={approvalLaunch}
        globalSearch={globalSearch}
        navigate={navigate}
        openApprovals={openApprovals}
      />
    </AppShell>
  );
}

export default App;
