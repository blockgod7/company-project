import { useEffect, useState } from "react";
import { api, jsonBody } from "../api";
import { BoardEditor } from "../components/BoardEditors";
import type { BoardForm } from "../components/BoardEditors";
import { AttachmentBox, CommentBox, ReadDetail } from "../components/ContentTools";
import { Empty } from "../components/Empty";
import { ContentTable, DetailPage, ListSummary, Toolbar } from "../components/PageLayout";
import { loadAttachmentPresence, uploadAttachments } from "../utils/attachments";
import type { AttachmentPresence, DraftAttachment } from "../utils/attachments";
import { formatDate } from "../utils/date";
import type { GlobalSearchTarget } from "../utils/search";
import type { Board, BoardPost, PageResponse, User } from "../types";

type BoardMode = "list" | "detail" | "create" | "edit";

export function BoardPage({ user, target }: { user: User; target: GlobalSearchTarget | null }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [selected, setSelected] = useState<BoardPost | null>(null);
  const [mode, setMode] = useState<BoardMode>("list");
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

  useEffect(() => {
    if (target?.type === "BOARD_POST") {
      if (target.parentId) setBoardId(target.parentId);
      void loadPost(target.targetId);
    }
  }, [target?.nonce]);

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
      <Toolbar title="게시판" onNew={startCreate} onRefresh={() => loadPosts()} />
      {mode === "list" && (
        <>
          <ListSummary count={posts.length} text="게시글" />
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
