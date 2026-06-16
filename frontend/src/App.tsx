import {
  Bell,
  BookOpen,
  Building2,
  Check,
  FileClock,
  Home,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  UserRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, clearTokens, getAccessToken, jsonBody, setTokens } from "./api";
import type {
  AuditLog,
  AttachFile,
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

type Route = "dashboard" | "notices" | "boards" | "notifications" | "organization" | "audit";

const routeLabels: Record<Route, string> = {
  dashboard: "대시보드",
  notices: "공지사항",
  boards: "게시판",
  notifications: "알림",
  organization: "조직도",
  audit: "감사 로그"
};

const menu = [
  { route: "dashboard" as Route, label: "대시보드", icon: Home },
  { route: "notices" as Route, label: "공지사항", icon: BookOpen },
  { route: "boards" as Route, label: "게시판", icon: MessageSquare },
  { route: "organization" as Route, label: "조직도", icon: Building2 },
  { route: "notifications" as Route, label: "알림", icon: Bell }
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

function Empty({ text = "데이터가 없습니다." }) {
  return <div className="empty">{text}</div>;
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
      setMessage("세션이 만료되었습니다. 다시 로그인해주세요.");
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
    return <LoginPage onLogin={(login) => {
      setTokens(login.accessToken, login.refreshToken);
      setUser(login);
      setMessage("");
    }} message={message} />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">schunk</div>
          <div>
            <strong>Schunk Carbon Technology Ltd.</strong>
            <span>Groupware</span>
          </div>
        </div>
        <nav className="topnav">
          {menu.map((item) => (
            <button key={item.route} className={route === item.route ? "active" : ""} onClick={() => setRoute(item.route)}>
              {item.label}
            </button>
          ))}
          {isAdmin && <button className={route === "audit" ? "active" : ""} onClick={() => setRoute("audit")}>관리자</button>}
        </nav>
        <div className="userbar">
          <Search size={17} />
          <span>{user.empName}</span>
          <span className="role">{user.roleCode}</span>
          <button className="icon-button" onClick={logout} title="로그아웃"><LogOut size={18} /></button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="profile">
            <UserRound />
            <strong>{user.empName}</strong>
            <span>{user.deptName ?? "소속 미지정"} · {user.roleCode}</span>
          </div>
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.route} className={route === item.route ? "side active" : "side"} onClick={() => setRoute(item.route)}>
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
          {isAdmin && (
            <button className={route === "audit" ? "side active" : "side"} onClick={() => setRoute("audit")}>
              <Shield size={18} /> 감사 로그
            </button>
          )}
        </aside>
        <main className="content">
          <div className="page-title">
            <div>
              <span>SCHUNK Groupware</span>
              <h1>{routeLabels[route]}</h1>
            </div>
            <button className="ghost" onClick={() => window.location.reload()}><RefreshCw size={16} /> 새로고침</button>
          </div>
          {route === "dashboard" && <Dashboard user={user} go={setRoute} />}
          {route === "notices" && <NoticePage user={user} />}
          {route === "boards" && <BoardPage user={user} />}
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
  const [error, setError] = useState("");

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
          <div className="brand-mark large">schunk</div>
          <h1>SCHUNK Groupware</h1>
          <p>업무, 공지, 게시판, 조직 정보를 한 화면에서 관리합니다.</p>
        </div>
        <label>아이디<input value={loginId} onChange={(e) => setLoginId(e.target.value)} /></label>
        <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {(message || error) && <p className="error">{error || message}</p>}
        <button className="primary" type="submit">LOGIN</button>
      </form>
    </div>
  );
}

