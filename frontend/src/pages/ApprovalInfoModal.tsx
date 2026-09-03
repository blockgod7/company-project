import { Check, Edit3, Save, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { EmployeeMultiPicker } from "../components/EmployeePickers";
import type { Employee, User } from "../types";
import type { ApprovalLineSelection } from "../utils/approvalPeople";
import type { ApprovalLineLibrary } from "./useApprovalLineLibrary";

type Props = {
  open: boolean;
  user: User;
  employees: Employee[];
  selection: ApprovalLineSelection;
  onChange: (selection: ApprovalLineSelection) => void;
  library: ApprovalLineLibrary;
  receiverDisabledIds?: number[];
  maxReceivers?: number;
  decisionOnly?: boolean;
  description?: string;
  error?: string;
  message?: string;
  onClose: () => void;
};

export function ApprovalInfoModal({
  open, user, employees, selection, onChange, library, receiverDisabledIds = [],
  maxReceivers, decisionOnly = false, description, error, message, onClose
}: Props) {
  if (!open) return null;
  const { savedApprovalLines, selectedSavedLineId } = library;
  const selectedLine = savedApprovalLines.find((line) => String(line.defaultLineId) === selectedSavedLineId);
  const receiverEmpIds = decisionOnly ? [] : selection.receiverEmpIds;
  const update = (patch: Partial<ApprovalLineSelection>) => onChange({ ...selection, ...patch });

  // A document's container queries and form styles must not resize this shared dialog.
  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <div className="org-picker-modal approval-info-modal" role="dialog" aria-modal="true" aria-label="결재 정보">
        <div className="modal-head">
          <h3>결재 정보</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="결재 정보 닫기"><X size={18} /></button>
        </div>
        <div className="approval-info-controls">
          <div className="approval-line-library">
            <label>저장된 결재선
              <select value={selectedSavedLineId} onChange={(event) => library.setSelectedSavedLineId(event.target.value)}>
                {savedApprovalLines.length
                  ? savedApprovalLines.map((line) => <option key={line.defaultLineId ?? line.lineName} value={line.defaultLineId ?? ""}>{line.lineName}</option>)
                  : <option value="">저장된 결재선 없음</option>}
              </select>
            </label>
            <button type="button" className="ghost" onClick={library.applySavedApprovalLine} disabled={!selectedLine}>불러오기</button>
            <button type="button" className="ghost" onClick={() => void library.renameSavedApprovalLine()} disabled={!selectedLine}><Edit3 size={16} /> 이름 변경</button>
            <button type="button" className="ghost danger" onClick={() => void library.deleteSavedApprovalLine()} disabled={!selectedLine}><Trash2 size={16} /> 삭제</button>
            <button type="button" className="ghost" onClick={() => void library.saveNamedApprovalLine()}><Save size={16} /> 결재선 저장</button>
          </div>
          {!decisionOnly && <p className="muted-text approval-info-description">수신자는 문서별로 지정하며, 결재선 저장·불러오기에는 포함되지 않습니다.</p>}
          {description && <p className="muted-text approval-info-description">{description}</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {message && <p className="template-note" role="status"><span>{message}</span></p>}
        </div>
        <div className="line-picker-grid">
          <EmployeeMultiPicker title="합의자" user={user} employees={employees}
            selectedIds={selection.agreementEmpIds} disabledIds={[user.empId, ...selection.approverEmpIds, ...receiverEmpIds]}
            cardLayout onChange={(agreementEmpIds) => update({ agreementEmpIds })} />
          <EmployeeMultiPicker title="결재자" user={user} employees={employees}
            selectedIds={selection.approverEmpIds} disabledIds={[user.empId, ...selection.agreementEmpIds, ...receiverEmpIds]}
            ordered cardLayout prependUser={!decisionOnly} onChange={(approverEmpIds) => update({ approverEmpIds })} />
          {!decisionOnly && <>
            <EmployeeMultiPicker title="수신자" user={user} employees={employees}
              selectedIds={selection.receiverEmpIds} disabledIds={receiverDisabledIds} maxSelections={maxReceivers}
              cardLayout onChange={(receiverEmpIds) => update({ receiverEmpIds })} />
            <EmployeeMultiPicker title="참조자" user={user} employees={employees}
              selectedIds={selection.referenceEmpIds} disabledIds={selection.receiverEmpIds}
              cardLayout onChange={(referenceEmpIds) => update({ referenceEmpIds })} />
          </>}
        </div>
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}><Check size={16} /> 적용</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
