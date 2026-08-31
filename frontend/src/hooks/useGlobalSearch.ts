import { FormEvent, useMemo, useState } from "react";
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
  const [status, setStatus] = useState("ALL");

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

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmedKeyword = keyword.trim();
    setError("");
    navigateToRoute("search");
    if (trimmedKeyword.length < 2) {
      setResult(null);
      setError("검색어는 2글자 이상 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ keyword: trimmedKeyword, limit: "10", status });
      selectedTypes.forEach((type) => params.append("types", type));
      setResult(await api<GlobalSearchResponse>(`/global-search?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "통합검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setKeyword("");
    setResult(null);
    setError("");
  }

  function toggleType(type: string) {
    setSelectedTypes((current) => current.includes(type)
      ? current.length === 1 ? current : current.filter((item) => item !== type)
      : [...current, type]);
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
