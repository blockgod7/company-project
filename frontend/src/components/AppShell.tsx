import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  Circle,
  ClipboardCheck,
  FolderKanban,
  Home,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  ScrollText,
  Search,
  Settings2,
  Shield,
  UserCog,
  UserRound,
  Wrench,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import schunkLogo from "../assets/schunk-carbon-logo.png";
import { useEffectiveMenus } from "../hooks/useEffectiveMenus";
import type { PortalMode } from "../navigation";
import type { EffectiveMenu, User } from "../types";
import { routeLabels, type Route } from "../utils/approvalDomain";
import { MenuSettingsDialog } from "./MenuSettingsDialog";

const menuIcons: Record<string, LucideIcon> = {
  home: Home,
  "book-open": BookOpen,
  "message-square": MessageSquare,
  "clipboard-check": ClipboardCheck,
  "folder-kanban": FolderKanban,
  wrench: Wrench,
  "building-2": Building2,
  bell: Bell,
  shield: Shield,
  "user-cog": UserCog,
  "scroll-text": ScrollText
};

type AppShellProps = {
  user: User;
  route: Route;
  portal: PortalMode;
  currentPath: string;
  canUseAdminPortal: boolean;
  searchKeyword: string;
  searchLoading: boolean;
  onSearchKeywordChange: (keyword: string) => void;
  onSearchSubmit: (event?: FormEvent) => void;
  onNavigate: (route: Route) => void;
  onNavigatePath: (path: string) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({
  user,
  route,
  portal,
  currentPath,
  canUseAdminPortal,
  searchKeyword,
  searchLoading,
  onSearchKeywordChange,
  onSearchSubmit,
  onNavigate,
  onNavigatePath,
  onLogout,
  children
}: AppShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [portalSwitcherOpen, setPortalSwitcherOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const portalSwitcherRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const effectiveMenus = useEffectiveMenus(user.empId, portal);
  const visibleMenus = effectiveMenus.menus.filter((item) => !item.hidden);
  const isMenuActive = (item: EffectiveMenu) => item.menuPath != null
    && (currentPath === item.menuPath || currentPath.startsWith(`${item.menuPath}/`));
  const activeMenu = visibleMenus.find(isMenuActive);
  const pinnedMenus = visibleMenus.filter((item) => item.pinned);
  const compactBase = [...pinnedMenus, ...visibleMenus.filter((item) => !item.pinned)].slice(0, 4);
  const compactMenus = activeMenu && !compactBase.some((item) => item.menuCode === activeMenu.menuCode)
    ? [...compactBase.slice(0, 3), activeMenu]
    : compactBase;
  const overflowMenus = visibleMenus.filter((item) => !compactMenus.some((compact) => compact.menuCode === item.menuCode));

  useEffect(() => {
    if (!portalSwitcherOpen) return;
    function closePortalSwitcher(event: MouseEvent) {
      if (!portalSwitcherRef.current?.contains(event.target as Node)) setPortalSwitcherOpen(false);
    }
    function closePortalSwitcherOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPortalSwitcherOpen(false);
    }
    document.addEventListener("mousedown", closePortalSwitcher);
    document.addEventListener("keydown", closePortalSwitcherOnEscape);
    return () => {
      document.removeEventListener("mousedown", closePortalSwitcher);
      document.removeEventListener("keydown", closePortalSwitcherOnEscape);
    };
  }, [portalSwitcherOpen]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    function closeMoreMenu(event: MouseEvent) {
      if (!moreMenuRef.current?.contains(event.target as Node)) setMoreMenuOpen(false);
    }
    function closeMoreMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMoreMenu);
    document.addEventListener("keydown", closeMoreMenuOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMoreMenu);
      document.removeEventListener("keydown", closeMoreMenuOnEscape);
    };
  }, [moreMenuOpen]);

  function renderMenuButton(item: EffectiveMenu, closeOverflow = false) {
    const Icon = menuIcons[item.iconKey ?? ""] ?? Circle;
    return (
      <button
        key={item.menuCode}
        className={isMenuActive(item) ? "side active" : "side"}
        aria-current={isMenuActive(item) ? "page" : undefined}
        title={item.menuName}
        onClick={() => {
          if (closeOverflow) setMoreMenuOpen(false);
          if (item.menuPath) onNavigatePath(item.menuPath);
        }}
        disabled={!item.menuPath}
      >
        <Icon size={19} />
        <span>{item.menuName}</span>
        {item.implementationStatus === "PLANNED" && <small>예정</small>}
      </button>
    );
  }

  function switchPortal(nextPortal: PortalMode) {
    setPortalSwitcherOpen(false);
    onNavigate(nextPortal === "employee" ? "dashboard" : "adminDashboard");
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
        <div className="sidebar-personal-zone">
          <div className="profile">
            <div className="avatar"><UserRound size={38} /></div>
            <strong title={user.empName}>{user.empName}</strong>
            <span title={`${user.deptName ?? "소속 미정"} · ${user.roleCode}`}>{user.deptName ?? "소속 미정"} · {user.roleCode}</span>
          </div>
          <button
            type="button"
            className={route === "calendar" ? "personal-calendar-link active" : "personal-calendar-link"}
            aria-current={route === "calendar" ? "page" : undefined}
            title="개인 캘린더 상세보기"
            onClick={() => onNavigate("calendar")}
          >
            <CalendarDays size={21} />
            <span>개인 캘린더</span>
          </button>
        </div>
        <nav className="side-nav" aria-label="주요 메뉴">
          {effectiveMenus.loading && <span className="side-nav-status">메뉴 불러오는 중</span>}
          {!effectiveMenus.loading && visibleMenus.length > 0 && (
            <>
              <div className="side-nav-desktop">
                {visibleMenus.map((item) => renderMenuButton(item))}
                <button type="button" className="side menu-settings-trigger" onClick={() => setSettingsOpen(true)}>
                  <Settings2 size={19} /> <span>메뉴 설정</span>
                </button>
              </div>
              <div className="side-nav-compact">
                <div className="compact-primary-menus">
                  {compactMenus.map((item) => renderMenuButton(item))}
                </div>
                <div className="compact-overflow" ref={moreMenuRef}>
                  <button
                    type="button"
                    className="side compact-more-trigger"
                    aria-haspopup="menu"
                    aria-expanded={moreMenuOpen}
                    onClick={() => setMoreMenuOpen((open) => !open)}
                  >
                    <MoreHorizontal size={19} /><span>더보기</span>
                  </button>
                  {moreMenuOpen && (
                    <div className="compact-overflow-menu" role="menu" aria-label="추가 메뉴">
                      {overflowMenus.map((item) => renderMenuButton(item, true))}
                      <button type="button" className="side menu-settings-trigger" onClick={() => {
                        setMoreMenuOpen(false);
                        setSettingsOpen(true);
                      }}>
                        <Settings2 size={19} /> <span>메뉴 설정</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {!effectiveMenus.loading && !effectiveMenus.error && visibleMenus.length === 0 && (
            <span className="side-nav-status">표시할 메뉴가 없습니다. 메뉴 설정에서 숨김을 해제해 주세요.</span>
          )}
          {effectiveMenus.error && (
            <span className="side-nav-error">메뉴를 불러오지 못했습니다.<small>{effectiveMenus.error}</small></span>
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
            {canUseAdminPortal && (
              <div className="portal-switcher" ref={portalSwitcherRef}>
                <button
                  type="button"
                  className="portal-current"
                  aria-haspopup="menu"
                  aria-expanded={portalSwitcherOpen}
                  onClick={() => setPortalSwitcherOpen((open) => !open)}
                >
                  {portal === "admin" ? <Shield size={15} /> : <UserRound size={15} />}
                  <span>{portal === "admin" ? "관리자 포털" : "임직원 포털"}</span>
                  <ChevronDown size={14} className={portalSwitcherOpen ? "open" : ""} />
                </button>
                {portalSwitcherOpen && (
                  <div className="portal-dropdown" role="menu" aria-label="포털 선택">
                    <button
                      type="button"
                      role="menuitem"
                      className={portal === "employee" ? "active" : ""}
                      onClick={() => switchPortal("employee")}
                    >
                      <UserRound size={16} />
                      <span><strong>임직원 포털</strong><small>업무 및 사내 서비스</small></span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={portal === "admin" ? "active" : ""}
                      onClick={() => switchPortal("admin")}
                    >
                      <Shield size={16} />
                      <span><strong>관리자 포털</strong><small>권한별 관리 기능</small></span>
                    </button>
                  </div>
                )}
              </div>
            )}
            <span className="userbar-name" title={user.empName}>{user.empName}</span>
            <span className="role">{user.roleCode}</span>
            <button className="icon-button" onClick={onLogout} title="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {children}
      </div>
      <MenuSettingsDialog
        open={settingsOpen}
        menus={effectiveMenus.menus}
        saving={effectiveMenus.saving}
        error={effectiveMenus.error}
        onClose={() => setSettingsOpen(false)}
        onSave={effectiveMenus.updatePreferences}
        onReset={effectiveMenus.resetPreferences}
      />
    </div>
  );
}
