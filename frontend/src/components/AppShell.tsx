import { LogOut, Search, Shield, UserRound } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import schunkLogo from "../assets/schunk-carbon-logo.png";
import type { User } from "../types";
import { menu, routeLabels, type Route } from "../utils/approvalDomain";

type AppShellProps = {
  user: User;
  route: Route;
  isAdmin: boolean;
  searchKeyword: string;
  searchLoading: boolean;
  onSearchKeywordChange: (keyword: string) => void;
  onSearchSubmit: (event?: FormEvent) => void;
  onNavigate: (route: Route) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({
  user,
  route,
  isAdmin,
  searchKeyword,
  searchLoading,
  onSearchKeywordChange,
  onSearchSubmit,
  onNavigate,
  onLogout,
  children
}: AppShellProps) {
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
          <span>{user.deptName ?? "소속 미정"} · {user.roleCode}</span>
        </div>
        <nav className="side-nav">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.route} className={route === item.route ? "side active" : "side"} onClick={() => onNavigate(item.route)}>
                <Icon size={19} /> {item.label}
              </button>
            );
          })}
          {isAdmin && (
            <button className={route === "audit" ? "side active" : "side"} onClick={() => onNavigate("audit")}>
              <Shield size={19} /> 감사 로그
            </button>
          )}
        </nav>
        <button className="logout-link" onClick={onLogout}>
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
            <form className="topbar-search-form" onSubmit={onSearchSubmit}>
              <Search size={17} />
              <input
                value={searchKeyword}
                onChange={(event) => onSearchKeywordChange(event.target.value)}
                placeholder="이름, 화면번호, 문서제목 검색"
              />
              <button type="submit" disabled={searchLoading}>{searchLoading ? "검색 중" : "검색"}</button>
            </form>
          </div>
          <div className="userbar">
            <Search size={17} />
            <span>{user.empName}</span>
            <span className="role">{user.roleCode}</span>
            <button className="icon-button" onClick={onLogout} title="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