function Dashboard({ user, go }: { user: User; go: (route: Route) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    void api<PageResponse<Notice>>("/notices?size=5").then((p) => setNotices(p.content));
    void api<Board[]>("/boards").then(setBoards);
    void api<PageResponse<NotificationItem>>("/notifications?readYn=N&size=5").then((p) => setNotifications(p.content));
  }, []);

  return (
    <section className="grid dashboard-grid">
      <div className="panel hero-panel">
        <h2>{user.empName}님, 좋은 하루입니다.</h2>
        <p>{user.deptName ?? "SCHUNK"} 업무 포털에 접속했습니다.</p>
      </div>
      <SummaryCard icon={BookOpen} title="공지사항" count={notices.length} onClick={() => go("notices")} />
      <SummaryCard icon={MessageSquare} title="게시판" count={boards.length} onClick={() => go("boards")} />
      <SummaryCard icon={Bell} title="미읽음 알림" count={notifications.length} onClick={() => go("notifications")} />
      <div className="panel list-panel">
        <h3>최근 공지</h3>
        {notices.length ? notices.map((n) => <button className="row-button" key={n.noticeId} onClick={() => go("notices")}>{n.title}<span>{formatDate(n.createdAt)}</span></button>) : <Empty />}
      </div>
      <div className="panel list-panel">
        <h3>미읽음 알림</h3>
        {notifications.length ? notifications.map((n) => <button className="row-button" key={n.notificationId} onClick={() => go("notifications")}>{n.title}<span>{formatDate(n.createdAt)}</span></button>) : <Empty />}
      </div>
    </section>
  );
}

function SummaryCard({ icon: Icon, title, count, onClick }: { icon: typeof Home; title: string; count: number; onClick: () => void }) {
  return <button className="summary-card" onClick={onClick}><Icon /><span>{title}</span><strong>{count}</strong></button>;
}

function NoticePage({ user }: { user: User }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [form, setForm] = useState({ title: "", content: "", pinned: false });
  const canEdit = selected && (user.roleCode === "ADMIN" || selected.writerEmpId === user.empId);

  async function load() {
    const page = await api<PageResponse<Notice>>("/notices?size=20");
    setItems(page.content);
    if (!selected && page.content[0]) setSelected(page.content[0]);
  }

  async function loadDetail(id: number) {
    const detail = await api<Notice>(`/notices/${id}`);
    setSelected(detail);
    setForm({ title: detail.title, content: detail.content, pinned: detail.pinned });
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    const method = selected && canEdit ? "PUT" : "POST";
    const path = selected && canEdit ? `/notices/${selected.noticeId}` : "/notices";
    const saved = await api<Notice>(path, { method, body: jsonBody(form) });
    await loadDetail(saved.noticeId);
    await load();
  }

  async function remove() {
    if (!selected) return;
    await api(`/notices/${selected.noticeId}`, { method: "DELETE" });
    setSelected(null);
    setForm({ title: "", content: "", pinned: false });
    await load();
  }

  return (
    <TwoPane
      left={<>
        <Toolbar title="공지사항" onNew={() => { setSelected(null); setForm({ title: "", content: "", pinned: false }); }} />
        {items.map((item) => <button key={item.noticeId} className={selected?.noticeId === item.noticeId ? "list-item active" : "list-item"} onClick={() => loadDetail(item.noticeId)}>
          <strong>{item.pinned ? "[고정] " : ""}{item.title}</strong><span>{item.writerName} · {formatDate(item.createdAt)}</span>
        </button>)}
      </>}
      right={<>
        <Editor title={selected ? "공지 상세" : "공지 작성"} form={form} setForm={setForm} onSave={save} onDelete={canEdit ? remove : undefined} />
        {selected && <AttachmentBox targetType="NOTICE" targetId={selected.noticeId} />}
      </>}
    />
  );
}

