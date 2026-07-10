import { api } from "../api";
import type { AttachFile } from "../types";

export type AttachmentPresence = Record<number, boolean>;
export type DraftAttachment = { id: string; file: File };

export async function loadAttachmentPresence(targetType: string, targetIds: number[]) {
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

export async function uploadAttachments(targetType: string, targetId: number, attachmentsToUpload: DraftAttachment[]) {
  if (!attachmentsToUpload.length) return;
  const formData = new FormData();
  formData.set("targetType", targetType);
  formData.set("targetId", String(targetId));
  attachmentsToUpload.forEach((attachment) => formData.append("files", attachment.file));
  await api<AttachFile[]>("/files/batch", { method: "POST", body: formData });
}
