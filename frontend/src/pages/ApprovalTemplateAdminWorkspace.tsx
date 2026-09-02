import { Check, Folder, Plus, Save, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmployeeMultiPicker } from "../components/EmployeePickers";
import {
  categorizedAdminTemplateGroups,
  isLeaveCancelTemplateCode,
  isLeaveTemplateCode
} from "../utils/approvalDomain";
import type {
  ApprovalForm,
  ApprovalTemplateAdminForm,
  ApprovalTemplateOption
} from "../utils/approvalDomain";
import type { Employee, User } from "../types";

type Props = {
  user: User;
  employees: Employee[];
  templates: ApprovalTemplateOption[];
  form: ApprovalTemplateAdminForm;
  setForm: (form: ApprovalTemplateAdminForm) => void;
  lineForm: ApprovalForm;
  setLineForm: (form: ApprovalForm) => void;
  message: string;
  statusUpdating: boolean;
  onNew: () => void;
  onSaveVersion: () => void;
  onSelect: (template: ApprovalTemplateOption) => void;
  onToggleActive: (template: ApprovalTemplateOption, active: boolean) => void;
  onSaveDefaultLine: () => void;
};

export function ApprovalTemplateAdminWorkspace({
  user,
  employees,
  templates,
  form,
  setForm,
  lineForm,
  setLineForm,
  message,
  statusUpdating,
  onNew,
  onSaveVersion,
  onSelect,
  onToggleActive,
  onSaveDefaultLine
}: Props) {
  const groups = useMemo(() => categorizedAdminTemplateGroups(templates), [templates]);
  const selectedTemplate = templates.find((template) => template.code === form.templateCode);
  const selectedGroupId = groups.find((group) => group.templates.some((template) => template.code === form.templateCode))?.id;
  const [categoryId, setCategoryId] = useState(selectedGroupId ?? "");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (selectedGroupId) setCategoryId(selectedGroupId);
  }, [selectedGroupId]);

  const activeCategory = groups.find((group) => group.id === categoryId) ?? groups[0];
  const normalizedKeyword = keyword.trim().toLowerCase();
  const listedTemplates = normalizedKeyword
    ? groups.flatMap((group) => group.templates).filter((template) =>
      template.name.toLowerCase().includes(normalizedKeyword)
      || template.code.toLowerCase().includes(normalizedKeyword)
      || template.description.toLowerCase().includes(normalizedKeyword))
    : activeCategory?.templates ?? [];

  function selectCategory(group: (typeof groups)[number]) {
    setCategoryId(group.id);
    setKeyword("");
    const firstTemplate = group.templates.find((template) => template.code === form.templateCode) ?? group.templates[0];
    if (firstTemplate) onSelect(firstTemplate);
  }

  function selectTemplate(template: ApprovalTemplateOption) {
    const group = groups.find((item) => item.templates.some((candidate) => candidate.code === template.code));
    if (group) setCategoryId(group.id);
    onSelect(template);
  }

  function changeActive(active: boolean) {
    if (selectedTemplate) {
      onToggleActive(selectedTemplate, active);
      return;
    }
    setForm({ ...form, active });
  }

  return (
    <div className="approval-template-editor approval-template-admin-workspace">
      <div className="panel-head approval-template-admin-head">
        <div>
          <h3>양식관리</h3>
          <p className="muted-text">분류에서 양식을 선택해 상태, 필드와 기본 결재선을 관리합니다.</p>
        </div>
        <div className="actions">
          <button type="button" className="ghost" onClick={() => { setKeyword(""); onNew(); }}><Plus size={16} /> 새 양식</button>
          <button type="button" onClick={onSaveVersion}><Save size={16} /> 새 버전 저장</button>
        </div>
      </div>

      {message && <p className="template-note"><span>{message}</span></p>}

      <div className="approval-template-admin-browser">
        <div className="approval-template-admin-search">
          <label>
            <span>양식명</span>
            <div>
              <Search size={17} aria-hidden="true" />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="양식명 또는 코드 검색" />
            </div>
          </label>
          <button type="button" className="ghost" onClick={() => setKeyword("")} disabled={!keyword}>초기화</button>
        </div>

        <div className="approval-template-admin-layout">
          <aside className="approval-template-admin-categories" aria-label="양식 분류">
            <h3>양식함</h3>
            {groups.map((group) => (
              <button type="button" key={group.id} className={activeCategory?.id === group.id && !normalizedKeyword ? "active" : ""} onClick={() => selectCategory(group)}>
                <Folder size={16} aria-hidden="true" />
                <strong>{group.label}</strong>
                <span>{group.templates.length}</span>
              </button>
            ))}
          </aside>

          <section className="approval-template-admin-list" aria-label="양식 목록">
            <div className="approval-template-admin-section-title">
              <h3>{normalizedKeyword ? "검색결과" : "양식리스트"}</h3>
              <span>{listedTemplates.length}</span>
            </div>
            <div className="approval-template-admin-list-items">
              {listedTemplates.length ? listedTemplates.map((template) => (
                <button type="button" key={`${template.code}-${template.version}`} className={form.templateCode === template.code ? "active" : ""} onClick={() => selectTemplate(template)}>
                  <strong>{template.name}</strong>
                  <span>{template.code} v{template.version ?? 1}</span>
                  <em className={template.activeYn === "N" ? "inactive" : "active"}>{template.activeYn === "N" ? "비활성" : "활성"}</em>
                </button>
              )) : <p className="approval-template-admin-empty">조건에 맞는 양식이 없습니다.</p>}
            </div>
          </section>

          <section className="approval-template-admin-detail" aria-label="양식 편집">
            <div className="approval-template-admin-detail-head">
              <div>
                <span>{selectedTemplate ? `${selectedTemplate.code} v${selectedTemplate.version ?? 1}` : "NEW TEMPLATE"}</span>
                <h3>{form.templateName || "새 양식"}</h3>
              </div>
              <span className={`approval-template-admin-status ${form.active ? "active" : "inactive"}`}>{form.active ? "활성" : "비활성"}</span>
            </div>

            <div className="template-form approval-template-admin-form">
              <label>양식 코드<input value={form.templateCode} onChange={(event) => setForm({ ...form, templateCode: event.target.value.toUpperCase() })} placeholder="DRAFT" /></label>
              <label>양식명<input value={form.templateName} onChange={(event) => setForm({ ...form, templateName: event.target.value })} placeholder="기안서" /></label>
              <label>정렬순서<input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={form.active} disabled={statusUpdating} onChange={(event) => changeActive(event.target.checked)} /> {statusUpdating ? "상태 변경 중" : "활성 양식"}</label>
              <label className="wide">설명<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="양식 설명" /></label>
              <label className="wide">필드 JSON<textarea value={form.fieldsJson} onChange={(event) => setForm({ ...form, fieldsJson: event.target.value })} /></label>
              <label className="wide">출력 레이아웃 JSON<textarea value={form.printLayoutJson} onChange={(event) => setForm({ ...form, printLayoutJson: event.target.value })} /></label>
            </div>

            {form.templateCode && (
              <div className="approval-template-line">
                <div className="panel-head">
                  <div>
                    <h3>양식별 기본 결재선</h3>
                    <p className="muted-text">{form.templateCode} 양식 작성 시 우선 적용됩니다.</p>
                  </div>
                  <div className="actions">
                    {selectedTemplate && (
                      <button type="button" className="ghost" disabled={statusUpdating} onClick={() => onToggleActive(selectedTemplate, !form.active)}>
                        {form.active ? <X size={16} /> : <Check size={16} />} {form.active ? "비활성화" : "활성화"}
                      </button>
                    )}
                    <button type="button" onClick={onSaveDefaultLine}><Save size={16} /> 결재선 저장</button>
                  </div>
                </div>
                <div className="line-picker-grid">
                  <EmployeeMultiPicker title="합의자" user={user} employees={employees} selectedIds={lineForm.agreementEmpIds} disabledIds={[...lineForm.approverEmpIds, ...lineForm.receiverEmpIds]} onChange={(agreementEmpIds) => setLineForm({ ...lineForm, agreementEmpIds })} />
                  <EmployeeMultiPicker title="결재자" user={user} employees={employees} selectedIds={lineForm.approverEmpIds} disabledIds={[...lineForm.agreementEmpIds, ...lineForm.receiverEmpIds]} ordered onChange={(approverEmpIds) => setLineForm({ ...lineForm, approverEmpIds })} />
                  <EmployeeMultiPicker title="수신자" user={user} employees={employees} selectedIds={lineForm.receiverEmpIds} disabledIds={[...lineForm.agreementEmpIds, ...lineForm.approverEmpIds, ...lineForm.referenceEmpIds]} maxSelections={isLeaveTemplateCode(lineForm.templateCode) || isLeaveCancelTemplateCode(lineForm.templateCode) ? 1 : undefined} onChange={(receiverEmpIds) => setLineForm({ ...lineForm, receiverEmpIds })} />
                  <EmployeeMultiPicker title="참조자" user={user} employees={employees} selectedIds={lineForm.referenceEmpIds} disabledIds={lineForm.receiverEmpIds} onChange={(referenceEmpIds) => setLineForm({ ...lineForm, referenceEmpIds })} />
                  <EmployeeMultiPicker title="연람자" user={user} employees={employees} selectedIds={lineForm.readerEmpIds} disabledIds={[]} onChange={(readerEmpIds) => setLineForm({ ...lineForm, readerEmpIds })} />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
