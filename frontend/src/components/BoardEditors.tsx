import { DraftAttachmentPicker, EditorHeader, EditorTools } from "./ContentTools";
import type { DraftAttachment } from "../utils/attachments";

export type NoticeForm = { title: string; content: string; pinned: boolean };
export type BoardForm = { title: string; content: string; draft: boolean };

export function NoticeEditor({ title, form, setForm, pendingFiles, setPendingFiles, onSave, onCancel, onDelete }: {
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

export function BoardEditor({ title, form, setForm, pendingFiles, setPendingFiles, onSave, onCancel, onDelete }: {
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