function BoardPage({ user }: { user: User }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [selected, setSelected] = useState<BoardPost | null>(null);
  const [form, setForm] = useState({ title: "", content: "", draft: false });
  const canEdit = selected && (user.roleCode === "ADMIN" || selected.writerEmpId === user.empId);

  async function loadBoards() {
    const data = await api<Board[]>("/boards");
    setBoards(data);
    if (!boardId && data[0]) setBoardId(data[0].boardId);
  }

  async function loadPosts(id = boardId) {
    if (!id) return;
    const page = await api<PageResponse<BoardPost>>(`/boards/${id}/posts?size=20`);
    setPosts(page.content);
  }

  async function loadPost(id: number) {
    const detail = await api<BoardPost>(`/boards/posts/${id}`);
    setSelected(detail);
    setForm({ title: detail.title, content: detail.content, draft: detail.draft });
  }

  useEffect(() => { void loadBoards(); }, []);
  useEffect(() => { void loadPosts(); }, [boardId]);

  async function save() {
    if (!boardId && !selected) return;
    const method = selected && canEdit ? "PUT" : "POST";
    const path = selected && canEdit ? `/boards/posts/${selected.postId}` : `/boards/${boardId}/posts`;
    const saved = await api<BoardPost>(path, { method, body: jsonBody(form) });
    await loadPost(saved.postId);
    await loadPosts(saved.boardId);
  }

  async function remove() {
    if (!selected) return;
    await api(`/boards/posts/${selected.postId}`, { method: "DELETE" });
    setSelected(null);
    setForm({ title: "", content: "", draft: false });
    await loadPosts();
  }

  async function comment(content: string) {
    if (!selected || !content.trim()) return;
    await api(`/boards/posts/${selected.postId}/comments`, { method: "POST", body: jsonBody({ content }) });
    await loadPost(selected.postId);
  }

  return (
    <TwoPane
      left={<>
        <div className="board-tabs">{boards.map((board) => <button key={board.boardId} className={boardId === board.boardId ? "active" : ""} onClick={() => { setBoardId(board.boardId); setSelected(null); }}>{board.boardName}</button>)}</div>
        <Toolbar title="게시글" onNew={() => { setSelected(null); setForm({ title: "", content: "", draft: false }); }} />
        {posts.map((post) => <button key={post.postId} className={selected?.postId === post.postId ? "list-item active" : "list-item"} onClick={() => loadPost(post.postId)}>
          <strong>{post.draft ? "[임시] " : ""}{post.title}</strong><span>{post.writerName} · 조회 {post.viewCount}</span>
        </button>)}
      </>}
      right={<>
        <Editor title={selected ? "게시글 상세" : "게시글 작성"} form={form} setForm={setForm} draft onSave={save} onDelete={canEdit ? remove : undefined} />
        {selected && <AttachmentBox targetType="BOARD_POST" targetId={selected.postId} />}
        {selected && <CommentBox comments={selected.comments} onSubmit={comment} />}
      </>}
    />
  );
}

function NotificationPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  async function load() {
    const page = await api<PageResponse<NotificationItem>>(`/notifications?size=50${unreadOnly ? "&readYn=N" : ""}`);
    setItems(page.content);
  }
  useEffect(() => { void load(); }, [unreadOnly]);
  async function markRead(id: number) {
    await api(`/notifications/${id}/read`, { method: "PUT" });
    await load();
  }
  return <div className="panel">
    <div className="panel-head"><h3>알림</h3><label className="check"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> 미읽음만</label></div>
    {items.length ? items.map((item) => <div key={item.notificationId} className={item.read ? "notice-row read" : "notice-row"}>
      <div><strong>{item.title}</strong><p>{item.message}</p><span>{formatDate(item.createdAt)}</span></div>
      {!item.read && <button className="ghost" onClick={() => markRead(item.notificationId)}><Check size={16} /> 읽음</button>}
    </div>) : <Empty />}
  </div>;
}

function OrganizationPage() {
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [emps, setEmps] = useState<Employee[]>([]);
  useEffect(() => { void api<DeptNode[]>("/depts/tree").then(setTree); }, []);
  async function search(targetDept = deptId) {
    const params = new URLSearchParams({ page: "0", size: "20", status: "ACTIVE" });
    if (keyword) params.set("keyword", keyword);
    if (targetDept) params.set("deptId", String(targetDept));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    setEmps(page.content);
  }
  useEffect(() => { void search(); }, [deptId]);
  return <div className="org-layout">
    <div className="panel tree-panel"><h3>조직도</h3>{tree.map((node) => <DeptTree key={node.deptId} node={node} active={deptId} onSelect={setDeptId} />)}</div>
    <div className="panel">
      <div className="searchbar"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="직원명, 아이디, 사번 검색" /><button onClick={() => search()}><Search size={16} /> 검색</button></div>
      <table><thead><tr><th>이름</th><th>부서</th><th>직책</th><th>역할</th><th>상태</th></tr></thead><tbody>
        {emps.map((emp) => <tr key={emp.empId}><td>{emp.empName}</td><td>{emp.deptName ?? "-"}</td><td>{emp.positionName ?? emp.jobTitle ?? "-"}</td><td>{emp.roleCode}</td><td>{emp.status}</td></tr>)}
      </tbody></table>
      {!emps.length && <Empty text="검색된 직원이 없습니다." />}
    </div>
  </div>;
}

