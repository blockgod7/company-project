import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  RefreshCw,
  X
} from "lucide-react";
import { api } from "../api";
import type {
  ApprovalDashboard,
  ApprovalSummary,
  LeaveUsage,
  PageResponse,
  TrainingSchedule,
  WorkSchedule
} from "../types";

type CalendarKind = "work" | "training" | "leave";

type PersonalCalendarEvent = {
  id: string;
  kind: CalendarKind;
  startDate: string;
  endDate: string;
  title: string;
  detail: string;
  status: string;
  approvalId: number | null;
};

type PersonalCalendarPageProps = {
  onOpenApproval: (approvalId: number) => void;
};

const kindLabels: Record<CalendarKind, string> = {
  work: "근무",
  training: "교육",
  leave: "휴가"
};

export function PersonalCalendarPage({ onOpenApproval }: PersonalCalendarPageProps) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => localDate(today));
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [trainingSchedules, setTrainingSchedules] = useState<TrainingSchedule[]>([]);
  const [leaveUsage, setLeaveUsage] = useState<LeaveUsage | null>(null);
  const [requestedApprovals, setRequestedApprovals] = useState<ApprovalSummary[]>([]);
  const [actionApprovals, setActionApprovals] = useState<ApprovalSummary[]>([]);
  const [approvalDashboard, setApprovalDashboard] = useState<ApprovalDashboard | null>(null);
  const [visibleKinds, setVisibleKinds] = useState<Record<CalendarKind, boolean>>({ work: true, training: true, leave: true });
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  const range = monthRange(month);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const encodedRange = `dateFrom=${range.from}&dateTo=${range.to}`;
    const requests = [
      api<WorkSchedule[]>(`/work-schedules/me?from=${range.from}&to=${range.to}`),
      api<TrainingSchedule[]>(`/trainings/me?from=${range.from}&to=${range.to}`),
      api<LeaveUsage>(`/approvals/leave-usage/me?year=${month.getFullYear()}`),
      api<PageResponse<ApprovalSummary>>(`/approvals?box=requested&page=0&size=100&${encodedRange}`),
      api<PageResponse<ApprovalSummary>>("/approvals?box=pending&page=0&size=20&dashboardFilter=actionRequired"),
      api<ApprovalDashboard>("/approvals/dashboard")
    ] as const;

    void Promise.allSettled(requests).then((results) => {
      if (!active) return;
      const failures: string[] = [];
      const [work, training, leave, requested, actionRequired, dashboard] = results;
      if (work.status === "fulfilled") setWorkSchedules(work.value); else { setWorkSchedules([]); failures.push("근무"); }
      if (training.status === "fulfilled") setTrainingSchedules(training.value); else { setTrainingSchedules([]); failures.push("교육"); }
      if (leave.status === "fulfilled") setLeaveUsage(leave.value); else { setLeaveUsage(null); failures.push("휴가"); }
      if (requested.status === "fulfilled") setRequestedApprovals(requested.value.content); else { setRequestedApprovals([]); failures.push("기안문서"); }
      if (actionRequired.status === "fulfilled") setActionApprovals(actionRequired.value.content); else { setActionApprovals([]); failures.push("처리할 결재"); }
      if (dashboard.status === "fulfilled") setApprovalDashboard(dashboard.value); else { setApprovalDashboard(null); failures.push("결재 요약"); }
      setError(failures.length ? `${[...new Set(failures)].join("·")} 정보를 불러오지 못했습니다.` : "");
      setLoading(false);
    });

    return () => { active = false; };
  }, [monthKey]);

  useEffect(() => {
    if (!detailOpen) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = detailTriggerRef.current;
    const focusFrame = window.requestAnimationFrame(() => dialogCloseRef.current?.focus());
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeyDown);
      if (trigger && document.contains(trigger)) window.requestAnimationFrame(() => trigger.focus());
    };
  }, [detailOpen]);

  const events = useMemo<PersonalCalendarEvent[]>(() => {
    const workEvents = workSchedules.map((item) => ({
      id: `work-${item.workEntryId}`,
      kind: "work" as const,
      startDate: item.workDate,
      endDate: item.workDate,
      title: workTypeLabel(item.workType),
      detail: `${item.startTime.slice(0, 5)}~${item.endTime.slice(0, 5)} · ${item.workContent || "근무 일정"}`,
      status: workStatusLabel(item.status),
      approvalId: item.approvalId
    }));
    const trainingEvents = trainingSchedules.map((item) => ({
      id: `training-${item.sourceApprovalId}`,
      kind: "training" as const,
      startDate: item.startDate,
      endDate: item.endDate,
      title: item.trainingName,
      detail: `${item.institution || "교육기관 미지정"} · ${item.startDate} ~ ${item.endDate}`,
      status: trainingStatusLabel(item.status),
      approvalId: item.currentApprovalId || item.sourceApprovalId
    }));
    const leaveEvents = (leaveUsage?.selections ?? [])
      .filter((item) => item.date >= range.from && item.date <= range.to)
      .map((item, index) => ({
        id: `leave-${item.approvalId ?? "none"}-${item.date}-${index}`,
        kind: "leave" as const,
        startDate: item.date,
        endDate: item.date,
        title: item.type,
        detail: `${formatDays(item.days)}일${item.documentNo ? ` · ${item.documentNo}` : ""}`,
        status: "승인 휴가",
        approvalId: item.approvalId
      }));
    return [...workEvents, ...trainingEvents, ...leaveEvents];
  }, [workSchedules, trainingSchedules, leaveUsage, range.from, range.to]);

  const visibleEvents = events.filter((item) => visibleKinds[item.kind]);
  const selectedEvents = visibleEvents.filter((item) => item.startDate <= selectedDate && item.endDate >= selectedDate);
  const cells = calendarCells(month);
  const inProgressCount = requestedApprovals.filter((item) => item.status === "PENDING" || item.status === "IN_PROGRESS").length;
  const approvedCount = requestedApprovals.filter((item) => item.status === "APPROVED").length;
  const scheduleCount = workSchedules.length + trainingSchedules.length + (leaveUsage?.selections.filter((item) => item.date >= range.from && item.date <= range.to).length ?? 0);

  function moveMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(localDate(next));
    setDetailOpen(false);
  }

  function moveToday() {
    const next = new Date(today.getFullYear(), today.getMonth(), 1);
    setMonth(next);
    setSelectedDate(localDate(today));
    setDetailOpen(false);
  }

  function toggleKind(kind: CalendarKind) {
    setVisibleKinds((current) => ({ ...current, [kind]: !current[kind] }));
  }

  function showAllKinds() {
    setVisibleKinds({ work: true, training: true, leave: true });
  }

  function openDate(cell: Date, trigger: HTMLElement) {
    const date = localDate(cell);
    if (cell.getFullYear() !== month.getFullYear() || cell.getMonth() !== month.getMonth()) {
      setMonth(new Date(cell.getFullYear(), cell.getMonth(), 1));
    }
    detailTriggerRef.current = trigger;
    setSelectedDate(date);
    setDetailOpen(true);
  }

  function moveDetailDate(offset: number) {
    const [year, monthNumber, day] = selectedDate.split("-").map(Number);
    const next = new Date(year, monthNumber - 1, day + offset);
    if (next.getFullYear() !== month.getFullYear() || next.getMonth() !== month.getMonth()) {
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
    setSelectedDate(localDate(next));
  }

  const allKindsVisible = Object.values(visibleKinds).every(Boolean);

  return (
    <section className="personal-calendar-page">
      <header className="personal-calendar-hero">
        <div>
          <span>MY WORKSPACE</span>
          <h1>개인 캘린더</h1>
          <p>근무·교육·휴가 일정과 내가 처리하거나 상신한 결재를 한 화면에서 확인합니다.</p>
        </div>
        <button type="button" className="ghost" onClick={moveToday}><CalendarCheck2 size={17} /> 오늘 보기</button>
      </header>

      <div className="personal-calendar-metrics" aria-label="개인 결재 요약">
        <MetricCard icon={CalendarDays} label="이번 달 일정" value={scheduleCount} tone="navy" />
        <MetricCard icon={Clock3} label="진행 중 기안" value={inProgressCount} tone="blue" />
        <MetricCard icon={CheckCircle2} label="승인 완료" value={approvedCount} tone="green" />
        <MetricCard icon={ClipboardCheck} label="내 결재 대기" value={(approvalDashboard?.myPendingCount ?? 0) + (approvalDashboard?.delegatedPendingCount ?? 0)} tone="lime" />
      </div>

      {error && <p className="personal-calendar-warning" role="alert">{error}</p>}

      <div className="personal-calendar-layout">
        <section className="personal-calendar-board" aria-busy={loading}>
          <div className="personal-calendar-toolbar">
            <div className="personal-calendar-month-nav">
              <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft size={19} /></button>
              <strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong>
              <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight size={19} /></button>
            </div>
            <div className="personal-calendar-filters" aria-label="일정 종류 필터">
              <button type="button" className={`all ${allKindsVisible ? "active" : ""}`} aria-pressed={allKindsVisible} onClick={showAllKinds}>
                <i /> 전체 보기
              </button>
              {(Object.keys(kindLabels) as CalendarKind[]).map((kind) => (
                <button key={kind} type="button" className={`${kind} ${visibleKinds[kind] ? "active" : ""}`} aria-pressed={visibleKinds[kind]} onClick={() => toggleKind(kind)}>
                  <i /> {kindLabels[kind]}
                </button>
              ))}
            </div>
          </div>

          <div className="personal-calendar-grid-scroll">
            <div className="personal-calendar-weekdays" aria-hidden="true">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="personal-calendar-grid">
              {cells.map((cell) => {
                const date = localDate(cell);
                const dayEvents = visibleEvents.filter((item) => item.startDate <= date && item.endDate >= date);
                const isToday = date === localDate(today);
                const selected = date === selectedDate;
                return (
                  <div
                    key={date}
                    className={`personal-calendar-day${cell.getMonth() === month.getMonth() ? "" : " outside"}${isToday ? " today" : ""}${selected ? " selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${date}, 일정 ${dayEvents.length}건, 상세보기`}
                    onClick={(event) => openDate(cell, event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDate(cell, event.currentTarget);
                      }
                    }}
                  >
                    <span className="personal-calendar-day-number">{cell.getDate()}</span>
                    <div className="personal-calendar-day-events">
                      {dayEvents.slice(0, 2).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`personal-calendar-event ${item.kind}`}
                          title={`${item.title} · ${item.status}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedDate(date);
                            if (item.approvalId) onOpenApproval(item.approvalId);
                            else {
                              detailTriggerRef.current = event.currentTarget;
                              setDetailOpen(true);
                            }
                          }}
                        >
                          {item.title}
                        </button>
                      ))}
                      {dayEvents.length > 2 && <small>+{dayEvents.length - 2}건</small>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="personal-approval-overview">
          <div className="personal-approval-overview-head">
            <div><span>PERSONAL APPROVAL</span><h2>내 결재 종합</h2></div>
            {loading && <RefreshCw className="spinning" size={17} />}
          </div>

          <ApprovalGroup title="내가 처리할 결재" count={actionApprovals.length} items={actionApprovals.slice(0, 5)} empty="현재 처리할 결재가 없습니다." onOpen={onOpenApproval} />
          <ApprovalGroup title="이번 달 내가 올린 문서" count={requestedApprovals.length} items={requestedApprovals.slice(0, 8)} empty="이번 달에 올린 문서가 없습니다." onOpen={onOpenApproval} />
        </aside>
      </div>

      {detailOpen && (
        <div
          className="personal-calendar-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setDetailOpen(false);
          }}
        >
          <section ref={dialogRef} className="personal-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="personal-calendar-dialog-title">
            <header>
              <div>
                <span>DATE DETAIL</span>
                <h2 id="personal-calendar-dialog-title">{formatKoreanDate(selectedDate)}</h2>
                <p>선택한 날짜의 근무·교육·휴가 일정을 확인합니다.</p>
              </div>
              <button ref={dialogCloseRef} type="button" aria-label="상세보기 닫기" onClick={() => setDetailOpen(false)}><X size={20} /></button>
            </header>
            <div className="personal-calendar-dialog-tools" aria-label="상세 날짜 이동">
              <button type="button" onClick={() => moveDetailDate(-1)}><ChevronLeft size={17} /> 이전 날짜</button>
              <div className="personal-calendar-dialog-summary"><strong>{selectedEvents.length}</strong><span>개의 일정</span></div>
              <button type="button" onClick={() => moveDetailDate(1)}>다음 날짜 <ChevronRight size={17} /></button>
            </div>
            {loading ? <CalendarEmpty text="일정을 불러오는 중입니다." /> : selectedEvents.length ? (
              <div className="personal-calendar-selection-list">
                {selectedEvents.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={item.approvalId ? "has-approval" : ""}
                    onClick={() => item.approvalId && onOpenApproval(item.approvalId)}
                    disabled={!item.approvalId}
                  >
                    <span className={`personal-calendar-kind ${item.kind}`}>{kindLabels[item.kind]}</span>
                    <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                    <em>{item.status}</em>
                    {item.approvalId && <ChevronRight size={17} />}
                  </button>
                ))}
              </div>
            ) : <CalendarEmpty text="선택한 날짜에 등록된 일정이 없습니다." />}
            <footer>
              <p>결재 문서가 연결된 일정은 항목을 눌러 원문을 확인할 수 있습니다.</p>
              <button type="button" className="ghost" onClick={() => setDetailOpen(false)}>닫기</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof CalendarDays; label: string; value: number; tone: "navy" | "blue" | "green" | "lime" }) {
  return <div className={`personal-calendar-metric ${tone}`}><span><Icon size={19} /></span><div><strong>{value.toLocaleString("ko-KR")}</strong><small>{label}</small></div></div>;
}

function ApprovalGroup({ title, count, items, empty, onOpen }: { title: string; count: number; items: ApprovalSummary[]; empty: string; onOpen: (approvalId: number) => void }) {
  return (
    <section className="personal-approval-group">
      <header><h3>{title}</h3><span>{count}건</span></header>
      {items.length ? <div className="personal-approval-list">{items.map((item) => (
        <button type="button" key={item.approvalId} onClick={() => onOpen(item.approvalId)}>
          <span className="personal-approval-document"><strong>{item.title}</strong><small>{item.documentNo ?? "임시 문서"} · {formatShortDate(item.completedAt ?? item.requestedAt)}</small></span>
          <span className={`personal-approval-status ${item.status.toLowerCase()}`}>{approvalStatusLabel(item.status)}</span>
          <ChevronRight size={16} />
        </button>
      ))}</div> : <CalendarEmpty text={empty} />}
    </section>
  );
}

function CalendarEmpty({ text }: { text: string }) {
  return <div className="personal-calendar-empty"><CalendarDays size={25} /><span>{text}</span></div>;
}

function monthRange(month: Date) {
  return {
    from: localDate(new Date(month.getFullYear(), month.getMonth(), 1)),
    to: localDate(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  };
}

function calendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cursor = new Date(month.getFullYear(), month.getMonth(), 1 - first.getDay());
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const requiredCells = first.getDay() + last.getDate();
  const cellCount = requiredCells <= 35 ? 35 : 42;
  return Array.from({ length: cellCount }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + index));
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function formatDays(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) : value;
}

function approvalStatusLabel(status: ApprovalSummary["status"]) {
  return ({ DRAFT: "임시저장", PENDING: "상신", IN_PROGRESS: "진행 중", APPROVED: "승인", REJECTED: "반려", WITHDRAWN: "회수", CANCELED: "취소" })[status];
}

function workTypeLabel(type: WorkSchedule["workType"]) {
  return ({ OVERTIME: "주간 잔업", NIGHT: "야간", NIGHT_OVERTIME: "야간 잔업", SPECIAL: "특근", SPECIAL_OVERTIME: "특근 + 잔업", SPECIAL_NIGHT: "특근 + 야간", SPECIAL_NIGHT_OVERTIME: "특근 + 야간 + 잔업", EMERGENCY_CALL: "비상호출" })[type];
}

function workStatusLabel(status: WorkSchedule["status"]) {
  return ({ PENDING: "결재 중", PLANNED: "근무 예정", COMPLETED: "근무 완료", CANCEL_PENDING: "취소 결재 중", CANCELED: "취소" })[status];
}

function trainingStatusLabel(status: TrainingSchedule["status"]) {
  return ({ PLANNED: "교육 예정", IN_PROGRESS: "교육 중", ENDED: "교육 종료", COMPLETED: "이수 완료", CANCELED: "취소" })[status];
}
