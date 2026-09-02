import type { ReactNode } from "react";

export function ApprovalDocumentHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="approval-document-header">
      <div className="approval-document-heading">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions && <div className="approval-document-header-actions">{actions}</div>}
    </header>
  );
}

export function ApprovalDocumentMeta({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="approval-document-meta">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ApprovalDocumentSectionHeader({
  title,
  description,
  badge,
  actions
}: {
  title: string;
  description?: string;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="approval-document-section-head">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="approval-document-section-tools">
        {badge && <span>{badge}</span>}
        {actions}
      </div>
    </div>
  );
}

export function ApprovalDocumentPdfNotice({ available = false }: { available?: boolean }) {
  return (
    <aside className={`approval-document-pdf-note${available ? " available" : ""}`}>
      <strong>{available ? "결재정보가 포함된 최종 PDF가 준비되었습니다." : "결재정보는 최종 승인 PDF에 포함됩니다."}</strong>
      <span>
        {available
          ? "문서 상단의 ‘PDF 다운로드/인쇄’ 버튼으로 직급·결재자명·결재일이 포함된 문서를 출력할 수 있습니다."
          : "웹 문서에는 결재 도장표를 중복 표시하지 않으며, 최종 승인 후 PDF에서 확인할 수 있습니다."}
      </span>
    </aside>
  );
}
