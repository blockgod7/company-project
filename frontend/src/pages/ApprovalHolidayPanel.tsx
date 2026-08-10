import { CalendarDays, CheckCircle2, Eye, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, jsonBody } from "../api";
import type { ApprovalHoliday } from "../types";
import { todayDate } from "../utils/approvalDomain";

type HolidayForm = {
  holidayDate: string;
  holidayName: string;
  holidayType: ApprovalHoliday["holidayType"];
  sourceType: ApprovalHoliday["sourceType"];
  repeatType: ApprovalHoliday["repeatType"];
  basisSource: string;
  overrideReason: string;
  active: boolean;
};

type HolidayImpact = {
  holidayId: number;
  holidayDate: string;
  holidayName: string;
  affectedCount: number;
  items: {
    approvalId: number;
    documentNo: string | null;
    requesterEmpId: number;
    requesterName: string;
    leaveDate: string;
    leaveType: string;
    restoredDays: string;
  }[];
};

type OfficialSyncResult = {
  year: number;
  createdCount: number;
  updatedCount: number;
  adjustedLeaveCount: number;
  totalCount: number;
  policyVersion: string;
  basisSource: string;
};

type OfficialProviderStatus = {
  builtInYears: number[];
  openApiConfigured: boolean;
  providerName: string;
  basisSource: string;
};

type OfficialImpact = {
  year: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  conflictCount: number;
  affectedLeaveCount: number;
  totalCount: number;
  policyVersion: string;
  basisSource: string;
  previewToken: string;
  items: {
    holidayDate: string;
    holidayName: string;
    holidayType: ApprovalHoliday["holidayType"];
    changeType: "CREATE" | "UPDATE" | "UNCHANGED" | "CONFLICT";
    affectedCount: number;
  }[];
};

const EMPTY_FORM: HolidayForm = {
  holidayDate: todayDate(),
  holidayName: "",
  holidayType: "COMPANY_HOLIDAY",
  sourceType: "COMPANY",
  repeatType: "YEAR_ONLY",
  basisSource: "",
  overrideReason: "",
  active: false
};

const HOLIDAY_TYPE_LABELS: Record<ApprovalHoliday["holidayType"], string> = {
  PUBLIC_HOLIDAY: "공휴일",
  SUBSTITUTE_HOLIDAY: "대체공휴일",
  COMPANY_HOLIDAY: "회사 지정휴일",
  OTHER: "기타"
};

const SOURCE_LABELS: Record<ApprovalHoliday["sourceType"], string> = {
  LEGAL: "법정공휴일",
  COMPANY: "회사 자체 휴일"
};

const REPEAT_LABELS: Record<ApprovalHoliday["repeatType"], string> = {
  YEAR_ONLY: "당해연도만",
  ANNUAL: "매년 반복"
};

