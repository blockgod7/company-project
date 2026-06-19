import type { ApiResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";
export { API_BASE };

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string | null) {
    super(message);
  }
}

export function getAccessToken() {
  return localStorage.getItem("accessToken");
}

export function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
};

let refreshRequest: Promise<boolean> | null = null;

function notifySessionExpired() {
  clearTokens();
  window.dispatchEvent(new Event("session-expired"));
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshRequest ??= fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  })
    .then(async (response) => {
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? ((await response.json()) as ApiResponse<TokenResponse>)
        : null;
      if (!response.ok || !payload?.success || !payload.data) return false;
      setTokens(payload.data.accessToken, payload.data.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshRequest = null;
    });

  return refreshRequest;
}

function shouldRefresh(path: string) {
  return path !== "/auth/login" && path !== "/auth/refresh";
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as ApiResponse<T>)
    : null;

  if (response.status === 401 && shouldRefresh(path) && !retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return api<T>(path, init, true);
    notifySessionExpired();
  } else if (response.status === 401 && shouldRefresh(path)) {
    notifySessionExpired();
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(response.status, payload?.message ?? "요청 처리 중 오류가 발생했습니다.", payload?.code);
  }
  return payload.data;
}

export async function authenticatedFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401 && shouldRefresh(path) && !retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return authenticatedFetch(path, init, true);
    notifySessionExpired();
  } else if (response.status === 401 && shouldRefresh(path)) {
    notifySessionExpired();
  }
  return response;
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}