function DeptTree({ node, active, onSelect }: { node: DeptNode; active: number | null; onSelect: (id: number) => void }) {
  return <div className="tree-node"><button className={active === node.deptId ? "active" : ""} onClick={() => onSelect(node.deptId)}>{node.deptName}</button>{node.children.map((child) => <DeptTree key={child.deptId} node={child} active={active} onSelect={onSelect} />)}</div>;
}

function AuditLogPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  useEffect(() => { void api<PageResponse<AuditLog>>("/admin/audit-logs?size=100").then((p) => setItems(p.content)); }, []);
  return <div className="panel"><h3>감사 로그</h3><table><thead><tr><th>ID</th><th>사용자</th><th>작업</th><th>대상</th><th>IP</th><th>일시</th></tr></thead><tbody>
    {items.map((log) => <tr key={log.auditId}><td>{log.auditId}</td><td>{log.empId ?? "-"}</td><td>{log.actionType}</td><td>{log.targetTable} #{log.targetId ?? "-"}</td><td>{log.ipAddress ?? "-"}</td><td>{formatDate(log.createdAt)}</td></tr>)}
  </tbody></table></div>;
}

function AccessDenied() {
  return <div className="panel"><Shield /><h3>접근 권한이 없습니다.</h3></div>;
}

function Toolbar({ title, onNew }: { title: string; onNew: () => void }) {
  return <div className="toolbar"><h3>{title}</h3><button onClick={onNew}><Plus size={16} /> 신규</button></div>;
}

function TwoPane({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div className="two-pane"><section className="panel list-pane">{left}</section><section className="panel detail-pane">{right}</section></div>;
}

function Editor({ title, form, setForm, draft, onSave, onDelete }: {
  title: string;
  form: { title: string; content: string; pinned?: boolean; draft?: boolean };
  setForm: (value: any) => void;
  draft?: boolean;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return <div className="editor"><div className="panel-head"><h3>{title}</h3><div className="actions"><button onClick={onSave}><Save size={16} /> 저장</button>{onDelete && <button className="danger" onClick={onDelete}><Trash2 size={16} /> 삭제</button>}</div></div>
    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="제목" />
    <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="내용" />
    <label className="check"><input type="checkbox" checked={draft ? !!form.draft : !!form.pinned} onChange={(e) => setForm(draft ? { ...form, draft: e.target.checked } : { ...form, pinned: e.target.checked })} /> {draft ? "임시글" : "상단 고정"}</label>
  </div>;
}

function CommentBox({ comments, onSubmit }: { comments: { commentId: number; writerName: string; content: string; createdAt: string }[]; onSubmit: (content: string) => void }) {
  const [content, setContent] = useState("");
  return <div className="comments"><h3>댓글</h3>{comments.map((comment) => <div className="comment" key={comment.commentId}><strong>{comment.writerName}</strong><span>{formatDate(comment.createdAt)}</span><p>{comment.content}</p></div>)}
    <div className="comment-form"><input value={content} onChange={(e) => setContent(e.target.value)} placeholder="댓글 작성" /><button onClick={() => { onSubmit(content); setContent(""); }}>등록</button></div>
  </div>;
}

function AttachmentBox({ targetType, targetId }: { targetType: string; targetId: number }) {
  const [files, setFiles] = useState<AttachFile[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<AttachFile[]>(`/files?targetType=${targetType}&targetId=${targetId}`);
    setFiles(data);
  }

  useEffect(() => { void load(); }, [targetType, targetId]);

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

  return <div className="attachments">
    <div className="panel-head">
      <h3>첨부파일</h3>
      <label className="file-button">
        <input type="file" multiple onChange={(event) => upload(event.target.files)} disabled={busy} />
        <Plus size={16} /> 파일 추가
      </label>
    </div>
    {files.length ? files.map((file) => <div className="file-row" key={file.fileId}>
      <button className="file-link" onClick={() => download(file)}>{file.originalFileName}</button>
      <span>{Math.ceil(file.fileSize / 1024)} KB · SHA-256</span>
      <button className="danger ghost" onClick={() => remove(file.fileId)}><Trash2 size={15} /> 삭제</button>
    </div>) : <Empty text="첨부파일이 없습니다." />}
  </div>;
}

export default App;
