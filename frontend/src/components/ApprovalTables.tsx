import { RefreshCw } from "lucide-react";
import { formatDate } from "../utils/date";
import {
  priorityLabel,
  retentionAuditActionLabel,
  stageLabel,
  statusLabel,
  templateName
} from "../utils/approvalLabels";
import type { ApprovalSummary, AuditLog } from "../types";

type TemplateNameOption = {
  code: string;
  name: string;
};

export function ApprovalListTable({ items, templates, onOpen }: { items: ApprovalSummary[]; templates: TemplateNameOption[]; onOpen: (id: number) => void }) {
  return (
    <div className="table-wrap">
      <table className="content-table approval-list-table">
        <thead>
          <tr>
            <th>문서번호</th>
            <th>중요도</th>
            <th>양식</th>
            <th>제목</th>
            <th>기안자</th>
            <th>현재 단계</th>
            <th>문서 상태</th>
            <th>작성일</th>
            <th>완료일</th>
            <th>진행률</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.approvalId} className={`approval-row approval-row-${item.status.toLowerCase()}`}>
              <td>{item.documentNo ?? "상신 전"}</td>
              <td><span className={`priority priority-${item.priority.toLowerCase()}`}>{priorityLabel(item.priority)}</span></td>
              <td>{templateName(templates, item.templateCode)}</td>
              <td><button className="title-link" onClick={() => onOpen(item.approvalId)}>{item.title}</button></td>
              <td>{item.requesterName}</td>
              <td><span className="approval-stage-pill">{stageLabel(item.currentStage)}</span></td>
              <td><span className={`approval-status-pill approval-status-${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span></td>
              <td>{formatDate(item.requestedAt)}</td>
              <td>{item.completedAt ? formatDate(item.completedAt) : "-"}</td>
              <td>{item.currentApproverName ? `결재 ${item.currentApproverName}` : stageLabel(item.currentStage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeletedApprovalListTable({ items, templates, onRestore }: { items: ApprovalSummary[]; templates: TemplateNameOption[]; onRestore: (id: number) => void }) {
  return (
    <div className="table-wrap">
      <table className="content-table approval-list-table">
        <thead>
          <tr>
            <th>문서번호</th>
            <th>양식</th>
            <th>제목</th>
            <th>기안자</th>
            <th>문서 상태</th>
            <th>삭제일</th>
            <th>삭제자</th>
            <th>복구</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.approvalId}>
              <td>{item.documentNo ?? "상신 전"}</td>
              <td>{templateName(templates, item.templateCode)}</td>
              <td>{item.title}</td>
              <td>{item.requesterName}</td>
              <td>{statusLabel(item.status)}</td>
              <td>{item.deletedAt ? formatDate(item.deletedAt) : "-"}</td>
              <td>{item.deletedByName ?? "-"}</td>
              <td><button type="button" className="ghost" onClick={() => onRestore(item.approvalId)}><RefreshCw size={16} /> 복구</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApprovalRetentionAuditTable({ items }: { items: AuditLog[] }) {
  return (
    <div className="table-wrap">
      <table className="content-table approval-list-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>작업</th>
            <th>문서</th>
            <th>사용자</th>
            <th>사유</th>
            <th>결과</th>
            <th>IP</th>
            <th>일시</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.auditId}>
              <td>{item.auditId}</td>
              <td>{retentionAuditActionLabel(item.actionType)}</td>
              <td>#{item.targetId ?? "-"}</td>
              <td>{item.empId ?? "-"}</td>
              <td>{item.reason ?? "-"}</td>
              <td>{item.success ? "성공" : "실패"}</td>
              <td>{item.ipAddress ?? "-"}</td>
              <td>{formatDate(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
