import { useEffect, useState } from "react";
import { api, jsonBody } from "../api";
import { NoticeEditor } from "../components/BoardEditors";
import type { NoticeForm } from "../components/BoardEditors";
import { AttachmentBox, ReadDetail } from "../components/ContentTools";
import { Empty } from "../components/Empty";
import { ContentTable, DetailPage, ListSummary, Toolbar } from "../components/PageLayout";
import { loadAttachmentPresence, uploadAttachments } from "../utils/attachments";
import type { AttachmentPresence, DraftAttachment } from "../utils/attachments";
import { formatDate } from "../utils/date";
import type { GlobalSearchTarget } from "../utils/search";
import type { Notice, PageResponse, User } from "../types";

type NoticeMode = "list" | "detail" | "create" | "edit";

export function NoticePage({ user, target }: { user: User; target: GlobalSearchTarget | null }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [mode, setMode] = useState<NoticeMode>("list");
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

  useEffect(() => {
    if (target?.type === "NOTICE") {
      void loadDetail(target.targetId);
    }
  }, [target?.nonce]);

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
          ) : <Empty text="게시글이 없습니다." />}
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
            title={mode === "create" ? "게시글 작성" : "게시글 수정"}
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
