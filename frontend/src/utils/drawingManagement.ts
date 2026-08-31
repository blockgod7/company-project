import { pdmFolderKindFromNode } from "./pdmTree";
import type { PdmTreeNode } from "./pdmTree";
import type { PdmFolderForm, PdmUploadForm } from "./pdmForms";
import type { PdmFolder } from "../types";

export function isSameServerFolderNode(folder: PdmFolder, node: PdmTreeNode) {
  if (folder.folderId < 0 || folder.category !== node.category || folder.folderKind !== pdmFolderKindFromNode(node) || folder.folderName !== node.label) {
    return false;
  }
  if (node.type === "project") return folder.companyName === node.companyName;
  if (node.type === "process") return folder.businessUnit === node.businessUnit;
  if (node.type === "common" || node.type === "equipment") {
    return folder.businessUnit === node.businessUnit && folder.processName === node.processName;
  }
  return true;
}

export function validateUploadRequiredFields(form: PdmUploadForm, file: File | null) {
  const missing: string[] = [];
  if (!form.drawingNo.trim()) missing.push("도면번호");
  if (!form.title.trim()) missing.push("도면명");
  if (form.category === "PRODUCT") {
    if (!form.companyName.trim()) missing.push("업체명");
    if (!form.projectName.trim()) missing.push("프로젝트/제품명");
  } else {
    if (!form.businessUnit.trim()) missing.push("사업부");
    if (!form.processName.trim()) missing.push("공정");
    if (!form.groupName.trim() && !form.equipmentName.trim()) missing.push("공통도면 폴더 또는 설비명");
  }
  if (!form.revisionLabel.trim()) missing.push("리비전 표기");
  if (!file) missing.push("도면 파일");
  return missing.length ? `필수 입력 항목을 입력해 주세요: ${missing.join(", ")}` : "";
}

export type { PdmFolderForm };
