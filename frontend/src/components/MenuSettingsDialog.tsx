import { ArrowDown, ArrowUp, Eye, EyeOff, Pin, PinOff, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { EffectiveMenu, MenuPreferenceItem } from "../types";

type MenuSettingsDialogProps = {
  open: boolean;
  menus: EffectiveMenu[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (items: MenuPreferenceItem[]) => Promise<boolean>;
  onReset: () => Promise<boolean>;
};

export function MenuSettingsDialog({
  open,
  menus,
  saving,
  error,
  onClose,
  onSave,
  onReset
}: MenuSettingsDialogProps) {
  const [draft, setDraft] = useState<EffectiveMenu[]>([]);

  useEffect(() => {
    if (open) setDraft([...menus].sort((a, b) => a.effectiveSortOrder - b.effectiveSortOrder));
  }, [menus, open]);

  if (!open) return null;

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  }

  function patch(menuCode: string, changes: Partial<EffectiveMenu>) {
    setDraft((current) => current.map((item) => item.menuCode === menuCode ? { ...item, ...changes } : item));
  }

  async function save() {
    const saved = await onSave(draft.map((item, index) => ({
      menuCode: item.menuCode,
      sortOrder: index + 1,
      pinned: item.pinned,
      hidden: item.hidden
    })));
    if (saved) onClose();
  }

  async function reset() {
    if (await onReset()) onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="menu-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="menu-settings-head">
          <div>
            <h2 id="menu-settings-title">사이드 메뉴 설정</h2>
            <p>순서, 고정, 숨김 상태는 로그인한 계정에만 적용됩니다.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기"><X size={19} /></button>
        </header>
        <div className="menu-settings-list">
          {draft.map((item, index) => {
            const isHome = item.menuCode.endsWith("_HOME");
            return (
              <div className="menu-settings-row" key={item.menuCode}>
                <div className="menu-order-buttons">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`${item.menuName} 위로`}><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === draft.length - 1} aria-label={`${item.menuName} 아래로`}><ArrowDown size={15} /></button>
                </div>
                <div className="menu-settings-name">
                  <strong>{item.menuName}</strong>
                  {item.implementationStatus === "PLANNED" && <span>예정</span>}
                </div>
                <button type="button" className={item.pinned ? "active" : ""} onClick={() => patch(item.menuCode, { pinned: !item.pinned })}>
                  {item.pinned ? <PinOff size={15} /> : <Pin size={15} />} {item.pinned ? "고정 해제" : "상단 고정"}
                </button>
                <button type="button" className={item.hidden ? "active" : ""} disabled={isHome} title={isHome ? "포털 홈은 숨길 수 없습니다." : undefined} onClick={() => patch(item.menuCode, { hidden: !item.hidden })}>
                  {item.hidden ? <Eye size={15} /> : <EyeOff size={15} />} {item.hidden ? "표시" : "숨김"}
                </button>
              </div>
            );
          })}
        </div>
        {error && <p className="error">{error}</p>}
        <footer className="menu-settings-actions">
          <button type="button" className="secondary" onClick={reset} disabled={saving}><RotateCcw size={15} /> 기본값 복원</button>
          <div>
            <button type="button" className="secondary" onClick={onClose} disabled={saving}>취소</button>
            <button type="button" className="primary" onClick={save} disabled={saving}>{saving ? "저장 중" : "저장"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
