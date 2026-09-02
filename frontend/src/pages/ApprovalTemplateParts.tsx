import { Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";
import { Empty } from "../components/Empty";
import { APPROVAL_TEMPLATE_CATEGORIES, categorizedTemplateGroups, type ApprovalBox, type ApprovalTemplateOption } from "../utils/approvalDomain";
import { ApprovalTemplatePreview } from "./ApprovalTemplatePreview";
import type { ApprovalFormContext } from "./ApprovalFormBody";
export const APPROVAL_BOXES: { box: ApprovalBox; label: string }[] = [
  { box: "agreement", label: "합의대기" },
  { box: "pending", label: "결재대기" },
  { box: "received", label: "수신함" },
  { box: "shared", label: "참조문서" },
  { box: "requested", label: "기안문서" },
  { box: "processed", label: "처리문서" },
  { box: "all", label: "전체문서" }
];

export function isApprovalBox(value: string): value is ApprovalBox {
  return APPROVAL_BOXES.some((item) => item.box === value);
}

export function TemplateSelectModalV2({ templates, selected: selection, fallbackActive, context, leaveDefaultReceiverEmpId, onSelect, onCancel, onConfirm }: {
  templates: ApprovalTemplateOption[];
  selected: ApprovalTemplateOption;
  fallbackActive: boolean;
  context: ApprovalFormContext;
  leaveDefaultReceiverEmpId?: number | null;
  onSelect: (template: ApprovalTemplateOption) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Resolve from the current catalog, not the object saved when it was clicked.
  const selected = templates.find((template) => template.code === selection.code) ?? selection;
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    const initial = categorizedTemplateGroups(templates).find((category) => category.templates.some((template) => template.code === selected.code));
    return initial?.id ?? APPROVAL_TEMPLATE_CATEGORIES[0].id;
  });
  const [keyword, setKeyword] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);

  function resetWindowSize() {
    // Native CSS resizing writes inline dimensions; clear only those dimensions.
    dialogRef.current?.style.removeProperty("width");
    dialogRef.current?.style.removeProperty("height");
    setMaximized(false);
  }

  const groups = categorizedTemplateGroups(templates);
  const activeCategory = groups.find((category) => category.id === selectedCategoryId) ?? groups[0];
  const filteredTemplates = (activeCategory?.templates ?? []).filter((template) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return true;
    return template.name.toLowerCase().includes(normalizedKeyword)
      || template.code.toLowerCase().includes(normalizedKeyword)
      || template.description.toLowerCase().includes(normalizedKeyword);
  });

  function selectCategory(category: ReturnType<typeof categorizedTemplateGroups>[number]) {
    setSelectedCategoryId(category.id);
    const firstMatched = category.templates.find((template) => template.code === selected.code) ?? category.templates[0];
    if (firstMatched) onSelect(firstMatched);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div ref={dialogRef} className={`template-select-modal template-select-modal-v2${maximized ? " is-maximized" : ""}`} role="dialog" aria-modal="true" aria-label="양식 선택">
        <div className="modal-head">
          <h3>양식선택</h3>
          <div className="template-window-actions">
            <button type="button" className="ghost" onClick={resetWindowSize} title="창 크기 초기화"><RotateCcw size={16} /> 기본 크기</button>
            <button type="button" className="ghost" onClick={() => setMaximized((current) => !current)} aria-pressed={maximized}>
              {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{maximized ? "이전 크기" : "크게 보기"}
            </button>
            <button type="button" className="icon-button" onClick={onCancel} title="닫기" aria-label="양식 선택 닫기"><X size={18} /></button>
          </div>
        </div>
        <div className="template-select-toolbar">
          <label>
            <span>양식명</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="검색어 입력" />
          </label>
          <button type="button" className="ghost" onClick={() => setKeyword("")}>초기화</button>
        </div>
        <div className="template-select-layout">
          <div className="template-category-list">
            <h3>양식함</h3>
            {fallbackActive && <p className="template-fallback-note">개발용 임시 목록</p>}
            {groups.map((category) => (
              <button type="button" key={category.id} className={activeCategory?.id === category.id ? "active" : ""} onClick={() => selectCategory(category)}>
                <span className="template-folder-icon" aria-hidden="true">▣</span>
                <strong>{category.label}</strong>
                <span>{category.templates.length}</span>
              </button>
            ))}
          </div>
          <div className="template-choice-panel">
            <div className="template-choice-list">
              <h3>양식리스트</h3>
              {filteredTemplates.length ? filteredTemplates.map((template) => (
                <button type="button" key={template.code} className={selected.code === template.code ? "active" : ""} onClick={() => onSelect(template)}>
                  <strong>{template.name}</strong>
                  <span>{template.code} v{template.version ?? 1}</span>
                </button>
              )) : <Empty text="표시할 양식이 없습니다." />}
              <div className="template-description-box">
                <strong>양식설명</strong>
                <span>{selected.description || "등록된 설명이 없습니다."}</span>
              </div>
            </div>
            <div className="template-preview">
              <h3>양식 미리보기</h3>
              <p className="template-preview-note">{selected.name} · v{selected.version ?? 1} · 현재 작성 양식과 동일한 화면입니다.</p>
              <ApprovalTemplatePreview template={selected} context={context} leaveDefaultReceiverEmpId={leaveDefaultReceiverEmpId} />
            </div>
          </div>
        </div>
        <div className="modal-actions template-window-footer">
          <span className="template-resize-hint">{maximized ? "이전 크기로 돌아가면 직접 크기를 조절할 수 있습니다." : "오른쪽 아래 모서리를 드래그해 창 크기를 조절하세요."}</span>
          <button type="button" className="ghost" onClick={onCancel}>취소</button>
          <button type="button" onClick={onConfirm} disabled={!selected}>확인</button>
        </div>
      </div>
    </div>
  );
}
