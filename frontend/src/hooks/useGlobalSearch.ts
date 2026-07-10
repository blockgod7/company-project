import { FormEvent, useMemo, useState } from "react";
import { api } from "../api";
import type { GlobalSearchItem, GlobalSearchResponse } from "../types";
import type { Route } from "../utils/approvalDomain";
import type { GlobalSearchTarget } from "../utils/search";

type UseGlobalSearchOptions = {
  clearApprovalLaunch: () => void;
  setRoute: (route: Route) => void;
};

export function useGlobalSearch({ clearApprovalLaunch, setRoute }: UseGlobalSearchOptions) {
  const [target, setTarget] = useState<GlobalSearchTarget | null>(null);
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setRoute(item.route);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmedKeyword = keyword.trim();
    setError("");
    setRoute("search");
    if (trimmedKeyword.length < 2) {
      setResult(null);
      setError("寃?됱뼱??2湲???댁긽 ?낅젰??二쇱꽭??");
      return;
    }
    setLoading(true);
    try {
      const searchResult = await api<GlobalSearchResponse>(`/global-search?keyword=${encodeURIComponent(trimmedKeyword)}&limit=20`);
      setResult(searchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "?꾩뿭 寃??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setKeyword("");
    setResult(null);
    setError("");
  }

  return {
    target,
    keyword,
    setKeyword,
    result,
    loading,
    error,
    total,
    resetTarget,
    openItem,
    submit,
    clear
  };
}
