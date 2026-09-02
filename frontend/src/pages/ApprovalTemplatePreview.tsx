import { createApprovalForm } from "../utils/approvalForm";
import type { ApprovalTemplateOption } from "../utils/approvalDomain";
import { ApprovalFormBody, type ApprovalFormContext } from "./ApprovalFormBody";

export function ApprovalTemplatePreview({ template, context, leaveDefaultReceiverEmpId }: {
  template: ApprovalTemplateOption;
  context: ApprovalFormContext;
  leaveDefaultReceiverEmpId?: number | null;
}) {
  const form = createApprovalForm(template, context.user, context.employees, context.leaveUsage, leaveDefaultReceiverEmpId);
  return <div className="approval-template-live-preview">
    <ApprovalFormBody key={`${template.code}-${template.version ?? 1}`} {...context} form={form} template={template} templates={[template]} onChange={() => undefined} readOnly />
  </div>;
}
