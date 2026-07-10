import type { ReactNode } from "react";
import { ArrowLeft, Eye, Flag, Paperclip, Plus, RefreshCw } from "lucide-react";

export function Toolbar({ title, onNew, onRefresh, beforeRefresh }: { title: string; onNew: () => void; onRefresh?: () => void; beforeRefresh?: ReactNode }) {
  return (
    <div className="toolbar">
      <h3>{title}</h3>
      <div className="toolbar-actions">
        {beforeRefresh}
        {onRefresh && <button className="ghost" onClick={onRefresh}><RefreshCw size={16} /> 새로고침</button>}
        <button onClick={onNew}><Plus size={16} /> 작성</button>
      </div>
    </div>
  );
}

export function ListSummary({ count, text }: { count: number; text: string }) {
  return <div className="list-summary"><strong>{count}</strong><span>{text}</span></div>;
}

export function ContentTable({ rows, pinnedLabel = "고정", metricLabel = "조회수" }: {
  rows: {
    id: number;
    pinned?: boolean;
    title: string;
    writer: string;
    date: string;
    hasAttachment: boolean;
    views: ReactNode;
    onOpen: () => void;
  }[];
  pinnedLabel?: string;
  metricLabel?: string;
}) {
  return (
    <div className="table-wrap">
      <table className="content-table">
        <thead>
          <tr>
            <th className="col-no">번호</th>
            <th>제목</th>
            <th className="col-writer">작성자</th>
            <th className="col-date">작성일</th>
            <th className="col-attach">첨부</th>
            <th className="col-views">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.pinned ? "pinned-row" : ""}>
              <td className="col-no">{row.id}</td>
              <td>
                <button className="title-link" onClick={row.onOpen}>
                  {row.pinned && <span className="pin-label"><Flag size={14} /> {pinnedLabel}</span>}
                  <span>{row.title}</span>
                </button>
              </td>
              <td className="col-writer">{row.writer}</td>
              <td className="col-date">{row.date}</td>
              <td className="col-attach">{row.hasAttachment ? <Paperclip size={16} /> : <span className="dash">-</span>}</td>
              <td className="col-views"><Eye size={15} /> {row.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DetailPage({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="detail-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} /> 목록으로
      </button>
      {children}
    </div>
  );
}

export function TwoPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="two-pane">
      <section className="panel list-pane">{left}</section>
      <section className="panel detail-pane">{right}</section>
    </div>
  );
}
