import { useEffect, useState } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import { api } from "../api";
import { Empty } from "../components/Empty";
import type { GlobalSearchTarget } from "../utils/search";
import { formatDate } from "../utils/date";
import type { NotificationItem, PageResponse } from "../types";

type NotificationPageProps = {
  go: (route: "approvals") => void;
  target: GlobalSearchTarget | null;
};

export function NotificationPage({ go, target }: NotificationPageProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(true);

  async function load() {
    const page = await api<PageResponse<NotificationItem>>(`/notifications?size=50${unreadOnly ? "&readYn=N" : ""}`);
    setItems(page.content);
  }

  useEffect(() => {
    void load();
  }, [unreadOnly]);

  useEffect(() => {
    if (target?.type === "NOTIFICATION") {
      setUnreadOnly(false);
      void load();
    }
  }, [target?.nonce]);

  async function markRead(id: number) {
    await api(`/notifications/${id}/read`, { method: "PUT" });
    await load();
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>알림</h3>
        <label className="check">
          <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> 미읽음만
        </label>
      </div>
      {items.length ? items.map((item) => (
        <div key={item.notificationId} className={item.read ? "notice-row read" : "notice-row"}>
          <div>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <span>{item.readStatus === "READ" ? "읽음" : "미읽음"} · {formatDate(item.createdAt)}</span>
            {item.notificationStatus === "FAILED" && <span className="error">알림 발송 실패: {item.lastErrorMessage ?? "원인 미상"}</span>}
          </div>
          <div className="actions">
            {item.targetType === "APPROVAL" && item.targetId && <button className="ghost" onClick={() => go("approvals")}><ClipboardCheck size={16} /> 문서 바로가기</button>}
            {!item.read && (
              <button className="ghost" onClick={() => markRead(item.notificationId)}>
                <Check size={16} /> 읽음
              </button>
            )}
          </div>
        </div>
      )) : <Empty />}
    </div>
  );
}
