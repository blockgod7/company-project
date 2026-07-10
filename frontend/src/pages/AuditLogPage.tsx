import { useEffect, useState } from "react";
import { api } from "../api";
import type { GlobalSearchTarget } from "../utils/search";
import { formatDate } from "../utils/date";
import type { AuditLog, PageResponse } from "../types";

type AuditLogPageProps = {
  target: GlobalSearchTarget | null;
};

export function AuditLogPage({ target }: AuditLogPageProps) {
  const [items, setItems] = useState<AuditLog[]>([]);

  useEffect(() => {
    void api<PageResponse<AuditLog>>("/admin/audit-logs?size=100").then((page) => setItems(page.content));
  }, []);

  useEffect(() => {
    if (target?.type === "AUDIT_LOG") {
      void api<PageResponse<AuditLog>>("/admin/audit-logs?size=100").then((page) => setItems(page.content));
    }
  }, [target?.nonce]);

  return (
    <div className="panel">
      <h3>감사 로그</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>사용자</th>
            <th>작업</th>
            <th>대상</th>
            <th>IP</th>
            <th>일시</th>
          </tr>
        </thead>
        <tbody>
          {items.map((log) => (
            <tr key={log.auditId}>
              <td>{log.auditId}</td>
              <td>{log.empId ?? "-"}</td>
              <td>{log.actionType}</td>
              <td>{log.targetTable} #{log.targetId ?? "-"}</td>
              <td>{log.ipAddress ?? "-"}</td>
              <td>{formatDate(log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
