import type { GlobalSearchItem, User } from "./types";
import type { Route } from "./utils/approvalDomain";
import type { GlobalSearchTarget } from "./utils/search";

export type PortalMode = "employee" | "admin";

type NavigationMatch = {
  route: Route;
  portal: PortalMode;
  target: GlobalSearchTarget | null;
  canonicalPath: string;
};

const routePaths: Record<Route, string> = {
  dashboard: "/portal/employee/home",
  adminDashboard: "/portal/admin/home",
  approvalAdmin: "/portal/admin/approvals",
  search: "/portal/employee/search",
  notices: "/portal/employee/notices",
  boards: "/portal/employee/boards",
  approvals: "/portal/employee/approvals",
  pdm: "/portal/employee/pdm",
  equipment: "/portal/employee/equipment",
  plannedFeature: "/planned-features",
  notifications: "/portal/employee/notifications",
  organization: "/portal/employee/organization",
  employees: "/portal/admin/employees",
  audit: "/portal/admin/audit-logs"
};

const legacyPaths: Record<string, Route> = {
  "/": "dashboard",
  "/home": "dashboard",
  "/admin": "adminDashboard",
  "/admin/approvals": "approvalAdmin",
  "/notices": "notices",
  "/boards": "boards",
  "/approvals": "approvals",
  "/pdm": "pdm",
  "/equipment": "equipment",
  "/notifications": "notifications",
  "/organization": "organization",
  "/admin/employees": "employees",
  "/admin/audit-logs": "audit"
};

const adminPermissionCodes = new Set([
  "FULL_ADMIN",
  "LEAVE_ADMIN",
  "LEAVE_POLICY_ADMIN",
  "EMPLOYEE_ADMIN",
  "WORK_CATEGORY_ADMIN",
  "ACCOUNT_ADMIN"
]);

export function pathForRoute(route: Route) {
  return routePaths[route];
}

export function portalForRoute(route: Route): PortalMode {
  return route === "adminDashboard" || route === "approvalAdmin" || route === "employees" || route === "audit" ? "admin" : "employee";
}

export function canManageApproval(user: User) {
  return user.roleCode === "ADMIN"
    || user.roleCode === "APPROVAL_ADMIN"
    || user.permissions.includes("FULL_ADMIN")
    || user.permissions.includes("LEAVE_ADMIN")
    || user.permissions.includes("LEAVE_POLICY_ADMIN");
}

export function canAccessAdminPortal(user: User) {
  return canManageApproval(user)
    || user.roleCode === "AUDIT_ADMIN"
    || user.permissions.some((permission) => adminPermissionCodes.has(permission));
}

export function canViewPlannedFeatures(user: User) {
  return user.roleCode === "ADMIN" || user.permissions.includes("FULL_ADMIN");
}

function target(type: GlobalSearchItem["type"], targetId: number, parentId: number | null = null): GlobalSearchTarget {
  return { type, targetId, parentId, keyword: "", nonce: targetId };
}

function dynamicMatch(pathname: string): NavigationMatch | null {
  if (/^\/planned-features\/[A-Z0-9_-]+\/?$/i.test(pathname)) {
    return { route: "plannedFeature", portal: "employee", target: null, canonicalPath: pathname };
  }
  const patterns: Array<{
    expression: RegExp;
    route: Route;
    portal: PortalMode;
    type: GlobalSearchItem["type"];
    parentFromMatch?: boolean;
  }> = [
    { expression: /^\/portal\/employee\/approvals\/(\d+)\/?$/, route: "approvals", portal: "employee", type: "APPROVAL" },
    { expression: /^\/portal\/admin\/approvals\/(\d+)\/?$/, route: "approvalAdmin", portal: "admin", type: "APPROVAL" },
    { expression: /^\/portal\/employee\/boards\/(\d+)\/?$/, route: "boards", portal: "employee", type: "BOARD_POST" },
    { expression: /^\/portal\/employee\/notices\/(\d+)\/?$/, route: "notices", portal: "employee", type: "NOTICE" },
    { expression: /^\/portal\/employee\/pdm\/drawings\/(\d+)\/?$/, route: "pdm", portal: "employee", type: "PDM_DRAWING" },
    { expression: /^\/portal\/employee\/organization\/employees\/(\d+)\/?$/, route: "organization", portal: "employee", type: "EMPLOYEE" },
    { expression: /^\/portal\/employee\/notifications\/(\d+)\/?$/, route: "notifications", portal: "employee", type: "NOTIFICATION" },
    { expression: /^\/portal\/admin\/audit-logs\/(\d+)\/?$/, route: "audit", portal: "admin", type: "AUDIT_LOG" }
  ];

  for (const pattern of patterns) {
    const match = pathname.match(pattern.expression);
    if (match) {
      return {
        route: pattern.route,
        portal: pattern.portal,
        target: target(pattern.type, Number(match[1])),
        canonicalPath: pathname
      };
    }
  }
  return null;
}

export function matchNavigation(pathname: string): NavigationMatch | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const dynamic = dynamicMatch(normalized);
  if (dynamic) return dynamic;

  const exact = (Object.entries(routePaths) as Array<[Route, string]>).find(([, path]) => path === normalized);
  if (exact) {
    return {
      route: exact[0],
      portal: portalForRoute(exact[0]),
      target: null,
      canonicalPath: exact[1]
    };
  }

  const legacyRoute = legacyPaths[normalized];
  if (legacyRoute) {
    return {
      route: legacyRoute,
      portal: portalForRoute(legacyRoute),
      target: null,
      canonicalPath: pathForRoute(legacyRoute)
    };
  }
  return null;
}

export function pathForSearchItem(item: GlobalSearchItem) {
  if (item.destinationPath) return item.destinationPath;
  switch (item.type) {
    case "APPROVAL": return `/portal/employee/approvals/${item.targetId}`;
    case "BOARD_POST": return `/portal/employee/boards/${item.targetId}`;
    case "NOTICE": return `/portal/employee/notices/${item.targetId}`;
    case "PDM_DRAWING": return `/portal/employee/pdm/drawings/${item.targetId}`;
    case "EMPLOYEE": return `/portal/employee/organization/employees/${item.targetId}`;
    case "DEPARTMENT": return `/portal/employee/organization?deptId=${item.targetId}`;
    case "MENU": return pathForRoute("dashboard");
    case "NOTIFICATION": return `/portal/employee/notifications/${item.targetId}`;
    case "AUDIT_LOG": return `/portal/admin/audit-logs/${item.targetId}`;
  }
}
