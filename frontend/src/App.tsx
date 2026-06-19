import {
  ArrowLeft,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  Eye,
  Flag,
  Home,
  Inbox,
  LogOut,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, clearTokens, getAccessToken, jsonBody, setTokens } from "./api";
import schunkLogo from "./assets/schunk-carbon-logo.png";
import type {
  AuditLog,
  AttachFile,
  Approval,
  ApprovalLine,
  ApprovalSummary,
  ApprovalTemplateApi,
  Board,
  BoardPost,
  DeptNode,
  Employee,
  LoginResponse,
  Notice,
  NotificationItem,
  PageResponse,
  User
} from "./types";

type Route = "dashboard" | "notices" | "boards" | "approvals" | "notifications" | "organization" | "audit";
type ContentMode = "list" | "detail" | "create" | "edit";
type NoticeForm = { title: string; content: string; pinned: boolean };
type BoardForm = { title: string; content: string; draft: boolean };
type ApprovalTemplateOption = { code: string; name: string; description: string };
type ApprovalForm = { title: string; content: string; templateCode: string; approverEmpIds: number[]; approvalSlotCount: number };
type AttachmentPresence = Record<number, boolean>;
type DraftAttachment = { id: string; file: File };
type LoginOption = { loginId: string; empName: string; deptName?: string | null; positionName?: string | null; roleCode: string };

const DEFAULT_APPROVAL_TEMPLATES: ApprovalTemplateOption[] = [
  { code: "DRAFT", name: "기안서", description: "일반 업무 기안" },
  { code: "CONSULT", name: "품의서", description: "예산/구매/계약 품의" },
  { code: "LEAVE", name: "휴가계", description: "연차/반차/근태 신청" },
  { code: "PURCHASE", name: "구매요구서", description: "품목/수량/납기 구매 요청" },
  { code: "TRAINING_REQUEST", name: "교육신청서", description: "교육 신청 및 비용 승인" },
  { code: "TRAINING_REPORT", name: "교육 훈련보고서", description: "교육 결과 보고" }
];

function defaultApprovalForm(templates = DEFAULT_APPROVAL_TEMPLATES): ApprovalForm {
  const template = templates[0] ?? DEFAULT_APPROVAL_TEMPLATES[0];
  return { title: template.name, content: "", templateCode: template.code, approverEmpIds: [], approvalSlotCount: 3 };
}

function clampApprovalSlotCount(count: number) {
  return Math.min(6, Math.max(2, count));
}

function approvalDraftData(approval: Approval) {
  try {
    const parsed = approval.formDataJson ? JSON.parse(approval.formDataJson) : {};
    return {
      content: typeof parsed.content === "string" ? parsed.content : approval.content,
      approverEmpIds: Array.isArray(parsed.approverEmpIds) ? parsed.approverEmpIds.filter((id: unknown) => typeof id === "number") : [],
      approvalSlotCount: typeof parsed.approvalSlotCount === "number" ? clampApprovalSlotCount(parsed.approvalSlotCount) : 3
    };
  } catch {
    return { content: approval.content === "{content=}" ? "" : approval.content, approverEmpIds: [], approvalSlotCount: 3 };
  }
}

function approvalContent(approval: Approval) {
  const draftData = approvalDraftData(approval);
  return approval.content === "{content=}" ? draftData.content : approval.content;
}

const routeLabels: Record<Route, string> = {
  dashboard: "대시보드",
  notices: "공지사항",
  boards: "게시판",
  approvals: "전자결재",
  notifications: "알림",
  organization: "조직도",
  audit: "감사 로그"
};

const menu: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: "dashboard", label: "홈", icon: Home },
  { route: "notices", label: "공지사항", icon: BookOpen },
  { route: "boards", label: "통합게시판", icon: MessageSquare },
  { route: "approvals", label: "전자결재", icon: ClipboardCheck },
  { route: "organization", label: "조직도", icon: Building2 },
  { route: "notifications", label: "알림", icon: Bell }
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

function Empty({ text = "데이터가 없습니다." }) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <span>{text}</span>
    </div>
  );
}

async function loadAttachmentPresence(targetType: string, targetIds: number[]) {
  const pairs = await Promise.all(targetIds.map(async (targetId) => {
    try {
      const files = await api<AttachFile[]>(`/files?targetType=${targetType}&targetId=${targetId}`);
      return [targetId, files.length > 0] as const;
    } catch {
      return [targetId, false] as const;
    }
  }));
  return Object.fromEntries(pairs) as AttachmentPresence;
}

async function uploadAttachments(targetType: string, targetId: number, attachmentsToUpload: DraftAttachment[]) {
  if (!attachmentsToUpload.length) return;
  const formData = new FormData();
  formData.set("targetType", targetType);
  formData.set("targetId", String(targetId));
  attachmentsToUpload.forEach((attachment) => formData.append("files", attachment.file));
  await api<AttachFile[]>("/files/batch", { method: "POST", body: formData });
}

function displayBoardName(board: Board) {
  return board.boardName === "CRUD Test Board" ? "통합게시판" : board.boardName;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [route, setRoute] = useState<Route>("dashboard");
  const [message, setMessage] = useState("");
  const isAdmin = user?.roleCode === "ADMIN";

  async function loadMe() {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    }
  }

  useEffect(() => {
    if (localStorage.getItem("accessToken")) void loadMe();
    const expire = () => {
      setMessage("세션이 만료되었습니다. 다시 로그인해 주세요.");
      setUser(null);
      setRoute("dashboard");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);

  function logout() {
    clearTokens();
    setUser(null);
    setRoute("dashboard");
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={(login) => {
          setTokens(login.accessToken, login.refreshToken);
          setUser(login);
          setMessage("");
        }}
        message={message}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="brand-logo" src={schunkLogo} alt="SCHUNK Carbon Technology" />
          <div>
            <strong>슝크카본테크놀로지</strong>
            <span>SCHUNK Groupware</span>
          </div>
        </div>
        <div className="profile">
          <div className="avatar"><UserRound size={38} /></div>
          <strong>{user.empName}</strong>
          <span>{user.deptName ?? "소속 미지정"} · {user.roleCode}</span>
        </div>
        <nav className="side-nav">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.route} className={route === item.route ? "side active" : "side"} onClick={() => setRoute(item.route)}>
                <Icon size={19} /> {item.label}
              </button>
            );
          })}
          {isAdmin && (
            <button className={route === "audit" ? "side active" : "side"} onClick={() => setRoute("audit")}>
              <Shield size={19} /> 감사 로그
            </button>
          )}
        </nav>
        <button className="logout-link" onClick={logout}>
          <LogOut size={17} /> 로그아웃
        </button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div>
            <span>Schunk Carbon Technology Ltd.</span>
            <strong>{routeLabels[route]}</strong>
          </div>
          <div className="userbar">
            <Search size={17} />
            <span>{user.empName}</span>
            <span className="role">{user.roleCode}</span>
            <button className="icon-button" onClick={logout} title="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          {route === "dashboard" && <Dashboard user={user} go={setRoute} />}
          {route === "notices" && <NoticePage user={user} />}
          {route === "boards" && <BoardPage user={user} />}
          {route === "approvals" && <ApprovalPage user={user} />}
          {route === "notifications" && <NotificationPage />}
          {route === "organization" && <OrganizationPage />}
          {route === "audit" && (isAdmin ? <AuditLogPage /> : <AccessDenied />)}
        </main>
      </div>
    </div>
  );
}

