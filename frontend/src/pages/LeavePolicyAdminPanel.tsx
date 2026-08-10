import { ClipboardList, Plus, RefreshCw, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, jsonBody } from "../api";
import { todayDate } from "../utils/approvalDomain";
import type { Employee } from "../types";
import { BereavementPolicyPanel } from "./BereavementPolicyPanel";

type LeavePolicy = {
  leavePolicyId: number;
  leaveType: string;
  displayName: string;
  active: boolean;
  payType: "PAID" | "UNPAID" | "SEPARATE";
  annualDeductionDays: number;
  unitType: "FULL_DAY" | "HALF_DAY" | "BOTH";
  maxDays: number | null;
  periodBeforeDays: number | null;
  periodAfterDays: number | null;
  genderRestriction: "ALL" | "MALE" | "FEMALE";
  evidenceRequired: boolean;
  maxSegments: number | null;
  adminOverrideAllowed: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string;
};

type PolicyForm = Omit<LeavePolicy, "leavePolicyId">;

const EMPTY: PolicyForm = {
  leaveType: "",
  displayName: "",
  active: true,
  payType: "PAID",
  annualDeductionDays: 0,
  unitType: "FULL_DAY",
  maxDays: null,
  periodBeforeDays: null,
  periodAfterDays: null,
  genderRestriction: "ALL",
  evidenceRequired: false,
  maxSegments: null,
  adminOverrideAllowed: true,
  effectiveFrom: todayDate(),
  effectiveTo: null,
  changeReason: ""
};

function optionalNumber(value: string) {
  return value === "" ? null : Number(value);
}

type SpouseOverride = {
  policyOverrideId: number;
  empId: number;
  empName: string;
  referenceDate: string;
  baseMaxDays: number;
  overrideMaxDays: number;
  baseMaxSegments: number;
  overrideMaxSegments: number;
  reason: string;
  grantedByName: string;
  active: boolean;
  revokeReason: string | null;
};

