import { Inbox } from "lucide-react";

export function Empty({ text = "데이터가 없습니다." }) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <span>{text}</span>
    </div>
  );
}

export function EmptyDetail({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-detail">
      <Inbox size={42} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
