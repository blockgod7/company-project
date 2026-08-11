import { FormEvent, useEffect, useState } from "react";
import { api, jsonBody } from "../api";
import {
  BEREAVEMENT_EVENT_TYPES,
  BEREAVEMENT_RELATIONS,
  bereavementLabel
} from "../utils/bereavement";
import { todayDate } from "../utils/approvalDomain";

type Policy = {
  policyId: number;
  eventType: string;
  familyRelation: string;
  allowedDays: number;
  payType: "PAID" | "UNPAID";
  evidenceRequired: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
  changeReason: string;
};

export function BereavementPolicyPanel() {
  const [items, setItems] = useState<Policy[]>([]);
  const [eventType, setEventType] = useState(BEREAVEMENT_EVENT_TYPES[0].code);
  const [relation, setRelation] = useState(BEREAVEMENT_RELATIONS[0].code);
  const [days, setDays] = useState(1);
  const [pay, setPay] = useState<"PAID" | "UNPAID">("PAID");
  const [evidence, setEvidence] = useState(false);
  const [from, setFrom] = useState(todayDate());
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      setItems(await api<Policy[]>("/bereavement-policies"));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "경조 기준표를 불러오지 못했습니다.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/bereavement-policies", {
        method: "POST",
        body: jsonBody({
          eventType,
          familyRelation: relation,
          allowedDays: days,
          payType: pay,
          evidenceRequired: evidence,
          effectiveFrom: from,
          effectiveTo: to || null,
          active: true,
          changeReason: reason
        })
      });
      setReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "경조 기준을 저장하지 못했습니다.");
    }
  }

  return (
    <section className="approval-detail-section">
      <h3>경조 유형·관계별 기준표</h3>
      <p className="muted-text">표준 유형과 관계, 허용일수, 급여, 증빙 및 시행기간을 기준으로 상신을 검증합니다. 같은 유형·관계의 시행기간은 겹칠 수 없습니다.</p>
      {error && <p className="error">{error}</p>}
      <form className="template-form holiday-form" onSubmit={save}>
        <label>경조 유형<select required value={eventType} onChange={(event) => setEventType(event.target.value)}>{BEREAVEMENT_EVENT_TYPES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
        <label>대상 관계<select required value={relation} onChange={(event) => setRelation(event.target.value)}>{BEREAVEMENT_RELATIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
        <label>허용일수<input required type="number" min="0.5" step="0.5" value={days} onChange={(event) => setDays(Number(event.target.value))} /></label>
        <label>급여<select value={pay} onChange={(event) => setPay(event.target.value as "PAID" | "UNPAID")}><option value="PAID">유급</option><option value="UNPAID">무급</option></select></label>
        <label>시행일<input required type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>종료일 <small>선택</small><input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={evidence} onChange={(event) => setEvidence(event.target.checked)} /> 증빙 필수</label>
        <label className="wide">변경 사유<input required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="actions wide"><button type="submit">기준 등록</button></div>
      </form>
      {loaded && !items.length && !error && <p className="error">등록된 경조 기준이 없습니다. 회사 규정에 따라 유형·관계별 허용일수와 시행일을 등록해야 경조휴가를 신청할 수 있습니다.</p>}
      <div className="table-wrap"><table><thead><tr><th>유형</th><th>관계</th><th>일수/급여</th><th>증빙</th><th>시행기간</th><th>상태/사유</th></tr></thead><tbody>{items.map((policy) => <tr key={policy.policyId}><td>{bereavementLabel(BEREAVEMENT_EVENT_TYPES, policy.eventType)}</td><td>{bereavementLabel(BEREAVEMENT_RELATIONS, policy.familyRelation)}</td><td>{policy.allowedDays}일 · {policy.payType === "PAID" ? "유급" : "무급"}</td><td>{policy.evidenceRequired ? "필수" : "선택"}</td><td>{policy.effectiveFrom} ~ {policy.effectiveTo ?? "계속"}</td><td>{policy.active ? "사용" : "중지"} · {policy.changeReason}</td></tr>)}</tbody></table></div>
    </section>
  );
}