function LoginPage({ onLogin, message }: { onLogin: (login: LoginResponse) => void; message: string }) {
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("admin1234");
  const [loginOptions, setLoginOptions] = useState<LoginOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<LoginOption[]>("/auth/login-options")
      .then((options) => setLoginOptions(options))
      .catch(() => setLoginOptions([]));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const login = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: jsonBody({ loginId, password })
      });
      onLogin(login);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-visual">
          <img className="login-logo" src={schunkLogo} alt="SCHUNK Carbon Technology" />
          <h1>SCHUNK Groupware</h1>
          <p>업무, 공지, 게시판, 조직 정보를 한 화면에서 관리합니다.</p>
        </div>
        <div className="login-fields">
          <label>
            테스트 계정
            <select value={loginId} onChange={(event) => {
              setLoginId(event.target.value);
              setPassword("admin1234");
            }}>
              <option value="admin">admin · 관리자</option>
              {loginOptions.filter((option) => option.loginId !== "admin").map((option) => (
                <option key={option.loginId} value={option.loginId}>
                  {option.loginId} · {option.empName} · {option.deptName ?? "-"} · {option.positionName ?? option.roleCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            아이디
            <input value={loginId} onChange={(event) => setLoginId(event.target.value)} />
          </label>
          <label>
            비밀번호
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {(message || error) && <p className="error">{error || message}</p>}
          <button className="primary" type="submit">LOGIN</button>
        </div>
      </form>
    </div>
  );
}

function Dashboard({ user, go }: { user: User; go: (route: Route) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    void api<PageResponse<Notice>>("/notices?size=5").then((page) => setNotices(page.content));
    void api<Board[]>("/boards").then(setBoards);
    void api<PageResponse<NotificationItem>>("/notifications?readYn=N&size=5").then((page) => setNotifications(page.content));
  }, []);

  return (
    <section className="portal-grid">
      <div className="portal-card schedule-card">
        <CardHeader title="일정관리" action="예정 기능" icon={CalendarDays} />
        <div className="schedule-date">{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</div>
        <div className="empty compact">
          <CalendarDays size={34} />
          <span>캘린더 기능은 다음 단계에서 연결됩니다.</span>
        </div>
      </div>

      <div className="portal-card calendar-card">
        <CardHeader title="업무 캘린더" icon={CalendarDays} />
        <MiniCalendar />
      </div>

      <div className="portal-card board-card">
        <CardHeader title="통합게시판" action="바로가기" icon={MessageSquare} onAction={() => go("notices")} />
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
        )) : <Empty text="최근 공지가 없습니다." />}
      </div>

      <div className="portal-card commute-card">
        <CardHeader title="내 업무 현황" icon={UserRound} />
        <p>{user.empName}님, 오늘도 좋은 하루입니다.</p>
        <div className="action-pair">
          <button onClick={() => go("notifications")}>알림 확인</button>
          <button onClick={() => go("organization")}>조직도</button>
        </div>
      </div>

      <MetricCard icon={BookOpen} label="공지사항" value={notices.length} caption="최근 표시 건수" onClick={() => go("notices")} />
      <MetricCard icon={MessageSquare} label="게시판" value={boards.length} caption="사용 가능 게시판" onClick={() => go("boards")} />
      <MetricCard icon={Bell} label="미읽음 알림" value={notifications.length} caption="확인 필요" onClick={() => go("notifications")} />

      <div className="portal-card pending-card">
        <CardHeader title="전자결재" action="바로가기" icon={ClipboardCheck} onAction={() => go("approvals")} />
        <div className="approval-preview">
          <div><strong>0</strong><span>결재대기</span></div>
          <div><strong>0</strong><span>진행문서</span></div>
          <div><strong>0</strong><span>수신대기</span></div>
        </div>
      </div>
    </section>
  );
}

