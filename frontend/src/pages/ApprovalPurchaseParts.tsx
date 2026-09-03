import { CalendarDays, Package, PieChart, Plus, Save, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Employee, User } from "../types";
import {
  PURCHASE_BU_CODES, blankPurchaseItem, normalizePurchaseItems, parsePurchaseItems,
  purchaseBuTotal, purchaseDefaultFieldValues, purchaseItemsJson,
  type ApprovalForm, type PurchaseRequestItem
} from "../utils/approvalDomain";

type PurchaseValues = Record<string, string>;

export function PurchaseDocumentOverview({ values, actions, children }: {
  values: PurchaseValues;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return <section className="purchase-web-card purchase-overview">
    <div className="purchase-web-head">
      <div><span className="purchase-eyebrow">전자결재 · 구매</span><h2>구매요구서</h2><p>구매 품목과 요구일, BU별 비용분할을 확인하세요.</p></div>
      {actions}
    </div>
    <dl className="purchase-applicant-row">
      {[["부서명", values.requestDeptName], ["성명", values.requesterName], ["청구일", values.requestDate]].map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>
      ))}
    </dl>
    {children}
  </section>;
}

export function PurchaseDocumentFields({ values, title, onTitleChange, onChange, onDeliveryDateChange, onSaveDeliveryDate }: {
  values: PurchaseValues;
  title: string;
  onTitleChange?: (title: string) => void;
  onChange?: (values: PurchaseValues) => void;
  onDeliveryDateChange?: (value: string) => void;
  onSaveDeliveryDate?: () => void;
}) {
  const editable = !!onChange;
  const items = parsePurchaseItems(values);
  const displayedItems = editable ? items : items.filter((item) => Object.values(item).some((value) => value.trim()));
  const buTotal = purchaseBuTotal(values);
  const validTotal = Number.isFinite(buTotal) && Math.abs(buTotal - 100) < 0.0001;
  const setField = (name: string, value: string) => onChange?.({ ...values, [name]: value });
  const setItems = (next: PurchaseRequestItem[]) => setField("purchaseItemsJson", purchaseItemsJson(next));
  const columns = [["itemName", "품명"], ["spec", "규격"], ["quantity", "수량"], ["usage", "용도"]] as const;
  const required = editable ? <span className="required-mark" aria-hidden="true"> *</span> : null;

  return <div className="purchase-web-fields">
    <section className="purchase-web-card">
      <div className="purchase-section-head"><div><CalendarDays size={18} aria-hidden="true" /><h3>구매 요청</h3></div>{editable && <span className="purchase-help">* 필수 입력</span>}</div>
      <div className="purchase-field-grid">
        <label className="purchase-field wide"><span>문서 제목{required}</span>
          {onTitleChange ? <input required value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="예: 안전장갑 외 3건 구매 요청" /> : <span className="purchase-value">{title || "—"}</span>}
        </label>
        <label className="purchase-field"><span>요구일{required}</span>
          {editable ? <input required type="date" value={values.requiredDate ?? ""} onChange={(event) => setField("requiredDate", event.target.value)} /> : <span className="purchase-value">{values.requiredDate || "—"}</span>}
        </label>
        <label className="purchase-field"><span>접수일</span><span className="purchase-value">{values.receiptDate || (editable ? "수신 확인 시 자동 기입" : "—")}</span></label>
        <label className="purchase-field"><span>입고일</span>
          {onDeliveryDateChange ? <input type="date" value={values.deliveryDate ?? ""} onChange={(event) => onDeliveryDateChange(event.target.value)} /> : <span className="purchase-value">{values.deliveryDate || (editable ? "구매부서 입력" : "—")}</span>}
        </label>
      </div>
      {onSaveDeliveryDate && <div className="purchase-field-actions"><button type="button" className="ghost" onClick={onSaveDeliveryDate}><Save size={16} /> 입고일 저장</button></div>}
    </section>

    <section className="purchase-web-card">
      <div className="purchase-section-head"><div><Package size={18} aria-hidden="true" /><h3>품목 내역</h3></div>
        {editable && <button type="button" className="ghost" onClick={() => setItems([...items, blankPurchaseItem()])}><Plus size={16} /> 행 추가</button>}
      </div>
      {editable && <p className="purchase-section-description">품명, 규격, 수량, 용도를 모두 입력하세요.</p>}
      <div className="purchase-table-scroll" role="region" aria-label="구매 품목 내역" tabIndex={0}>
        <table className="purchase-web-table">
          <thead><tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}{editable && <th className="purchase-remove-cell" scope="col"><span className="purchase-sr-only">삭제</span></th>}</tr></thead>
          <tbody>{displayedItems.length ? displayedItems.map((item, index) => <tr key={index}>
            {columns.map(([key, label]) => <td key={key}>{editable
              ? <input aria-label={`${index + 1}행 ${label}`} value={item[key]} onChange={(event) => {
                const next = normalizePurchaseItems(items);
                next[index] = { ...next[index], [key]: event.target.value };
                setItems(next);
              }} />
              : <span>{item[key] || "—"}</span>}</td>)}
            {editable && <td className="purchase-remove-cell"><button type="button" className="icon-button ghost danger" aria-label={`${index + 1}행 삭제`} disabled={items.length === 1} onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}><X size={16} /></button></td>}
          </tr>) : <tr><td colSpan={4} className="purchase-empty">등록된 품목이 없습니다.</td></tr>}</tbody>
        </table>
      </div>
    </section>

    <section className="purchase-web-card">
      <div className="purchase-section-head"><div><PieChart size={18} aria-hidden="true" /><h3>BU 비용분할</h3></div><span className={`purchase-total${validTotal ? " is-complete" : ""}`} aria-live="polite">합계 {Number.isFinite(buTotal) ? Number(buTotal.toFixed(2)) : "—"}%</span></div>
      {editable && <p className="purchase-section-description">BU별 부담 비율을 입력하세요. 합계는 100%여야 합니다.</p>}
      <div className="purchase-split-grid">
        {PURCHASE_BU_CODES.map((code) => <label className="purchase-field" key={code}><span>{code}</span>
          {editable ? <div className="purchase-percent-input"><input aria-label={`${code} 비용분할 (%)`} type="number" min="0" max="100" step="0.1" value={values[`bu_${code}`] ?? ""} onChange={(event) => setField(`bu_${code}`, event.target.value)} /><span aria-hidden="true">%</span></div>
            : <span className="purchase-value">{values[`bu_${code}`] || "0"}%</span>}
        </label>)}
      </div>
    </section>
  </div>;
}

export function PurchaseRequestEditor({ user, employees, form, onChange, headerActions }: {
  user: User;
  employees: Employee[];
  form: ApprovalForm;
  onChange: (form: ApprovalForm) => void;
  headerActions?: ReactNode;
}) {
  const values = purchaseDefaultFieldValues(user, employees, form.fieldValues);
  return <div className="purchase-request-form purchase-web-form">
    <PurchaseDocumentOverview values={values} actions={headerActions} />
    <PurchaseDocumentFields values={values} title={form.title}
      onTitleChange={(title) => onChange({ ...form, title })}
      onChange={(fieldValues) => onChange({ ...form, fieldValues })} />
  </div>;
}
