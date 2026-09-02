import { lazy, Suspense } from "react";
import { DraftAttachmentPicker, EditorHeader } from "./ContentTools";
import type { DraftAttachment } from "../utils/attachments";

const RichTextEditor = lazy(() => import("./RichTextEditor").then((module) => ({ default: module.RichTextEditor })));

export type NoticeForm = { title: string; content: string; pinned: boolean };
export type BoardForm = { title: string; content: string; draft: boolean };

export function NoticeEditor({ title, form, setForm, pendingFiles, setPendingFiles, canAttach = true, onSave, onCancel, onDelete }: {
  title: string;
  form: NoticeForm;
  setForm: (value: NoticeForm) => void;
  pendingFiles: DraftAttachment[];
  setPendingFiles: (value: DraftAttachment[]) => void;
  canAttach?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="editor">
      <EditorHeader title={title} onSave={onSave} onCancel={onCancel} onDelete={onDelete} />
      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
      <Suspense fallback={<div className="rich-text-editor loading" role="status">편집기를 불러오는 중입니다.</div>}>
        <RichTextEditor content={form.content} onChange={(content) => setForm({ ...form, content })}
          ariaLabel="공지사항 본문" placeholder="공지 내용을 입력하세요." allowImages />
      </Suspense>
      {canAttach && <DraftAttachmentPicker files={pendingFiles} onChange={setPendingFiles} />}
      <div className="editor-options">
        <label className="check">
          <input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} />
          <span>상단 고정</span>
        </label>
      </div>
    </div>
  );
}

export function BoardEditor({ title, form, setForm, pendingFiles, setPendingFiles, canAttach = true, onSave, onCancel, onDelete }: {
  title: string;
  form: BoardForm;
  setForm: (value: BoardForm) => void;
  pendingFiles: DraftAttachment[];
  setPendingFiles: (value: DraftAttachment[]) => void;
  canAttach?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="editor">
      <EditorHeader title={title} onSave={onSave} onCancel={onCancel} onDelete={onDelete} />
      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
      <Suspense fallback={<div className="rich-text-editor loading" role="status">편집기를 불러오는 중입니다.</div>}>
        <RichTextEditor content={form.content} onChange={(content) => setForm({ ...form, content })}
          ariaLabel="게시글 본문" placeholder="게시글 내용을 입력하세요." allowImages />
      </Suspense>
      {canAttach && <DraftAttachmentPicker files={pendingFiles} onChange={setPendingFiles} />}
      <div className="editor-options">
        <label className="check">
          <input type="checkbox" checked={form.draft} onChange={(event) => setForm({ ...form, draft: event.target.checked })} />
          <span>임시글</span>
        </label>
      </div>
    </div>
  );
}
