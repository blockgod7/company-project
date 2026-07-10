import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Edit3, Paperclip, Plus, Save, Trash2, X } from "lucide-react";
import { api, authenticatedFetch } from "../api";
import { Empty } from "./Empty";
import type { DraftAttachment } from "../utils/attachments";
import { formatDate } from "../utils/date";
import type { AttachFile } from "../types";

export function ReadDetail({ title, content, meta, badge, canEdit, onEdit, onDelete, editLabel = "수정", deleteLabel = "삭제" }: {
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

export function RichContent({ content }: { content: string }) {
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

export function EditorHeader({ title, onSave, onCancel, onDelete }: { title: string; onSave: () => void; onCancel: () => void; onDelete?: () => void }) {
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

export function EditorTools({ content, onChange }: { content: string; onChange: (content: string) => void }) {
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

export function DraftAttachmentPicker({ files, onChange }: { files: DraftAttachment[]; onChange: (files: DraftAttachment[]) => void }) {
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
          <span>{Math.ceil(attachment.file.size / 1024)} KB · 저장 전에 업로드</span>
          <button type="button" className="danger ghost" onClick={() => remove(attachment.id)}>
            <Trash2 size={15} /> 제거
          </button>
        </div>
      )) : <Empty text="저장 전에 첨부할 파일을 선택할 수 있습니다." />}
    </div>
  );
}

export function AttachmentBox({ targetType, targetId, readOnly = false, canDownload = true }: { targetType: string; targetId: number; readOnly?: boolean; canDownload?: boolean }) {
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
    if (!canDownload) return;
    const response = await authenticatedFetch(`/files/${file.fileId}/download`);
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
          <button className="file-link" onClick={() => download(file)} disabled={!canDownload}>{file.originalFileName}</button>
          <span>{Math.ceil(file.fileSize / 1024)} KB · SHA-256</span>
          {!readOnly && <button className="danger ghost" onClick={() => remove(file.fileId)}><Trash2 size={15} /> 삭제</button>}
        </div>
      )) : <Empty text="첨부파일이 없습니다." />}
    </div>
  );
}

export function CommentBox({ comments, onSubmit }: { comments: { commentId: number; writerName: string; content: string; createdAt: string }[]; onSubmit: (content: string) => void }) {
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
