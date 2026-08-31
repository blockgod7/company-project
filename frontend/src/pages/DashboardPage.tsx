import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  MessageSquare,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../api";
import { CardHeader } from "../components/CardHeader";
import type { ApprovalDashboard, Board, Notice, NotificationItem, PageResponse, User, WorkSchedule } from "../types";

type DashboardRoute = "notices" | "boards" | "notifications" | "organization";
type DashboardApprovalBox = "pending" | "requested";
type DashboardApprovalFilter = "myPending" | "delegatedPending" | "overdue" | "requestedInProgress" | "recentCompleted";
type DashboardApprovalLaunch = { box: DashboardApprovalBox; dashboardFilter?: DashboardApprovalFilter; label: string };

type DashboardPageProps = {
  user: User;
  go: (route: DashboardRoute) => void;
  openApprovals: (target?: DashboardApprovalLaunch) => void;
};

export function DashboardPage({ user, go, openApprovals }: DashboardPageProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [approvalDashboard, setApprovalDashboard] = useState<ApprovalDashboard | null>(null);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const approvalCounts = {
    myPending: approvalDashboard?.myPendingCount ?? 0,
    delegatedPending: approvalDashboard?.delegatedPendingCount ?? 0,
    overdue: approvalDashboard?.overdueCount ?? 0,
    requestedInProgress: approvalDashboard?.requestedInProgressCount ?? 0,
    recentCompleted: approvalDashboard?.recentCompletedCount ?? 0
  };

  useEffect(() => {
    void api<PageResponse<Notice>>("/notices?size=5").then((page) => setNotices(page.content));
    void api<Board[]>("/boards").then(setBoards);
    void api<PageResponse<NotificationItem>>("/notifications?readYn=N&size=5").then((page) => setNotifications(page.content));
    void api<ApprovalDashboard>("/approvals/dashboard").then(setApprovalDashboard).catch(() => setApprovalDashboard(null));
  }, []);

  useEffect(() => {
    const from = localDate(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const last = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const to = localDate(calendarMonth.getFullYear(), calendarMonth.getMonth(), last);
    void api<WorkSchedule[]>(`/work-schedules/me?from=${from}&to=${to}`).then(setWorkSchedules).catch(() => setWorkSchedules([]));
  }, [calendarMonth]);

  return (
    <section className="portal-grid">
      <div className="portal-card pending-card">
        <CardHeader title="전자결재" action="바로가기" icon={ClipboardCheck} onAction={() => openApprovals()} />
        <div className="approval-preview">
          <button type="button" onClick={() => openApprovals({ box: "pending", dashboardFilter: "myPending", label: "내 결재대기" })}><strong title={`${formatCount(approvalCounts.myPending)}건`}>{formatCount(approvalCounts.myPending)}</strong><span>내 결재대기</span></button>
          <button type="button" onClick={() => openApprovals({ box: "pending", dashboardFilter: "delegatedPending", label: "대리대기" })}><strong title={`${formatCount(approvalCounts.delegatedPending)}건`}>{formatCount(approvalCounts.delegatedPending)}</strong><span>대리대기</span></button>
          <button type="button" onClick={() => openApprovals({ box: "pending", dashboardFilter: "overdue", label: "기한초과" })}><strong title={`${formatCount(approvalCounts.overdue)}건`}>{formatCount(approvalCounts.overdue)}</strong><span>기한초과</span></button>
          <button type="button" onClick={() => openApprovals({ box: "requested", dashboardFilter: "requestedInProgress", label: "진행문서" })}><strong title={`${formatCount(approvalCounts.requestedInProgress)}건`}>{formatCount(approvalCounts.requestedInProgress)}</strong><span>진행문서</span></button>
          <button type="button" onClick={() => openApprovals({ box: "requested", dashboardFilter: "recentCompleted", label: "최근완료" })}><strong title={`${formatCount(approvalCounts.recentCompleted)}건`}>{formatCount(approvalCounts.recentCompleted)}</strong><span>최근완료</span></button>
        </div>
      </div>

      <div className="portal-card schedule-card">
        <CardHeader title="내 근무 일정" icon={CalendarDays} />
        <div className="schedule-date">{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</div>
        {workSchedules.length ? <div className="work-schedule-list">{workSchedules.slice(0, 5).map((item) => <div className="feed-row" key={item.workEntryId}><strong>{item.workDate} · {workTypeLabel(item.workType)}</strong><span>{item.startTime.slice(0, 5)}~{item.endTime.slice(0, 5)}{item.scheduledShift ? ` · ${item.scheduledShift === "DAY" ? "주간" : item.scheduledShift === "NIGHT" ? "야간" : `${item.scheduledShift}조`}` : ""} · {workStatusLabel(item.status)}</span></div>)}</div> : <div className="empty compact"><CalendarDays size={34} /><span>이번 달 근무 일정이 없습니다.</span></div>}
      </div>

      <div className="portal-card calendar-card">
        <CardHeader title="업무 캘린더" icon={CalendarDays} />
        <MiniCalendar month={calendarMonth} schedules={workSchedules} onMonthChange={setCalendarMonth} />
      </div>

      <div className="portal-card board-card">
        <CardHeader title="게시판" action="바로가기" icon={MessageSquare} onAction={() => go("boards")} />
        <div className="tab-row">
          <span className="active">공지사항</span>
          <span>게시판</span>
          <span>알림</span>
        </div>
        {notices.length ? notices.map((notice) => (
          <button className="feed-row" key={notice.noticeId} onClick={() => go("notices")}>
            <strong>{notice.pinned ? "[고정] " : ""}{notice.title}</strong>
            <span>{formatDate(notice.createdAt)}</span>
          </button>
        )) : <DashboardEmpty text="최근 공지가 없습니다." />}
      </div>

      <div className="portal-card dashboard-summary-card">
        <div className="dashboard-summary-head">
          <CardHeader title="업무 바로가기" icon={UserRound} />
          <p>{user.empName}님, 확인이 필요한 업무를 빠르게 살펴보세요.</p>
        </div>
        <div className="dashboard-summary-actions">
          <DashboardMetricCard icon={BookOpen} label="공지사항" value={notices.length} caption="최근 표시" onClick={() => go("notices")} />
          <DashboardMetricCard icon={MessageSquare} label="게시판" value={boards.length} caption="사용 가능" onClick={() => go("boards")} />
          <DashboardMetricCard icon={Bell} label="미읽음 알림" value={notifications.length} caption="확인 필요" onClick={() => go("notifications")} />
          <button className="dashboard-shortcut" onClick={() => go("notifications")}><Bell size={18} /><span>알림 확인</span></button>
          <button className="dashboard-shortcut" onClick={() => go("organization")}><UserRound size={18} /><span>조직도</span></button>
        </div>
      </div>
    </section>
  );
}

function DashboardMetricCard({ icon: Icon, label, value, caption, onClick }: { icon: LucideIcon; label: string; value: number; caption: string; onClick: () => void }) {
  return (
    <button className="metric-card" onClick={onClick}>
      <Icon size={22} />
      <strong title={formatCount(value)}>{formatCount(value)}</strong>
      <span>{label}</span>
      <small>{caption}</small>
    </button>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function MiniCalendar({ month, schedules, onMonthChange }: { month: Date; schedules: WorkSchedule[]; onMonthChange: (month: Date) => void }) {
  const today = new Date();
  const days = Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => index + 1);
  const blanks = Array.from({ length: new Date(month.getFullYear(), month.getMonth(), 1).getDay() }, (_, index) => index);

  return (
    <div className="mini-calendar">
      <div className="calendar-month-nav"><button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{month.toLocaleDateString("ko-KR", { month: "long", year: "numeric" })}</strong><button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
      <div className="weekdays">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>
      <div className="days">
        {blanks.map((item) => <span key={`blank-${item}`} className="calendar-blank" />)}
        {days.map((day) => {
          const items = schedules.filter((item) => Number(item.workDate.slice(-2)) === day);
          const current = day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
          return <span key={day} title={items.map((item) => `${workTypeLabel(item.workType)} ${workStatusLabel(item.status)}`).join(", ")} className={`${current ? "today" : ""}${items.length ? " has-work" : ""}`}>{day}{items.length ? <i /> : null}</span>;
        })}
      </div>
    </div>
  );
}

function workTypeLabel(type: WorkSchedule["workType"]) {
  if (type === "OVERTIME") return "주간 잔업";
  if (type === "NIGHT") return "야간";
  if (type === "NIGHT_OVERTIME") return "야간 잔업";
  if (type === "SPECIAL") return "특근";
  if (type === "SPECIAL_OVERTIME") return "특근 + 잔업";
  if (type === "SPECIAL_NIGHT") return "특근 + 야간";
  if (type === "SPECIAL_NIGHT_OVERTIME") return "특근 + 야간 + 잔업";
  return "비상호출";
}
function workStatusLabel(status: WorkSchedule["status"]) { return status === "PLANNED" ? "근무 예정" : status === "COMPLETED" ? "근무 완료" : status === "CANCEL_PENDING" ? "취소 결재중" : status === "CANCELED" ? "취소" : "결재중"; }
function localDate(year: number, zeroBasedMonth: number, day: number) { return `${year}-${String(zeroBasedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }

function DashboardEmpty({ text = "데이터가 없습니다." }) {
  return <div className="empty">{text}</div>;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}
