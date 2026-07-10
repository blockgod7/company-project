import type { FormEvent } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardCheck,
  FolderKanban,
  MessageSquare,
  Search,
  Shield,
  X
} from "lucide-react";
import type { GlobalSearchItem, GlobalSearchResponse } from "../types";

type GlobalSearchPageProps = {
  keyword: string;
  setKeyword: (keyword: string) => void;
  result: GlobalSearchResponse | null;
  loading: boolean;
  error: string;
  total: number;
  onSubmit: (event?: FormEvent) => void;
  onOpen: (item: GlobalSearchItem, keyword: string) => void;
  onClear: () => void;
};

export function GlobalSearchPage({
  keyword,
  setKeyword,
  result,
  loading,
  error,
  total,
  onSubmit,
  onOpen,
  onClear
}: GlobalSearchPageProps) {
  function groupIcon(code: string) {
    if (code === "approvals") return ClipboardCheck;
    if (code === "boards") return MessageSquare;
    if (code === "notices") return BookOpen;
    if (code === "pdm") return FolderKanban;
    if (code === "employees") return Building2;
    if (code === "notifications") return Bell;
    if (code === "audit") return Shield;
    return Search;
  }

  return (
    <section className="search-page">
      <div className="search-page-head">
        <span>전역 검색</span>
        <form className="search-page-form" onSubmit={onSubmit}>
          <Search size={22} />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="김민수, 도면번호, 문서제목 검색" />
          {keyword && (
            <button className="search-clear" type="button" onClick={onClear} title="검색어 지우기">
              <X size={20} />
            </button>
          )}
          <button className="search-page-submit" type="submit" disabled={loading}>{loading ? "검색 중" : "검색"}</button>
        </form>
      </div>

      <div className="search-page-toolbar">
        <strong>전체 결과 <b>{total}</b>건</strong>
        <select defaultValue="relevance" aria-label="정렬">
          <option value="relevance">정확도순</option>
          <option value="latest">최신순</option>
        </select>
      </div>

      {error && <p className="global-search-error">{error}</p>}

      {result ? (
        result.groups.length ? (
          <div className="search-result-stack">
            {result.groups.map((group) => {
              const Icon = groupIcon(group.code);
              return (
                <section className="search-result-section" key={group.code}>
                  <div className="search-result-head">
                    <div>
                      <Icon size={21} />
                      <strong>{group.label}</strong>
                      <span>{group.totalCount}건</span>
                    </div>
                    <small>권한 내 결과</small>
                  </div>
                  <div className="search-result-list">
                    {group.items.map((item) => (
                      <button className="search-result-row" key={`${item.type}-${item.targetId}`} type="button" onClick={() => onOpen(item, result.keyword)}>
                        <span className="search-result-title">{item.title}</span>
                        <span className="search-result-meta">{item.meta || item.summary || "관련 정보"}</span>
                        <span className="search-result-date">작성일 {item.occurredAt ? formatDate(item.occurredAt) : "-"}</span>
                        <span className="search-result-badges">
                          {item.badges.slice(0, 3).map((badge) => <em key={badge}>{badge}</em>)}
                        </span>
                        <span className="search-result-open">상세로 이동 <ChevronRight size={17} /></span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <SearchEmpty text="검색 결과가 없습니다." />
        )
      ) : (
        <SearchEmpty text="검색어를 입력하면 권한이 있는 항목만 표시됩니다." />
      )}
    </section>
  );
}

function SearchEmpty({ text = "데이터가 없습니다." }) {
  return <div className="empty">{text}</div>;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}