export function LeavePolicyAdminPanel({ employees }: { employees: Employee[] }) {
  const [items, setItems] = useState<LeavePolicy[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api<LeavePolicy[]>("/leave-policies/manage"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴가 정책을 불러오지 못했습니다.");
    }
  }

  useEffect(() => { void load(); }, []);

  function edit(item: LeavePolicy) {
    setEditingId(item.leavePolicyId);
    setForm({ ...item });
    setMessage("");
    setError("");
  }

  function reset() {
    setEditingId(null);
    setForm({ ...EMPTY, effectiveFrom: todayDate() });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api(editingId ? `/leave-policies/${editingId}` : "/leave-policies", {
        method: editingId ? "PUT" : "POST",
        body: jsonBody(form)
      });
      setMessage(editingId ? "휴가 정책과 변경 이력을 저장했습니다." : "새 휴가 정책을 등록했습니다.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴가 정책을 저장하지 못했습니다.");
    }
  }

  return <div className="approval-template-editor leave-policy-admin">
    <div className="panel-head"><div><h3><ClipboardList size={18} /> 휴가 정책 기준표</h3><p className="muted-text">유급 여부, 연차 차감, 사용 단위와 시행기간을 통합 관리합니다. 기간이 겹치는 정책은 저장할 수 없습니다.</p></div><button type="button" className="ghost" onClick={() => void load()}><RefreshCw size={16} /> 새로고침</button></div>
    {message && <p className="template-note"><span>{message}</span></p>}{error && <p className="error">{error}</p>}
    <form className="template-form holiday-form" onSubmit={save}>
      <label>휴가 종류 코드<input required maxLength={50} value={form.leaveType} onChange={(event) => setForm({ ...form, leaveType: event.target.value })} /></label>
      <label>표시 이름<input required maxLength={100} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
      <label>급여 구분<select value={form.payType} onChange={(event) => setForm({ ...form, payType: event.target.value as PolicyForm["payType"] })}><option value="PAID">유급</option><option value="UNPAID">무급</option><option value="SEPARATE">별도 처리</option></select></label>
      <label>연차 차감일<input required type="number" min="0" max="30" step="0.5" value={form.annualDeductionDays} onChange={(event) => setForm({ ...form, annualDeductionDays: Number(event.target.value) })} /></label>
      <label>사용 단위<select value={form.unitType} onChange={(event) => setForm({ ...form, unitType: event.target.value as PolicyForm["unitType"] })}><option value="FULL_DAY">종일</option><option value="HALF_DAY">반일</option><option value="BOTH">종일/반일</option></select></label>
      <label>최대 사용일<input type="number" min="0.5" max="365" step="0.5" value={form.maxDays ?? ""} onChange={(event) => setForm({ ...form, maxDays: optionalNumber(event.target.value) })} /></label>
      <label>기준일 이전 허용일<input type="number" min="0" value={form.periodBeforeDays ?? ""} onChange={(event) => setForm({ ...form, periodBeforeDays: optionalNumber(event.target.value) })} /></label>
      <label>기준일 이후 허용일<input type="number" min="0" value={form.periodAfterDays ?? ""} onChange={(event) => setForm({ ...form, periodAfterDays: optionalNumber(event.target.value) })} /></label>
      <label>성별 제한<select value={form.genderRestriction} onChange={(event) => setForm({ ...form, genderRestriction: event.target.value as PolicyForm["genderRestriction"] })}><option value="ALL">제한 없음</option><option value="MALE">남성</option><option value="FEMALE">여성</option></select></label>
      <label>최대 사용 구간<input type="number" min="1" max="100" value={form.maxSegments ?? ""} onChange={(event) => setForm({ ...form, maxSegments: optionalNumber(event.target.value) })} /></label>
      <label>시행일<input required type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></label>
      <label>종료일<input type="date" value={form.effectiveTo ?? ""} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value || null })} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> 사용 가능</label>
      <label className="checkbox-label"><input type="checkbox" checked={form.evidenceRequired} onChange={(event) => setForm({ ...form, evidenceRequired: event.target.checked })} /> 증빙 필수</label>
      <label className="checkbox-label"><input type="checkbox" checked={form.adminOverrideAllowed} onChange={(event) => setForm({ ...form, adminOverrideAllowed: event.target.checked })} /> 관리자 예외 허용</label>
      <label className="wide">변경 사유<input required maxLength={500} value={form.changeReason} onChange={(event) => setForm({ ...form, changeReason: event.target.value })} /></label>
      <div className="actions wide">{editingId && <button type="button" className="ghost" onClick={reset}><Plus size={16} /> 새 정책</button>}<button type="submit"><Save size={16} /> {editingId ? "변경 저장" : "정책 등록"}</button></div>
    </form>
    <div className="table-wrap"><table><thead><tr><th>휴가 종류</th><th>급여/차감</th><th>단위/한도</th><th>제한</th><th>시행기간</th><th>상태</th><th>관리</th></tr></thead><tbody>{items.map((item) => <tr key={item.leavePolicyId}><td><strong>{item.displayName}</strong><small>{item.leaveType}</small></td><td>{item.payType === "PAID" ? "유급" : item.payType === "UNPAID" ? "무급" : "별도"}<small>연차 {item.annualDeductionDays}일 차감</small></td><td>{item.unitType === "FULL_DAY" ? "종일" : item.unitType === "HALF_DAY" ? "반일" : "종일/반일"}<small>{item.maxDays == null ? "한도 없음" : `최대 ${item.maxDays}일`} · {item.maxSegments == null ? "구간 제한 없음" : `${item.maxSegments}구간`}</small></td><td>{item.genderRestriction === "ALL" ? "성별 제한 없음" : item.genderRestriction === "FEMALE" ? "여성" : "남성"}<small>{item.evidenceRequired ? "증빙 필수" : "증빙 선택"} · 예외 {item.adminOverrideAllowed ? "허용" : "불가"}</small></td><td>{item.effectiveFrom}<small>~ {item.effectiveTo ?? "계속"}</small></td><td>{item.active ? "사용" : "중지"}<small>{item.changeReason}</small></td><td><button type="button" className="ghost" onClick={() => edit(item)}>수정</button></td></tr>)}</tbody></table></div>
    <SpouseBirthOverridePanel employees={employees} />
    <BereavementPolicyPanel />
  </div>;
}

