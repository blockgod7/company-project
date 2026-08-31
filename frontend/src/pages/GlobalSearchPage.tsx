import type { FormEvent } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardCheck,
  FolderKanban,
  LayoutGrid,
  MessageSquare,
  Search,
  Users,
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
  selectedTypes: string[];
  onToggleType: (type: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
};

const SEARCH_TYPE_OPTIONS = [
  ["menus", "메뉴"],
  ["departments", "부서"],
  ["employees", "직원"],
  ["notices", "공지"],
  ["boards", "게시글"],
  ["approvals", "결재·휴가"]
] as const;

export function GlobalSearchPage({
  keyword,
  setKeyword,
  result,
  loading,
  error,
  total,
  onSubmit,
  onOpen,
  onClear,
  selectedTypes,
  onToggleType,
  status,
  onStatusChange
}: GlobalSearchPageProps) {
  function groupIcon(code: string) {
    if (code === "menus") return LayoutGrid;
    if (code === "departments") return Building2;
    if (code === "employees") return Users;
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
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 문서제목 검색" />
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
        <select value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="상태 필터">
          <option value="ALL">모든 상태</option>
          <option value="IN_PROGRESS">진행 중</option>
          <option value="APPROVED">승인 완료</option>
          <option value="REJECTED">반려</option>
          <option value="ACTIVE">재직·사용 중</option>
          <option value="PLANNED">예정 기능</option>
        </select>
      </div>

      <div className="search-type-filters" aria-label="자료 종류 필터">
        {SEARCH_TYPE_OPTIONS.map(([code, label]) => (
          <button key={code} type="button" className={selectedTypes.includes(code) ? "active" : ""} onClick={() => onToggleType(code)}>
            {label}
          </button>
        ))}
        <small>필터 변경 후 검색 버튼을 눌러 적용하세요.</small>
      </div>

      {error && <p className="global-search-error">{error}</p>}
      {result && result.failedProviders.length > 0 && (
        <p className="global-search-warning">일부 검색 영역을 불러오지 못했습니다: {result.failedProviders.join(", ")}</p>
      )}

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