function CardHeader({ title, action, icon: Icon, onAction }: { title: string; action?: string; icon: LucideIcon; onAction?: () => void }) {
  return (
    <div className="card-head">
      <h3><Icon size={18} /> {title}</h3>
      {action && (
        <button onClick={onAction} disabled={!onAction}>
          {action} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, caption, onClick }: { icon: LucideIcon; label: string; value: number; caption: string; onClick: () => void }) {
  return (
    <button className="portal-card metric-card" onClick={onClick}>
      <Icon size={22} />
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{caption}</small>
    </button>
  );
}

function MiniCalendar() {
  const today = new Date();
  const days = Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <div className="mini-calendar">
      <strong>{today.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</strong>
      <div className="weekdays">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>
      <div className="days">
        {days.map((day) => <span key={day} className={day === today.getDate() ? "today" : ""}>{day}</span>)}
      </div>
    </div>
  );
}

function NoticePage({ user }: { user: User }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [mode, setMode] = useState<ContentMode>("list");
  const [form, setForm] = useState<NoticeForm>({ title: "", content: "", pinned: false });
  const [attachments, setAttachments] = useState<AttachmentPresence>({});
  const [pendingFiles, setPendingFiles] = useState<DraftAttachment[]>([]);
  const canEdit = selected ? user.roleCode === "ADMIN" || selected.writerEmpId === user.empId : false;

  async function load() {
    const page = await api<PageResponse<Notice>>("/notices?size=20");
    setItems(page.content);
    const nextAttachments = await loadAttachmentPresence("NOTICE", page.content.map((item) => item.noticeId));
    setAttachments(nextAttachments);
  }

  async function loadDetail(id: number) {
    const detail = await api<Notice>(`/notices/${id}`);
    setSelected(detail);
    setForm({ title: detail.title, content: detail.content, pinned: detail.pinned });
    setMode("detail");
  }

  useEffect(() => {
    void load();
  }, []);

  function startCreate() {
    setSelected(null);
    setForm({ title: "", content: "", pinned: false });
    setPendingFiles([]);
    setMode("create");
  }

  function startEdit() {
    if (!selected || !canEdit) return;
    setForm({ title: selected.title, content: selected.content, pinned: selected.pinned });
    setPendingFiles([]);
    setMode("edit");
  }

  async function save() {
    const isEdit = mode === "edit" && selected && canEdit;
    const path = isEdit ? `/notices/${selected.noticeId}` : "/notices";
    const method = isEdit ? "PUT" : "POST";
    const saved = await api<Notice>(path, { method, body: jsonBody(form) });
    await uploadAttachments("NOTICE", saved.noticeId, pendingFiles);
    setPendingFiles([]);
    await load();
    await loadDetail(saved.noticeId);
  }

  async function remove() {
    if (!selected || !canEdit) return;
    await api(`/notices/${selected.noticeId}`, { method: "DELETE" });
    setSelected(null);
    setForm({ title: "", content: "", pinned: false });
    setPendingFiles([]);
    setMode("list");
    await load();
  }

  return (
    <section className="panel board-screen">
      <Toolbar title="공지사항" onNew={startCreate} onRefresh={load} />
      {mode === "list" && (
        <>
          <ListSummary count={items.length} text="등록된 공지" />
          {items.length ? (
            <ContentTable
              rows={items.map((item) => ({
                id: item.noticeId,
                pinned: item.pinned,
                title: item.title,
                writer: item.writerName,
                date: formatDate(item.createdAt),
                hasAttachment: !!attachments[item.noticeId],
                views: item.viewCount,
                onOpen: () => loadDetail(item.noticeId)
              }))}
            />
          ) : <Empty text="공지사항이 없습니다." />}
        </>
      )}
      {mode === "detail" && selected && (
        <DetailPage onBack={() => setMode("list")}>
          <ReadDetail
            title={selected.title}
            content={selected.content}
            meta={`${selected.writerName} · 조회 ${selected.viewCount} · ${formatDate(selected.createdAt)}`}
            badge={selected.pinned ? "상단 고정" : undefined}
            canEdit={canEdit}
            onEdit={startEdit}
            onDelete={remove}
          />
          <AttachmentBox targetType="NOTICE" targetId={selected.noticeId} />
        </DetailPage>
      )}
      {(mode === "create" || mode === "edit") && (
        <DetailPage onBack={() => selected ? setMode("detail") : setMode("list")}>
          <NoticeEditor
            title={mode === "create" ? "공지 작성" : "공지 수정"}
            form={form}
            setForm={setForm}
            pendingFiles={pendingFiles}
            setPendingFiles={setPendingFiles}
            onSave={save}
            onCancel={() => selected ? setMode("detail") : setMode("list")}
            onDelete={mode === "edit" && canEdit ? remove : undefined}
          />
          {mode === "edit" && selected && <AttachmentBox targetType="NOTICE" targetId={selected.noticeId} />}
        </DetailPage>
      )}
    </section>
  );
}

function BoardPage({ user }: { user: User }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [selected, setSelected] = useState<BoardPost | null>(null);
  const [mode, setMode] = useState<ContentMode>("list");
  const [form, setForm] = useState<BoardForm>({ title: "", content: "", draft: false });
  const [attachments, setAttachments] = useState<AttachmentPresence>({});
  const [pendingFiles, setPendingFiles] = useState<DraftAttachment[]>([]);
  const canEdit = selected ? user.roleCode === "ADMIN" || selected.writerEmpId === user.empId : false;

  async function loadBoards() {
    const data = await api<Board[]>("/boards");
    setBoards(data);
    if (!boardId || !data.some((board) => board.boardId === boardId)) {
      setBoardId(data[0]?.boardId ?? null);
    }
  }

  async function loadPosts(id = boardId) {
    if (!id) return;
    const page = await api<PageResponse<BoardPost>>(`/boards/${id}/posts?size=20`);
    setPosts(page.content);
    const nextAttachments = await loadAttachmentPresence("BOARD_POST", page.content.map((post) => post.postId));
    setAttachments(nextAttachments);
  }

  async function loadPost(id: number) {
    const detail = await api<BoardPost>(`/boards/posts/${id}`);
    setSelected(detail);
    setForm({ title: detail.title, content: detail.content, draft: detail.draft });
    setMode("detail");
  }

  useEffect(() => {
    void loadBoards();
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [boardId]);

  function changeBoard(nextBoardId: number) {
    setBoardId(nextBoardId);
    setSelected(null);
    setForm({ title: "", content: "", draft: false });
    setPendingFiles([]);
    setMode("list");
  }

  function startCreate() {
    setSelected(null);
    setForm({ title: "", content: "", draft: false });
    setPendingFiles([]);
    setMode("create");
  }

  function startEdit() {
    if (!selected || !canEdit) return;
    setForm({ title: selected.title, content: selected.content, draft: selected.draft });
    setPendingFiles([]);
    setMode("edit");
  }

  async function save() {
    if (!boardId && !selected) return;
    const isEdit = mode === "edit" && selected && canEdit;
    const path = isEdit ? `/boards/posts/${selected.postId}` : `/boards/${boardId}/posts`;
    const method = isEdit ? "PUT" : "POST";
    const saved = await api<BoardPost>(path, { method, body: jsonBody(form) });
    await uploadAttachments("BOARD_POST", saved.postId, pendingFiles);
    setPendingFiles([]);
    await loadPosts(saved.boardId);
    await loadPost(saved.postId);
  }

  async function remove() {
    if (!selected || !canEdit) return;
    await api(`/boards/posts/${selected.postId}`, { method: "DELETE" });
    setSelected(null);
    setForm({ title: "", content: "", draft: false });
    setPendingFiles([]);
    setMode("list");
    await loadPosts();
  }

  async function comment(content: string) {
    if (!selected || !content.trim()) return;
    await api(`/boards/posts/${selected.postId}/comments`, { method: "POST", body: jsonBody({ content }) });
    await loadPost(selected.postId);
  }

  return (
    <section className="panel board-screen">
      <div className="board-tabs">
        {boards.map((board) => (
          <button key={board.boardId} className={boardId === board.boardId ? "active" : ""} onClick={() => changeBoard(board.boardId)}>
            {displayBoardName(board)}
          </button>
        ))}
      </div>
      <Toolbar title="게시글" onNew={startCreate} onRefresh={() => loadPosts()} />
      {mode === "list" && (
        <>
          <ListSummary count={posts.length} text="표시 중인 게시글" />
          {posts.length ? (
            <ContentTable
              rows={posts.map((post) => ({
                id: post.postId,
                pinned: post.draft,
                title: post.title,
                writer: post.writerName,
                date: formatDate(post.createdAt),
                hasAttachment: !!attachments[post.postId],
                views: post.viewCount,
                onOpen: () => loadPost(post.postId)
              }))}
              pinnedLabel="임시"
            />
          ) : <Empty text="게시글이 없습니다." />}
        </>
      )}
      {mode === "detail" && selected && (
        <DetailPage onBack={() => setMode("list")}>
          <ReadDetail
            title={selected.title}
            content={selected.content}
            meta={`${selected.writerName} · 조회 ${selected.viewCount} · ${formatDate(selected.createdAt)}`}
            badge={selected.draft ? "임시글" : undefined}
            canEdit={canEdit}
            onEdit={startEdit}
            onDelete={remove}
          />
          <AttachmentBox targetType="BOARD_POST" targetId={selected.postId} />
          <CommentBox comments={selected.comments} onSubmit={comment} />
        </DetailPage>
      )}
      {(mode === "create" || mode === "edit") && (
        <DetailPage onBack={() => selected ? setMode("detail") : setMode("list")}>
          <BoardEditor
            title={mode === "create" ? "게시글 작성" : "게시글 수정"}
            form={form}
            setForm={setForm}
            pendingFiles={pendingFiles}
            setPendingFiles={setPendingFiles}
            onSave={save}
            onCancel={() => selected ? setMode("detail") : setMode("list")}
            onDelete={mode === "edit" && canEdit ? remove : undefined}
          />
          {mode === "edit" && selected && <AttachmentBox targetType="BOARD_POST" targetId={selected.postId} />}
        </DetailPage>
      )}
    </section>
  );
}

function ApprovalPage({ user }: { user: User }) {
  const [box, setBox] = useState<"pending" | "requested" | "processed" | "all">("pending");
  const [items, setItems] = useState<ApprovalSummary[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [mode, setMode] = useState<ContentMode>("list");
  const [templates, setTemplates] = useState<ApprovalTemplateOption[]>(DEFAULT_APPROVAL_TEMPLATES);
  const [form, setForm] = useState<ApprovalForm>(() => defaultApprovalForm());
  const [pendingFiles, setPendingFiles] = useState<DraftAttachment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approvalError, setApprovalError] = useState("");

  async function load(targetBox: "pending" | "requested" | "processed" | "all") {
    const page = await api<PageResponse<ApprovalSummary>>(`/approvals?box=${targetBox}&size=30`);
    setItems(page.content);
  }

  async function loadEmployees() {
    const page = await api<PageResponse<Employee>>("/emps?size=30&status=ACTIVE");
    setEmployees(page.content.filter((employee) => employee.empId !== user.empId));
  }

  async function loadDetail(id: number) {
    const detail = await api<Approval>(`/approvals/${id}`);
    setSelected(detail);
    setMode("detail");
  }

  useEffect(() => {
    setItems([]);
    void load(box);
  }, [box]);

  useEffect(() => {
    void loadEmployees();
    void api<ApprovalTemplateApi[]>("/approval-templates").then((items) => {
      const nextTemplates = items.map((item) => ({
        code: item.templateCode,
        name: item.templateName,
        description: item.description ?? ""
      }));
      if (nextTemplates.length) {
        setTemplates(nextTemplates);
        setForm((current) => current.templateCode ? current : defaultApprovalForm(nextTemplates));
      }
    }).catch(() => undefined);
  }, []);

  async function changeBox(nextBox: "pending" | "requested" | "processed" | "all") {
    setApprovalError("");
    setBox(nextBox);
    setSelected(null);
    setMode("list");
    setItems([]);
    await load(nextBox);
  }

  function startCreate() {
    setSelected(null);
    setForm(defaultApprovalForm(templates));
    setPendingFiles([]);
    setApprovalError("");
    setMode("create");
  }

  function editDraft() {
    if (!selected || selected.status !== "DRAFT") return;
    const draftData = approvalDraftData(selected);
    setForm({
      title: selected.title,
      content: draftData.content,
      templateCode: selected.templateCode ?? templates[0]?.code ?? DEFAULT_APPROVAL_TEMPLATES[0].code,
      approverEmpIds: selected.lines.length ? selected.lines.map((line) => line.approverEmpId) : draftData.approverEmpIds,
      approvalSlotCount: clampApprovalSlotCount(Math.max(selected.lines.length + 1, draftData.approvalSlotCount))
    });
    setPendingFiles([]);
    setApprovalError("");
    setMode("edit");
  }

  async function save(submit = true) {
    setApprovalError("");
    try {
      const template = templates.find((item) => item.code === form.templateCode) ?? templates[0] ?? DEFAULT_APPROVAL_TEMPLATES[0];
      const payload = {
        title: form.title.trim() || template.name,
        content: form.content,
        templateCode: template.code,
        formDataJson: JSON.stringify({ content: form.content, approverEmpIds: form.approverEmpIds, approvalSlotCount: form.approvalSlotCount }),
        approverEmpIds: form.approverEmpIds,
        draft: !submit
      };
      const saved = mode === "edit" && selected?.status === "DRAFT"
        ? await api<Approval>(submit ? `/approvals/${selected.approvalId}/submit` : `/approvals/${selected.approvalId}/draft`, {
            method: submit ? "POST" : "PUT",
            body: jsonBody(payload)
          })
        : await api<Approval>("/approvals", { method: "POST", body: jsonBody(payload) });
      await uploadAttachments("APPROVAL", saved.approvalId, pendingFiles);
      setPendingFiles([]);
      setForm(defaultApprovalForm(templates));
      setSelected(null);
      setMode("list");
      setBox("requested");
      await load("requested");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재 문서 저장 중 오류가 발생했습니다.");
    }
  }

  async function withdraw() {
    if (!selected || !window.confirm("아직 결재자가 처리하지 않은 문서를 회수합니다.")) return;
    const updated = await api<Approval>(`/approvals/${selected.approvalId}/withdraw`, { method: "POST" });
    setSelected(updated);
    await load(box);
  }

  async function redraft() {
    if (!selected) return;
    await api<Approval>(`/approvals/${selected.approvalId}/redraft`, { method: "POST" });
    setSelected(null);
    setMode("list");
    setBox("requested");
    await load("requested");
  }

  async function action(type: "approve" | "reject") {
    if (!selected) return;
    const comment = window.prompt(type === "approve" ? "승인 의견" : "반려 사유") ?? "";
    const updated = await api<Approval>(`/approvals/${selected.approvalId}/${type}`, {
      method: "POST",
      body: jsonBody({ comment })
    });
    setSelected(updated);
    await load(box);
  }

  function changeTemplate(templateCode: string) {
    const currentTemplate = templates.find((item) => item.code === form.templateCode);
    const nextTemplate = templates.find((item) => item.code === templateCode) ?? currentTemplate;
    const shouldUseTemplateTitle = !form.title.trim() || form.title === currentTemplate?.name;
    setForm({
      ...form,
      templateCode,
      title: shouldUseTemplateTitle && nextTemplate ? nextTemplate.name : form.title
    });
  }

  const myApprovalLine = selected?.lines.find((line) => line.approverEmpId === user.empId);
  const isApprovalParticipant = selected?.status === "PENDING" && !!myApprovalLine;
  const canAct = isApprovalParticipant && myApprovalLine?.status === "PENDING";
  const isRequester = selected?.requesterEmpId === user.empId;
  const canEditDraft = !!selected && selected.status === "DRAFT" && isRequester;
  const canWithdraw = !!selected && selected.status === "PENDING" && isRequester && selected.lines.every((line) => line.status !== "APPROVED" && line.status !== "REJECTED");
  const canRedraft = !!selected && (selected.status === "WITHDRAWN" || selected.status === "REJECTED") && isRequester;

  return (
    <section className="panel board-screen">
      <div className="board-tabs">
        <button className={box === "pending" ? "active" : ""} onClick={() => void changeBox("pending")}>결재대기</button>
        <button className={box === "requested" ? "active" : ""} onClick={() => void changeBox("requested")}>기안문서</button>
        <button className={box === "processed" ? "active" : ""} onClick={() => void changeBox("processed")}>처리문서</button>
        {user.roleCode === "ADMIN" && <button className={box === "all" ? "active" : ""} onClick={() => void changeBox("all")}>전체</button>}
      </div>
      <Toolbar
        title="전자결재"
        onNew={startCreate}
        onRefresh={() => load(box)}
        beforeRefresh={canAct && (
          <>
            <button type="button" className="primary-action" onClick={() => action("approve")}><Check size={16} /> 승인</button>
            <button type="button" className="danger" onClick={() => action("reject")}><X size={16} /> 반려</button>
          </>
        )}
      />
      {approvalError && <p className="error">{approvalError}</p>}
      {mode === "list" && (
        <>
          <ListSummary count={items.length} text="표시 중인 결재 문서" />
          {items.length ? (
            <ContentTable
              rows={items.map((item) => ({
                id: item.approvalId,
                pinned: item.status === "PENDING",
                title: item.title,
                writer: item.requesterName,
                date: formatDate(item.requestedAt),
                hasAttachment: false,
                views: item.currentApproverName ? `결재자 ${item.currentApproverName}` : item.status,
                onOpen: () => loadDetail(item.approvalId)
              }))}
              pinnedLabel="진행"
              metricLabel="결재상태"
            />
          ) : <Empty text="표시할 결재 문서가 없습니다." />}
        </>
      )}
      {mode === "detail" && selected && (
        <DetailPage onBack={() => setMode("list")}>
          <ReadDetail
            title={selected.title}
            content={approvalContent(selected)}
            meta={`${selected.requesterName} · ${selected.status} · ${formatDate(selected.requestedAt)}`}
            badge={selected.status}
            canEdit={false}
            onEdit={() => action("approve")}
            onDelete={() => action("reject")}
            editLabel="승인"
            deleteLabel="반려"
          />
          <ApprovalStampTable approval={selected} />
          <ApprovalOpinionList lines={selected.lines} />
          {(canEditDraft || canWithdraw || canRedraft) && (
            <div className="approval-actions">
              {canEditDraft && <button onClick={editDraft}><Edit3 size={16} /> 이어쓰기</button>}
              {canWithdraw && <button className="ghost" onClick={withdraw}><RefreshCw size={16} /> 회수</button>}
              {canRedraft && <button onClick={redraft}><Save size={16} /> 재기안</button>}
            </div>
          )}
          <AttachmentBox targetType="APPROVAL" targetId={selected.approvalId} readOnly={selected.status === "APPROVED"} />
        </DetailPage>
      )}
      {(mode === "create" || mode === "edit") && (
        <DetailPage onBack={() => setMode("list")}>
          <div className="editor">
            <div className="panel-head">
              <h3>{mode === "edit" ? "임시저장 이어쓰기" : "결재 문서 작성"}</h3>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => void save(false)}><Save size={16} /> 임시저장</button>
                <button type="button" onClick={() => void save(true)}><Check size={16} /> 상신</button>
                <button type="button" className="ghost" onClick={() => setMode(selected ? "detail" : "list")}><X size={16} /> 취소</button>
              </div>
            </div>
            <ApprovalLineTableEditor
              user={user}
              employees={employees}
              selectedIds={form.approverEmpIds}
              slotCount={form.approvalSlotCount}
              onSlotCountChange={(approvalSlotCount) => setForm((current) => ({ ...current, approvalSlotCount }))}
              onChange={(approverEmpIds) => setForm((current) => ({ ...current, approverEmpIds }))}
            />
            <label>
              결재 양식
              <select value={form.templateCode} onChange={(event) => changeTemplate(event.target.value)}>
                {templates.map((template) => (
                  <option key={template.code} value={template.code}>{template.name}</option>
                ))}
              </select>
            </label>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
            <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="내용" />
            <DraftAttachmentPicker files={pendingFiles} onChange={setPendingFiles} />
          </div>
        </DetailPage>
      )}
    </section>
  );
}

function ApproverPicker({ employees, selectedIds, onChange }: { employees: Employee[]; selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Employee[]>(employees);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);

  useEffect(() => {
    setCandidates(employees);
    setKnownEmployees((prev) => mergeEmployees(prev, employees));
  }, [employees]);

  async function openPicker() {
    setOpen(true);
    if (!tree.length) {
      const data = await api<DeptNode[]>("/depts/tree");
      setTree(data);
    }
    await search();
  }

  async function search(targetDeptId = activeDeptId) {
    const params = new URLSearchParams({ page: "0", size: "50", status: "ACTIVE" });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (targetDeptId) params.set("deptId", String(targetDeptId));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    const next = page.content;
    setCandidates(next);
    setKnownEmployees((prev) => mergeEmployees(prev, next));
  }

  async function selectDept(deptId: number) {
    setActiveDeptId(deptId);
    await search(deptId);
  }

  function add(employee: Employee) {
    if (selectedIds.includes(employee.empId)) return;
    setKnownEmployees((prev) => mergeEmployees(prev, [employee]));
    onChange([...selectedIds, employee.empId]);
  }

  function remove(empId: number) {
    onChange(selectedIds.filter((id) => id !== empId));
  }

  function move(empId: number, direction: -1 | 1) {
    const index = selectedIds.indexOf(empId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="approver-picker">
      <div className="panel-head">
        <h3>결재선</h3>
        <button type="button" onClick={openPicker}><Building2 size={16} /> 결재라인 구성</button>
      </div>
      {selectedIds.length ? (
        <div className="approval-path">
          {selectedIds.map((id, index) => {
            const employee = knownEmployees.find((item) => item.empId === id);
            return (
              <span key={id}>
                {index + 1}. {employee?.empName ?? id}
                <button type="button" onClick={() => move(id, -1)} disabled={index === 0}>↑</button>
                <button type="button" onClick={() => move(id, 1)} disabled={index === selectedIds.length - 1}>↓</button>
                <button type="button" onClick={() => remove(id)}>×</button>
              </span>
            );
          })}
        </div>
      ) : <Empty text="결재자를 순서대로 선택해 주세요." />}
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div className="org-picker-modal" role="dialog" aria-modal="true" aria-label="결재라인 구성">
            <div className="modal-head">
              <h3>결재라인 구성</h3>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} title="닫기"><X size={18} /></button>
            </div>
            <div className="org-picker-layout">
              <div className="org-picker-tree">
                {tree.map((node) => <DeptTree key={node.deptId} node={node} active={activeDeptId} onSelect={selectDept} />)}
              </div>
              <div className="org-picker-results">
                <div className="searchbar">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
                  <button type="button" onClick={() => search()}><Search size={16} /> 검색</button>
                </div>
                <div className="employee-result-list">
                  {candidates.map((employee) => (
                    <button key={employee.empId} type="button" className={selectedIds.includes(employee.empId) ? "active" : ""} onClick={() => add(employee)}>
                      <strong>{employee.empName}</strong>
                      <span>{employee.deptName ?? "-"} · {employee.positionName ?? employee.jobTitle ?? employee.roleCode}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="org-picker-selected">
                <h3>선택된 결재선</h3>
                {selectedIds.length ? selectedIds.map((id, index) => {
                  const employee = knownEmployees.find((item) => item.empId === id);
                  return (
                    <div className="selected-approver" key={id}>
                      <strong>{index + 1}. {employee?.empName ?? id}</strong>
                      <span>{employee?.deptName ?? "-"}</span>
                      <div>
                        <button type="button" onClick={() => move(id, -1)} disabled={index === 0}>↑</button>
                        <button type="button" onClick={() => move(id, 1)} disabled={index === selectedIds.length - 1}>↓</button>
                        <button type="button" onClick={() => remove(id)}>삭제</button>
                      </div>
                    </div>
                  );
                }) : <Empty text="선택된 결재자가 없습니다." />}
                <button type="button" className="primary" onClick={() => setOpen(false)}>적용</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function mergeEmployees(current: Employee[], next: Employee[]) {
  const byId = new Map(current.map((employee) => [employee.empId, employee]));
  next.forEach((employee) => byId.set(employee.empId, employee));
  return Array.from(byId.values());
}

function ApprovalLineTableEditor({
  user,
  employees,
  selectedIds,
  slotCount,
  onSlotCountChange,
  onChange
}: {
  user: User;
  employees: Employee[];
  selectedIds: number[];
  slotCount: number;
  onSlotCountChange: (count: number) => void;
  onChange: (ids: number[]) => void;
}) {
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Employee[]>(employees);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);
  const safeSlotCount = clampApprovalSlotCount(Math.max(slotCount, selectedIds.length + 1));
  const approverSlotCount = safeSlotCount - 1;

  useEffect(() => {
    setCandidates(employees);
    setKnownEmployees((prev) => mergeEmployees(prev, employees));
  }, [employees]);

  async function openPicker(slotIndex: number) {
    setOpenSlot(slotIndex);
    if (!tree.length) {
      const data = await api<DeptNode[]>("/depts/tree");
      setTree(data);
    }
    await search();
  }

  async function search(targetDeptId = activeDeptId) {
    const params = new URLSearchParams({ page: "0", size: "50", status: "ACTIVE" });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (targetDeptId) params.set("deptId", String(targetDeptId));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    const next = page.content.filter((employee) => employee.empId !== user.empId);
    setCandidates(next);
    setKnownEmployees((prev) => mergeEmployees(prev, next));
  }

  async function selectDept(deptId: number) {
    setActiveDeptId(deptId);
    await search(deptId);
  }

  function assign(employee: Employee) {
    if (openSlot === null) return;
    const next = selectedIds.filter((id, index) => id !== employee.empId || index === openSlot);
    next[openSlot] = employee.empId;
    setKnownEmployees((prev) => mergeEmployees(prev, [employee]));
    onChange(next.filter((id): id is number => typeof id === "number"));
    onSlotCountChange(clampApprovalSlotCount(Math.max(safeSlotCount, openSlot + 2)));
    setOpenSlot(null);
  }

  function clearSlot(slotIndex: number) {
    const next = selectedIds.slice();
    next.splice(slotIndex, 1);
    onChange(next);
    onSlotCountChange(clampApprovalSlotCount(Math.max(2, safeSlotCount - 1, next.length + 1)));
  }

  function addSlot() {
    onSlotCountChange(clampApprovalSlotCount(safeSlotCount + 1));
  }

  function removeLastSlot() {
    const nextCount = clampApprovalSlotCount(safeSlotCount - 1);
    onChange(selectedIds.slice(0, nextCount - 1));
    onSlotCountChange(nextCount);
  }

  const slots = Array.from({ length: approverSlotCount }, (_, index) => {
    const employee = knownEmployees.find((item) => item.empId === selectedIds[index]);
    return { index, employee };
  });

  return (
    <div className="approval-line-editor">
      <div className="approval-line-editor-head">
        <h3>결재표</h3>
        <div className="actions">
          <button type="button" className="ghost" onClick={removeLastSlot} disabled={safeSlotCount <= 2}><Trash2 size={15} /> 칸 삭제</button>
          <button type="button" onClick={addSlot} disabled={safeSlotCount >= 6}><Plus size={15} /> 칸 추가</button>
        </div>
      </div>
      <div className="approval-stamp-wrap approval-stamp-editor">
        <div className="approval-stamp-label">결재</div>
        <div className="approval-stamp-table">
          <div className="approval-stamp-column requester">
            <div className="stamp-position">작성자</div>
            <div className="stamp-signature">{user.empName}</div>
            <div className="stamp-date"></div>
          </div>
          {slots.map(({ index, employee }) => (
            <div className="approval-stamp-column editable" key={index}>
              <div className="stamp-position">{employee?.positionName ?? `결재 ${index + 1}`}</div>
              <button type="button" className="stamp-signature stamp-signature-button" onClick={() => openPicker(index)}>
                {employee?.empName ?? "선택"}
              </button>
              <div className="stamp-date">
                {employee ? "클릭하여 변경" : "클릭하여 지정"}
                {employee && <button type="button" className="stamp-clear" onClick={() => clearSlot(index)}>삭제</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {openSlot !== null && (
        <div className="modal-backdrop" role="presentation">
          <div className="org-picker-modal" role="dialog" aria-modal="true" aria-label="결재자 선택">
            <div className="modal-head">
              <h3>{openSlot + 1}번 결재자 선택</h3>
              <button type="button" className="icon-button" onClick={() => setOpenSlot(null)} title="닫기"><X size={18} /></button>
            </div>
            <div className="org-picker-layout">
              <div className="org-picker-tree">
                {tree.map((node) => <DeptTree key={node.deptId} node={node} active={activeDeptId} onSelect={selectDept} />)}
              </div>
              <div className="org-picker-results">
                <div className="searchbar">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
                  <button type="button" onClick={() => search()}><Search size={16} /> 검색</button>
                </div>
                <div className="employee-result-list">
                  {candidates.map((employee) => (
                    <button key={employee.empId} type="button" className={selectedIds.includes(employee.empId) ? "active" : ""} onClick={() => assign(employee)}>
                      <strong>{employee.empName}</strong>
                      <span>{employee.deptName ?? "-"} · {employee.positionName ?? employee.jobTitle ?? employee.roleCode}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="org-picker-selected">
                <h3>현재 결재표</h3>
                {slots.map(({ index, employee }) => (
                  <div className="selected-approver" key={index}>
                    <strong>{index + 1}. {employee?.empName ?? "미지정"}</strong>
                    <span>{employee?.deptName ?? "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalStampTable({ approval }: { approval: Approval }) {
  const columns = [
    {
      key: "requester",
      position: approval.requesterPositionName ?? "작성자",
      name: approval.requesterName,
      date: approval.requestedAt,
      muted: false
    },
    ...approval.lines
      .slice()
      .sort((a, b) => a.lineOrder - b.lineOrder)
      .map((line) => ({
        key: String(line.lineId),
        position: line.approverPositionName ?? "-",
        name: line.status === "APPROVED" || line.status === "REJECTED" ? signatureDisplayName(line) : line.approverName,
        date: line.signedAt ?? line.actedAt,
        muted: line.status !== "APPROVED" && line.status !== "REJECTED"
      }))
  ];

  return (
    <div className="approval-stamp-wrap">
      <div className="approval-stamp-label">결재</div>
      <div className="approval-stamp-table">
        {columns.map((column) => (
          <div className="approval-stamp-column" key={column.key}>
            <div className="stamp-position">{column.position}</div>
            <div className={`stamp-signature${column.muted ? " stamp-signature-muted" : ""}`}>{column.name}</div>
            <div className="stamp-date">{column.date ? formatDate(column.date) : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalOpinionList({ lines }: { lines: Approval["lines"] }) {
  const orderedLines = lines.slice().sort((a, b) => a.lineOrder - b.lineOrder);
  return (
    <div className="approval-opinions">
      <h3>결재 의견</h3>
      {orderedLines.map((line) => {
        const acted = line.status === "APPROVED" || line.status === "REJECTED";
        return (
          <div className={`approval-opinion ${acted ? "acted" : ""}`} key={line.lineId}>
            <div>
              <strong>{line.lineOrder}. {line.approverName}</strong>
              <span>{line.approverDeptName ?? "-"} · {line.approverPositionName ?? "-"} · {line.status}</span>
            </div>
            <p>{line.comment?.trim() || (acted ? "의견 없음" : "처리 전")}</p>
            {line.actedAt && <time>{formatDate(line.actedAt)}</time>}
          </div>
        );
      })}
    </div>
  );
}

function signatureDisplayName(line: ApprovalLine) {
  try {
    const parsed = line.signatureSnapshotJson ? JSON.parse(line.signatureSnapshotJson) : null;
    return typeof parsed?.displayName === "string" && parsed.displayName.trim() ? parsed.displayName : line.approverName;
  } catch {
    return line.approverName;
  }
}

function ApprovalLineView({ lines }: { lines: Approval["lines"] }) {
  return (
    <div className="approval-lines">
      <h3>결재선</h3>
      {lines.map((line) => (
        <div className="approval-line" key={line.lineId}>
          <strong>{line.lineOrder}. {line.approverName}</strong>
          <span>{line.approverDeptName ?? "-"} · {line.approverPositionName ?? "-"} · {line.status}</span>
          {line.comment && <p>{line.comment}</p>}
        </div>
      ))}
    </div>
  );
}

function NotificationPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function load() {
    const page = await api<PageResponse<NotificationItem>>(`/notifications?size=50${unreadOnly ? "&readYn=N" : ""}`);
    setItems(page.content);
  }

  useEffect(() => {
    void load();
  }, [unreadOnly]);

  async function markRead(id: number) {
    await api(`/notifications/${id}/read`, { method: "PUT" });
    await load();
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>알림</h3>
        <label className="check">
          <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> 미읽음만
        </label>
      </div>
      {items.length ? items.map((item) => (
        <div key={item.notificationId} className={item.read ? "notice-row read" : "notice-row"}>
          <div>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <span>{formatDate(item.createdAt)}</span>
          </div>
          {!item.read && (
            <button className="ghost" onClick={() => markRead(item.notificationId)}>
              <Check size={16} /> 읽음
            </button>
          )}
        </div>
      )) : <Empty />}
    </div>
  );
}

function OrganizationPage() {
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [emps, setEmps] = useState<Employee[]>([]);

  useEffect(() => {
    void api<DeptNode[]>("/depts/tree").then(setTree);
  }, []);

  async function search(targetDept = deptId) {
    const params = new URLSearchParams({ page: "0", size: "20", status: "ACTIVE" });
    if (keyword) params.set("keyword", keyword);
    if (targetDept) params.set("deptId", String(targetDept));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    setEmps(page.content);
  }

  useEffect(() => {
    void search();
  }, [deptId]);

  return (
    <div className="org-layout">
      <div className="panel tree-panel">
        <h3>조직도</h3>
        {tree.map((node) => <DeptTree key={node.deptId} node={node} active={deptId} onSelect={setDeptId} />)}
      </div>
      <div className="panel">
        <div className="searchbar">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
          <button onClick={() => search()}><Search size={16} /> 검색</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>부서</th>
              <th>직책</th>
              <th>역할</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {emps.map((emp) => (
              <tr key={emp.empId}>
                <td>{emp.empName}</td>
                <td>{emp.deptName ?? "-"}</td>
                <td>{emp.positionName ?? emp.jobTitle ?? "-"}</td>
                <td>{emp.roleCode}</td>
                <td>{emp.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!emps.length && <Empty text="검색된 직원이 없습니다." />}
      </div>
    </div>
  );
}

function DeptTree({ node, active, onSelect }: { node: DeptNode; active: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="tree-node">
      <button className={active === node.deptId ? "active" : ""} onClick={() => onSelect(node.deptId)}>{node.deptName}</button>
      {node.children.map((child) => <DeptTree key={child.deptId} node={child} active={active} onSelect={onSelect} />)}
    </div>
  );
}

function AuditLogPage() {
  const [items, setItems] = useState<AuditLog[]>([]);

  useEffect(() => {
    void api<PageResponse<AuditLog>>("/admin/audit-logs?size=100").then((page) => setItems(page.content));
  }, []);

  return (
    <div className="panel">
      <h3>감사 로그</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>사용자</th>
            <th>작업</th>
            <th>대상</th>
            <th>IP</th>
            <th>일시</th>
          </tr>
        </thead>
        <tbody>
          {items.map((log) => (
            <tr key={log.auditId}>
              <td>{log.auditId}</td>
              <td>{log.empId ?? "-"}</td>
              <td>{log.actionType}</td>
              <td>{log.targetTable} #{log.targetId ?? "-"}</td>
              <td>{log.ipAddress ?? "-"}</td>
              <td>{formatDate(log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="panel access-denied">
      <Shield />
      <h3>접근 권한이 없습니다.</h3>
    </div>
  );
}

function Toolbar({ title, onNew, onRefresh, beforeRefresh }: { title: string; onNew: () => void; onRefresh?: () => void; beforeRefresh?: ReactNode }) {
  return (
    <div className="toolbar">
      <h3>{title}</h3>
      <div className="toolbar-actions">
        {beforeRefresh}
        {onRefresh && <button className="ghost" onClick={onRefresh}><RefreshCw size={16} /> 새로고침</button>}
        <button onClick={onNew}><Plus size={16} /> 작성</button>
      </div>
    </div>
  );
}

function ListSummary({ count, text }: { count: number; text: string }) {
  return <div className="list-summary"><strong>{count}</strong><span>{text}</span></div>;
}

function ContentTable({ rows, pinnedLabel = "고정", metricLabel = "조회수" }: {
  rows: {
    id: number;
    pinned?: boolean;
    title: string;
    writer: string;
    date: string;
    hasAttachment: boolean;
    views: ReactNode;
    onOpen: () => void;
  }[];
  pinnedLabel?: string;
  metricLabel?: string;
}) {
  return (
    <div className="table-wrap">
      <table className="content-table">
        <thead>
          <tr>
            <th className="col-no">번호</th>
            <th>제목</th>
            <th className="col-writer">작성자</th>
            <th className="col-date">작성일</th>
            <th className="col-attach">첨부</th>
            <th className="col-views">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.pinned ? "pinned-row" : ""}>
              <td className="col-no">{row.id}</td>
              <td>
                <button className="title-link" onClick={row.onOpen}>
                  {row.pinned && <span className="pin-label"><Flag size={14} /> {pinnedLabel}</span>}
                  <span>{row.title}</span>
                </button>
              </td>
              <td className="col-writer">{row.writer}</td>
              <td className="col-date">{row.date}</td>
              <td className="col-attach">{row.hasAttachment ? <Paperclip size={16} /> : <span className="dash">-</span>}</td>
              <td className="col-views"><Eye size={15} /> {row.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailPage({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="detail-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} /> 목록으로
      </button>
      {children}
    </div>
  );
}

function TwoPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="two-pane">
      <section className="panel list-pane">{left}</section>
      <section className="panel detail-pane">{right}</section>
    </div>
  );
}

function EmptyDetail({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-detail">
      <Inbox size={42} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function ReadDetail({ title, content, meta, badge, canEdit, onEdit, onDelete, editLabel = "수정", deleteLabel = "삭제" }: {
  title: string;
  content: string;
  meta: string;
  badge?: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  headerAside?: ReactNode;
}) {
  return (
    <article className="read-detail">
      <div className="detail-actions">
        <div>
          {badge && <span className="badge">{badge}</span>}
          <h2>{title}</h2>
          <p>{meta}</p>
        </div>
        {canEdit && (
          <div className="actions">
            <button onClick={onEdit}><Edit3 size={16} /> {editLabel}</button>
            <button className="danger" onClick={onDelete}><Trash2 size={16} /> {deleteLabel}</button>
          </div>
        )}
      </div>
      <div className="detail-content">{content ? <RichContent content={content} /> : "내용이 없습니다."}</div>
    </article>
  );
}

function NoticeEditor({ title, form, setForm, pendingFiles, setPendingFiles, onSave, onCancel, onDelete }: {
  title: string;
  form: NoticeForm;
  setForm: (value: NoticeForm) => void;
  pendingFiles: DraftAttachment[];
  setPendingFiles: (value: DraftAttachment[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="editor">
      <EditorHeader title={title} onSave={onSave} onCancel={onCancel} onDelete={onDelete} />
      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
      <EditorTools content={form.content} onChange={(content) => setForm({ ...form, content })} />
      <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="내용" />
      <DraftAttachmentPicker files={pendingFiles} onChange={setPendingFiles} />
      <div className="editor-options">
        <label className="check">
          <input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} />
          <span>상단 고정</span>
        </label>
      </div>
    </div>
  );
}

function BoardEditor({ title, form, setForm, pendingFiles, setPendingFiles, onSave, onCancel, onDelete }: {
  title: string;
  form: BoardForm;
  setForm: (value: BoardForm) => void;
  pendingFiles: DraftAttachment[];
  setPendingFiles: (value: DraftAttachment[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="editor">
      <EditorHeader title={title} onSave={onSave} onCancel={onCancel} onDelete={onDelete} />
      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
      <EditorTools content={form.content} onChange={(content) => setForm({ ...form, content })} />
      <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="내용" />
      <DraftAttachmentPicker files={pendingFiles} onChange={setPendingFiles} />
      <div className="editor-options">
        <label className="check">
          <input type="checkbox" checked={form.draft} onChange={(event) => setForm({ ...form, draft: event.target.checked })} />
          <span>임시글</span>
        </label>
      </div>
    </div>
  );
}

function EditorTools({ content, onChange }: { content: string; onChange: (content: string) => void }) {
  function insertImage() {
    const url = window.prompt("본문에 넣을 이미지 URL을 입력하세요.");
    if (!url?.trim()) return;
    const alt = window.prompt("이미지 설명을 입력하세요.")?.trim() || "image";
    const next = `${content}${content.endsWith("\n") || !content ? "" : "\n\n"}![${alt}](${url.trim()})`;
    onChange(next);
  }

  return (
    <div className="editor-tools">
      <button type="button" className="ghost" onClick={insertImage}>
        <Paperclip size={15} /> 본문 이미지
      </button>
      <span>이미지 URL은 본문 안에 바로 표시됩니다.</span>
    </div>
  );
}

function DraftAttachmentPicker({ files, onChange }: { files: DraftAttachment[]; onChange: (files: DraftAttachment[]) => void }) {
  function add(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file
    }));
    onChange([...files, ...next]);
  }

  function remove(id: string) {
    onChange(files.filter((file) => file.id !== id));
  }

  return (
    <div className="draft-attachments">
      <div className="panel-head">
        <h3>첨부파일</h3>
        <label className="file-button">
          <input type="file" multiple onChange={(event) => add(event.target.files)} />
          <Plus size={16} /> 파일 선택
        </label>
      </div>
      {files.length ? files.map((attachment) => (
        <div className="file-row" key={attachment.id}>
          <strong className="file-link">{attachment.file.name}</strong>
          <span>{Math.ceil(attachment.file.size / 1024)} KB · 저장 시 업로드</span>
          <button type="button" className="danger ghost" onClick={() => remove(attachment.id)}>
            <Trash2 size={15} /> 제거
          </button>
        </div>
      )) : <Empty text="저장 전에 첨부할 파일을 선택할 수 있습니다." />}
    </div>
  );
}

function RichContent({ content }: { content: string }) {
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<p key={`text-${lastIndex}`}>{content.slice(lastIndex, match.index)}</p>);
    }
    parts.push(<img key={`image-${match.index}`} src={match[2]} alt={match[1] || "본문 이미지"} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(<p key={`text-${lastIndex}`}>{content.slice(lastIndex)}</p>);
  }

  return <>{parts}</>;
}

function EditorHeader({ title, onSave, onCancel, onDelete }: { title: string; onSave: () => void; onCancel: () => void; onDelete?: () => void }) {
  return (
    <div className="panel-head">
      <h3>{title}</h3>
      <div className="actions">
        <button onClick={onSave}><Save size={16} /> 저장</button>
        <button className="ghost" onClick={onCancel}><X size={16} /> 취소</button>
        {onDelete && <button className="danger" onClick={onDelete}><Trash2 size={16} /> 삭제</button>}
      </div>
    </div>
  );
}

function CommentBox({ comments, onSubmit }: { comments: { commentId: number; writerName: string; content: string; createdAt: string }[]; onSubmit: (content: string) => void }) {
  const [content, setContent] = useState("");

  return (
    <div className="comments">
      <h3>댓글</h3>
      {comments.length ? comments.map((comment) => (
        <div className="comment" key={comment.commentId}>
          <strong>{comment.writerName}</strong>
          <span>{formatDate(comment.createdAt)}</span>
          <p>{comment.content}</p>
        </div>
      )) : <Empty text="등록된 댓글이 없습니다." />}
      <div className="comment-form">
        <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="댓글 작성" />
        <button onClick={() => { onSubmit(content); setContent(""); }}>등록</button>
      </div>
    </div>
  );
}

function AttachmentBox({ targetType, targetId, readOnly = false }: { targetType: string; targetId: number; readOnly?: boolean }) {
  const [files, setFiles] = useState<AttachFile[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<AttachFile[]>(`/files?targetType=${targetType}&targetId=${targetId}`);
    setFiles(data);
  }

  useEffect(() => {
    void load();
  }, [targetType, targetId]);

  async function upload(selectedFiles: FileList | null) {
    if (!selectedFiles?.length) return;
    const formData = new FormData();
    formData.set("targetType", targetType);
    formData.set("targetId", String(targetId));
    Array.from(selectedFiles).forEach((file) => formData.append("files", file));
    setBusy(true);
    try {
      await api<AttachFile[]>("/files/batch", { method: "POST", body: formData });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(fileId: number) {
    await api(`/files/${fileId}`, { method: "DELETE" });
    await load();
  }

  async function download(file: AttachFile) {
    const response = await fetch(`http://localhost:8080/api/v1/files/${file.fileId}/download`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` }
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.originalFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="attachments">
      <div className="panel-head">
        <h3>첨부파일</h3>
        {!readOnly && <label className="file-button">
          <input type="file" multiple onChange={(event) => upload(event.target.files)} disabled={busy} />
          <Plus size={16} /> 파일 추가
        </label>}
      </div>
      {files.length ? files.map((file) => (
        <div className="file-row" key={file.fileId}>
          <button className="file-link" onClick={() => download(file)}>{file.originalFileName}</button>
          <span>{Math.ceil(file.fileSize / 1024)} KB · SHA-256</span>
          {!readOnly && <button className="danger ghost" onClick={() => remove(file.fileId)}><Trash2 size={15} /> 삭제</button>}
        </div>
      )) : <Empty text="첨부파일이 없습니다." />}
    </div>
  );
}

export default App;