function SpouseBirthOverridePanel({ employees }: { employees: Employee[] }) {
  const [empId, setEmpId] = useState(0);
  const [referenceDate, setReferenceDate] = useState(todayDate());
  const [maxDays, setMaxDays] = useState(20);
  const [maxSegments, setMaxSegments] = useState(4);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<SpouseOverride[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!empId && employees.length) setEmpId(employees[0].empId);
  }, [employees, empId]);

  async function load(target = empId) {
    if (!target) return;
    try {
      setHistory(await api<SpouseOverride[]>(`/leave-policy-overrides/spouse-birth?empId=${target}`));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "개인 예외 이력을 불러오지 못했습니다.");
    }
  }

  useEffect(() => { void load(empId); }, [empId]);

  async function saveOverride(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/leave-policy-overrides/spouse-birth", {
        method: "POST",
        body: jsonBody({ empId, referenceDate, maxDays, maxSegments, reason })
      });
      setMessage("개인 예외 조정과 변경 전후 이력을 저장했습니다.");
      setError("");
      setReason("");
      await load(empId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "개인 예외 조정을 저장하지 못했습니다.");
    }
  }

  async function revoke(item: SpouseOverride) {
    const revokeReason = window.prompt("예외 조정 해제 사유를 입력하세요.")?.trim();
    if (!revokeReason) return;
    try {
      await api(`/leave-policy-overrides/${item.policyOverrideId}`, { method: "DELETE", body: jsonBody({ reason: revokeReason }) });
      setMessage("예외 조정을 해제하고 이력을 보존했습니다.");
      await load(empId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "예외 조정을 해제하지 못했습니다.");
    }
  }

  return <div className="approval-detail-section">
    <div className="panel-head"><div><h3>배우자 출산휴가 개인 예외</h3><p className="muted-text">출산 기준일별 최대 일수와 연속 사용 구간을 조정하며 원 기준과 사유를 영구 보존합니다.</p></div></div>
    {message && <p className="template-note"><span>{message}</span></p>}{error && <p className="error">{error}</p>}
    <form className="template-form holiday-form" onSubmit={saveOverride}>
      <label>직원<select required value={empId} onChange={(event) => setEmpId(Number(event.target.value))}>{employees.map((employee) => <option key={employee.empId} value={employee.empId}>{employee.empName} · {employee.empNo}</option>)}</select></label>
      <label>출산 기준일<input required type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} /></label>
      <label>조정 최대일수<input required type="number" min="0.5" step="0.5" value={maxDays} onChange={(event) => setMaxDays(Number(event.target.value))} /></label>
      <label>조정 최대구간<input required type="number" min="1" value={maxSegments} onChange={(event) => setMaxSegments(Number(event.target.value))} /></label>
      <label className="wide">조정 사유<input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <div className="actions wide"><button type="submit"><Save size={16} /> 예외 조정 저장</button></div>
    </form>
    <div className="table-wrap"><table><thead><tr><th>기준일</th><th>일수</th><th>구간</th><th>사유/처리자</th><th>상태</th><th>관리</th></tr></thead><tbody>{history.map((item) => <tr key={item.policyOverrideId}><td>{item.referenceDate}</td><td>{item.baseMaxDays} → {item.overrideMaxDays}일</td><td>{item.baseMaxSegments} → {item.overrideMaxSegments}구간</td><td>{item.reason}<small>{item.grantedByName}</small></td><td>{item.active ? "적용 중" : "해제"}<small>{item.revokeReason ?? ""}</small></td><td>{item.active && <button type="button" className="ghost" onClick={() => void revoke(item)}>해제</button>}</td></tr>)}</tbody></table></div>
  </div>;
}
