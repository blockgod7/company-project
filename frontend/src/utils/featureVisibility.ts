import type { User } from "../types";

const PREVIEW_MANAGER_LOGIN_IDS = new Set(["e0015"]);

export function canViewPreviewFeatures(user: User | null | undefined) {
  if (!user) return false;
  return user.roleCode === "ADMIN" || PREVIEW_MANAGER_LOGIN_IDS.has(user.loginId.toLowerCase());
}

export function isPreviewOnlyRoute(route: string) {
  return route === "pdm" || route === "equipment";
}