export function ApprovalHolidayPanel({ onChanged }: { onChanged: () => void | Promise<void> }) {
  const [items, setItems] = useState<ApprovalHoliday[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM);
  const [officialYear, setOfficialYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [impact, setImpact] = useState<HolidayImpact | null>(null);
  const [officialImpact, setOfficialImpact] = useState<OfficialImpact | null>(null);
  const [providerStatus, setProviderStatus] = useState<OfficialProviderStatus | null>(null);

  async function load() {
    try {
      const [holidays, status] = await Promise.all([
        api<ApprovalHoliday[]>("/approval-holidays/manage"),
        api<OfficialProviderStatus>("/approval-holidays/official/provider-status")
      ]);
      setItems(holidays);
      setProviderStatus(status);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴일 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, holidayDate: todayDate() });
  }

  function edit(item: ApprovalHoliday) {
    let overrideReason = "";
    if (item.official) {
      overrideReason = window.prompt("공식 법정공휴일의 예외 수정 사유를 입력해 주세요.")?.trim() ?? "";
      if (!overrideReason) return;
    }
    setEditingId(item.holidayId);
    setForm({
      holidayDate: item.holidayDate,
      holidayName: item.holidayName,
      holidayType: item.holidayType,
      sourceType: item.sourceType,
      repeatType: item.repeatType,
      basisSource: item.basisSource ?? "",
      overrideReason,
      active: item.active
    });
    setMessage("");
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api<ApprovalHoliday>(editingId ? `/approval-holidays/${editingId}` : "/approval-holidays", {
        method: editingId ? "PUT" : "POST",
        body: jsonBody(form)
      });
      setMessage(editingId ? "휴일 정보를 수정했습니다." : "휴일을 임시 등록했습니다. 영향 확인 후 활성화해 주세요.");
      resetForm();
      await Promise.all([load(), Promise.resolve(onChanged())]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴일 저장 중 오류가 발생했습니다.");
    }
  }

  async function previewOfficial() {
    setMessage("");
    setError("");
    try {
      setOfficialImpact(await api<OfficialImpact>(`/approval-holidays/official/${officialYear}/impact`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "공식 공휴일 영향을 확인하지 못했습니다.");
    }
  }

  async function syncOfficial(previewResult: OfficialImpact) {
    let overrideReason = "";
    if (previewResult.conflictCount > 0) {
      overrideReason = window.prompt(`회사 휴일과 ${previewResult.conflictCount}건이 충돌합니다. 공식 기준으로 덮어쓸 예외 사유를 입력해 주세요.`)?.trim() ?? "";
      if (!overrideReason) return;
    }
    if (!window.confirm(`${previewResult.year}년 공식 공휴일 ${previewResult.totalCount}건을 반영할까요?`)) return;
    setMessage("");
    setError("");
    try {
      const result = await api<OfficialSyncResult>(`/approval-holidays/official/${previewResult.year}/sync`, {
        method: "POST",
        body: jsonBody({ previewToken: previewResult.previewToken, overrideReason })
      });
      setMessage(`${result.year}년 법정공휴일 ${result.totalCount}건 반영 완료 · 신규 ${result.createdCount}건 · 갱신 ${result.updatedCount}건 · 연차 복원 ${result.adjustedLeaveCount}건`);
      setOfficialImpact(null);
      await Promise.all([load(), Promise.resolve(onChanged())]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공식 공휴일을 반영하지 못했습니다.");
    }
  }

  async function preview(item: ApprovalHoliday) {
    setError("");
    try {
      setImpact(await api<HolidayImpact>(`/approval-holidays/${item.holidayId}/impact`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "영향 내역을 불러오지 못했습니다.");
    }
  }

  async function activate(item: ApprovalHoliday) {
    const result = await api<HolidayImpact>(`/approval-holidays/${item.holidayId}/impact`);
    setImpact(result);
    if (!window.confirm(`${item.holidayDate} ${item.holidayName}을 활성화할까요? 승인 휴가 ${result.affectedCount}건이 자동 제외됩니다.`)) return;
    const overrideReason = item.official
      ? window.prompt("공식 법정공휴일을 예외 활성화하는 사유를 입력해 주세요.")?.trim() ?? ""
      : "";
    if (item.official && !overrideReason) return;
    try {
      await api<ApprovalHoliday>(`/approval-holidays/${item.holidayId}/activate`, {
        method: "POST",
        body: jsonBody({ reason: overrideReason })
      });
      setMessage(`휴일을 활성화하고 승인 휴가 ${result.affectedCount}건을 조정했습니다.`);
      setImpact(null);
      await Promise.all([load(), Promise.resolve(onChanged())]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴일을 활성화하지 못했습니다.");
    }
  }

  async function deactivate(item: ApprovalHoliday) {
    if (!window.confirm(`${item.holidayDate} ${item.holidayName}을 비활성화할까요? 자동 제외했던 휴가는 원래 사용량으로 복원됩니다.`)) return;
    const overrideReason = item.official
      ? window.prompt("공식 법정공휴일을 예외 비활성화하는 사유를 입력해 주세요.")?.trim() ?? ""
      : "";
    if (item.official && !overrideReason) return;
    setMessage("");
    setError("");
    try {
      await api<ApprovalHoliday>(`/approval-holidays/${item.holidayId}`, {
        method: "DELETE",
        body: jsonBody({ reason: overrideReason })
      });
      setMessage("휴일을 비활성화했습니다. 이력은 보존됩니다.");
      if (editingId === item.holidayId) resetForm();
      await Promise.all([load(), Promise.resolve(onChanged())]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "휴일 비활성화 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="approval-template-editor holiday-management-panel">
      <div className="panel-head">
        <div>
          <h3><CalendarDays size={18} /> 휴일 관리</h3>
          <p className="muted-text">법정공휴일은 공식 월력요항을 연도별로 반영하고, 회사 자체 휴일은 당해연도 또는 매년 반복으로 관리합니다.</p>
        </div>
        <button type="button" className="ghost" onClick={() => void load()}><RefreshCw size={16} /> 새로고침</button>
      </div>

      {message && <p className="template-note"><span>{message}</span></p>}
      {error && <p className="error">{error}</p>}

      <section className="holiday-official-sync">
        <div>
          <strong>법정공휴일 자동 반영</strong>
          <span>{providerStatus?.providerName ?? "공식 월력요항"} · 내장 {providerStatus?.builtInYears.join(", ") ?? "확인 중"} · 공공데이터 연동 {providerStatus?.openApiConfigured ? "사용" : "미설정"}</span>
        </div>
        <input aria-label="공식 공휴일 연도" type="number" min={2026} max={2100} value={officialYear} onChange={(event) => setOfficialYear(Number(event.target.value))} />
        <button type="button" onClick={() => void previewOfficial()}><Eye size={16} /> 영향 확인 후 반영</button>
      </section>
      {providerStatus && !providerStatus.openApiConfigured && <p className="muted-text">2028년 이후 자동 조회에는 서버 환경변수 <code>HOLIDAY_OPEN_API_ENABLED=true</code>와 공공데이터 서비스 키가 필요합니다.</p>}

      <form className="template-form holiday-form" onSubmit={save}>
        <label>날짜<input required type="date" value={form.holidayDate} onChange={(event) => setForm({ ...form, holidayDate: event.target.value })} /></label>
        <label>휴일명<input required maxLength={100} value={form.holidayName} onChange={(event) => setForm({ ...form, holidayName: event.target.value })} placeholder="예: 창립기념일" /></label>
        <label>유형<select value={form.holidayType} onChange={(event) => setForm({ ...form, holidayType: event.target.value as HolidayForm["holidayType"] })}>{Object.entries(HOLIDAY_TYPE_LABELS).filter(([value]) => form.sourceType === "LEGAL" ? ["PUBLIC_HOLIDAY", "SUBSTITUTE_HOLIDAY"].includes(value) : ["COMPANY_HOLIDAY", "OTHER"].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>구분<select value={form.sourceType} disabled><option value={form.sourceType}>{SOURCE_LABELS[form.sourceType]}</option></select></label>
        <label>적용 방식<select value={form.repeatType} disabled={form.sourceType === "LEGAL"} onChange={(event) => setForm({ ...form, repeatType: event.target.value as HolidayForm["repeatType"] })}>{Object.entries(REPEAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="wide">근거/메모<input maxLength={500} value={form.basisSource} onChange={(event) => setForm({ ...form, basisSource: event.target.value })} placeholder="회사 공지, 취업규칙 등 선택 입력" /></label>
        {form.sourceType === "LEGAL" && <label className="wide">예외 변경 사유<input required maxLength={500} value={form.overrideReason} onChange={(event) => setForm({ ...form, overrideReason: event.target.value })} /></label>}
        <div className="template-note wide"><span>회사 자체 휴일의 ‘매년 반복’은 선택한 월·일에 이후 연도에도 자동 적용됩니다.</span></div>
        <div className="actions wide">
          {editingId && <button type="button" className="ghost" onClick={resetForm}><Plus size={16} /> 새 휴일</button>}
          <button type="submit"><Save size={16} /> {editingId ? "수정 저장" : "휴일 등록"}</button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead><tr><th>날짜</th><th>휴일명</th><th>유형</th><th>구분</th><th>적용</th><th>상태</th><th>관리</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.holidayId}>
                <td>{item.holidayDate}</td>
                <td>{item.holidayName}</td>
                <td>{HOLIDAY_TYPE_LABELS[item.holidayType]}</td>
                <td>{SOURCE_LABELS[item.sourceType]}{item.official ? " · 공식" : ""}</td>
                <td>{REPEAT_LABELS[item.repeatType]}</td>
                <td>{item.active ? "활성" : "비활성"}</td>
                <td><div className="actions"><button type="button" className="ghost" onClick={() => edit(item)}>{item.official ? "예외 수정" : "수정"}</button><button type="button" className="ghost" onClick={() => void preview(item)}><Eye size={15} /> 영향</button>{!item.active && <button type="button" onClick={() => void activate(item)}><CheckCircle2 size={15} /> {item.official ? "예외 활성화" : "활성화"}</button>}{item.active && <button type="button" className="ghost danger" onClick={() => void deactivate(item)}><Trash2 size={15} /> {item.official ? "예외 비활성화" : "비활성화"}</button>}</div></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7} className="muted-text">등록된 휴일이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      {impact && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setImpact(null)}>
          <div className="modal-card holiday-impact-modal">
            <div className="modal-head"><h3>휴일 적용 영향 미리보기</h3><button className="ghost" onClick={() => setImpact(null)}>닫기</button></div>
            <p><strong>{impact.holidayDate} · {impact.holidayName}</strong>을 활성화하면 승인 휴가 <strong>{impact.affectedCount}건</strong>이 자동 제외됩니다.</p>
            <div className="table-wrap"><table><thead><tr><th>휴가일</th><th>문서번호</th><th>신청자</th><th>휴가 종류</th><th>복원 연차</th></tr></thead><tbody>{impact.items.map((item) => <tr key={`${item.approvalId}-${item.leaveDate}-${item.leaveType}`}><td>{item.leaveDate}</td><td>{item.documentNo ?? item.approvalId}</td><td>{item.requesterName}</td><td>{item.leaveType}</td><td>{item.restoredDays}일</td></tr>)}{!impact.items.length && <tr><td colSpan={5}>영향받는 승인 휴가가 없습니다.</td></tr>}</tbody></table></div>
          </div>
        </div>
      )}

      {officialImpact && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOfficialImpact(null)}>
          <div className="modal-card holiday-impact-modal">
            <div className="modal-head"><h3>{officialImpact.year}년 공식 공휴일 반영 미리보기</h3><button className="ghost" onClick={() => setOfficialImpact(null)}>닫기</button></div>
            <p>신규 <strong>{officialImpact.createdCount}건</strong> · 갱신 <strong>{officialImpact.updatedCount}건</strong> · 충돌 <strong>{officialImpact.conflictCount}건</strong> · 승인 휴가 영향 <strong>{officialImpact.affectedLeaveCount}건</strong></p>
            <p className="muted-text">정책 {officialImpact.policyVersion} · <a href={officialImpact.basisSource} target="_blank" rel="noreferrer">연도별 공식 출처</a></p>
            <div className="table-wrap"><table><thead><tr><th>날짜</th><th>휴일명</th><th>변경</th><th>휴가 영향</th></tr></thead><tbody>{officialImpact.items.map((item) => <tr key={item.holidayDate}><td>{item.holidayDate}</td><td>{item.holidayName}</td><td>{item.changeType}</td><td>{item.affectedCount}건</td></tr>)}</tbody></table></div>
            <div className="actions"><button type="button" className="ghost" onClick={() => setOfficialImpact(null)}>취소</button><button type="button" onClick={() => void syncOfficial(officialImpact)}><CheckCircle2 size={16} /> 이 내용으로 반영</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
