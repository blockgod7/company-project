import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { GlobalSearchItem, GlobalSearchResponse } from "../types";
import type { Route } from "../utils/approvalDomain";
import type { GlobalSearchTarget } from "../utils/search";

type UseGlobalSearchOptions = {
  clearApprovalLaunch: () => void;
  navigateToRoute: (route: Route) => void;
  navigateToItem: (item: GlobalSearchItem) => void;
};

export const GLOBAL_SEARCH_TYPES = ["menus", "departments", "employees", "notices", "boards", "approvals"] as const;

export function useGlobalSearch({ clearApprovalLaunch, navigateToRoute, navigateToItem }: UseGlobalSearchOptions) {
  const [target, setTarget] = useState<GlobalSearchTarget | null>(null);
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...GLOBAL_SEARCH_TYPES]);
  const [status, updateStatus] = useState("ALL");
  const requestId = useRef(0);
  const pendingRequest = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestId.current += 1;
    pendingRequest.current?.abort();
  }, []);

  const total = useMemo(
    () => result?.groups.reduce((sum, group) => sum + group.totalCount, 0) ?? 0,
    [result]
  );

  function resetTarget() {
    setTarget(null);
  }

  function openItem(item: GlobalSearchItem, itemKeyword: string) {
    clearApprovalLaunch();
    setTarget({
      type: item.type,
      targetId: item.targetId,
      parentId: item.parentId,
      keyword: itemKeyword,
      nonce: Date.now()
    });
    navigateToItem(item);
  }

  function resetResults() {
    requestId.current += 1;
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    setResult(null);
    setError("");
    setLoading(false);
  }

  async function search(types: string[], nextStatus: string) {
    resetResults();
    const trimmedKeyword = keyword.trim();
    if (trimmedKeyword.length < 2) {
      setError("검색어는 2글자 이상 입력해 주세요.");
      return;
    }
    if (!types.length) {
      setError("검색할 자료 종류를 하나 이상 선택해 주세요.");
      return;
    }
    const currentRequest = requestId.current;
    const controller = new AbortController();
    pendingRequest.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams({ keyword: trimmedKeyword, limit: "10", status: nextStatus });
      types.forEach((type) => params.append("types", type));
      const response = await api<GlobalSearchResponse>(`/global-search?${params.toString()}`, { signal: controller.signal });
      if (currentRequest === requestId.current) setResult(response);
    } catch (err) {
      if (currentRequest === requestId.current) {
        setError(err instanceof Error ? err.message : "통합검색 중 오류가 발생했습니다.");
      }
    } finally {
      if (currentRequest === requestId.current) {
        pendingRequest.current = null;
        setLoading(false);
      }
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    navigateToRoute("search");
    await search(selectedTypes, status);
  }

  function clear() {
    setKeyword("");
    resetResults();
  }

  function applyFilters(types: string[], nextStatus: string) {
    if (keyword.trim()) void search(types, nextStatus);
    else resetResults();
  }

  function toggleType(type: string) {
    const nextTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((item) => item !== type)
      : [...selectedTypes, type];
    setSelectedTypes(nextTypes);
    applyFilters(nextTypes, status);
  }

  function setStatus(nextStatus: string) {
    updateStatus(nextStatus);
    applyFilters(selectedTypes, nextStatus);
  }

  return {
    target,
    keyword,
    setKeyword,
    result,
    loading,
    error,
    selectedTypes,
    toggleType,
    status,
    setStatus,
    total,
    resetTarget,
    openItem,
    submit,
    clear
  };
}
