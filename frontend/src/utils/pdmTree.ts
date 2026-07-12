import type { DeptNode, PdmDrawing, PdmFolder } from "../types";

export type PdmTreeNode = {
  id: string;
  label: string;
  type: "root" | "company" | "project" | "business" | "process" | "common" | "equipment";
  folderId?: number;
  category?: "PRODUCT" | "EQUIPMENT";
  companyName?: string;
  projectName?: string;
  businessUnit?: string;
  processName?: string;
  groupName?: string;
  equipmentName?: string;
  folderKind?: PdmFolder["folderKind"];
  sortOrder?: number;
  children?: PdmTreeNode[];
};

type PdmFolderFormLike = {
  category: "PRODUCT" | "EQUIPMENT";
  folderKind: PdmFolder["folderKind"];
  folderName: string;
  companyName: string;
  projectName: string;
  businessUnit: string;
  processName: string;
};

export function buildPdmTree(drawings: PdmDrawing[], folders: PdmFolder[]): PdmTreeNode[] {
  const productRoot: PdmTreeNode = { id: "product", label: "제품도면", type: "root", category: "PRODUCT", children: [] };
  const equipmentRoot: PdmTreeNode = { id: "equipment", label: "설비도면", type: "root", category: "EQUIPMENT", children: [] };
  const ensure = (parent: PdmTreeNode, node: PdmTreeNode) => {
    parent.children ??= [];
    const existing = parent.children.find((child) => child.id === node.id);
    if (existing) {
      existing.folderId ??= node.folderId;
      existing.folderKind ??= node.folderKind;
      if (node.sortOrder != null) existing.sortOrder = node.sortOrder;
      existing.children ??= node.children;
      parent.children.sort(pdmTreeNodeComparator);
      return existing;
    }
    parent.children.push(node);
    parent.children.sort(pdmTreeNodeComparator);
    return node;
  };

  const ensureProduct = (company: string, project?: string, folderId?: number, kind?: PdmFolder["folderKind"], sortOrder?: number) => {
    const companyNode = ensure(productRoot, { id: `product:${company}`, label: company, type: "company", category: "PRODUCT", companyName: company, folderId: kind === "COMPANY" ? folderId : undefined, folderKind: kind === "COMPANY" ? kind : undefined, sortOrder: kind === "COMPANY" ? sortOrder : undefined, children: [] });
    if (project) {
      ensure(companyNode, { id: `product:${company}:${project}`, label: project, type: "project", category: "PRODUCT", companyName: company, projectName: project, folderId: kind === "PROJECT" ? folderId : undefined, folderKind: kind === "PROJECT" ? kind : undefined, sortOrder: kind === "PROJECT" ? sortOrder : undefined });
    }
  };

  const ensureEquipment = (business: string, process?: string, kind?: "common" | "equipment", name?: string, folderId?: number, folderKind?: PdmFolder["folderKind"], sortOrder?: number) => {
    const businessNode = ensure(equipmentRoot, { id: `equipment:${business}`, label: business, type: "business", category: "EQUIPMENT", businessUnit: business, folderId: folderKind === "BUSINESS" ? folderId : undefined, folderKind: folderKind === "BUSINESS" ? folderKind : undefined, sortOrder: folderKind === "BUSINESS" ? sortOrder : undefined, children: [] });
    if (!process) return;
    const processNode = ensure(businessNode, { id: `equipment:${business}:${process}`, label: process, type: "process", category: "EQUIPMENT", businessUnit: business, processName: process, folderId: folderKind === "PROCESS" ? folderId : undefined, folderKind: folderKind === "PROCESS" ? folderKind : undefined, sortOrder: folderKind === "PROCESS" ? sortOrder : undefined, children: [] });
    if (kind === "equipment" && name) {
      ensure(processNode, { id: `equipment:${business}:${process}:eq:${name}`, label: name, type: "equipment", category: "EQUIPMENT", businessUnit: business, processName: process, equipmentName: name, folderId: folderKind === "EQUIPMENT" ? folderId : undefined, folderKind: folderKind === "EQUIPMENT" ? folderKind : undefined, sortOrder: folderKind === "EQUIPMENT" ? sortOrder : undefined });
    }
    if (kind === "common") {
      const group = name || "공통도면";
      ensure(processNode, { id: `equipment:${business}:${process}:common:${group}`, label: group, type: "common", category: "EQUIPMENT", businessUnit: business, processName: process, groupName: group, folderId: folderKind === "COMMON" ? folderId : undefined, folderKind: folderKind === "COMMON" ? folderKind : undefined, sortOrder: folderKind === "COMMON" ? sortOrder : undefined });
    }
  };

  folders.forEach((folder) => {
    if (folder.category === "PRODUCT") {
      if (folder.folderKind === "COMPANY") ensureProduct(folder.folderName, undefined, folder.folderId, folder.folderKind, folder.sortOrder);
      if (folder.folderKind === "PROJECT") ensureProduct(folder.companyName || "업체 미지정", folder.folderName, folder.folderId, folder.folderKind, folder.sortOrder);
      return;
    }
    if (folder.folderKind === "BUSINESS") ensureEquipment(folder.folderName, undefined, undefined, undefined, folder.folderId, folder.folderKind, folder.sortOrder);
    if (folder.folderKind === "PROCESS") ensureEquipment(folder.businessUnit || "사업부 미지정", folder.folderName, undefined, undefined, folder.folderId, folder.folderKind, folder.sortOrder);
    if (folder.folderKind === "COMMON") ensureEquipment(folder.businessUnit || "사업부 미지정", folder.processName || "공정 미지정", "common", folder.folderName, folder.folderId, folder.folderKind, folder.sortOrder);
    if (folder.folderKind === "EQUIPMENT") ensureEquipment(folder.businessUnit || "사업부 미지정", folder.processName || "공정 미지정", "equipment", folder.folderName, folder.folderId, folder.folderKind, folder.sortOrder);
  });

  drawings.forEach((drawing) => {
    if (drawing.category === "PRODUCT") {
      const company = drawing.companyName || "업체 미지정";
      const project = drawing.projectName || drawing.groupName || "프로젝트 미지정";
      ensureProduct(company, project);
      return;
    }
    const business = drawing.businessUnit || "사업부 미지정";
    const process = drawing.processName || "공정 미지정";
    if (drawing.equipmentName) {
      ensureEquipment(business, process, "equipment", drawing.equipmentName);
    } else {
      ensureEquipment(business, process, "common", drawing.groupName || "공통도면");
    }
  });

  sortPdmTree(productRoot);
  sortPdmTree(equipmentRoot);
  return [productRoot, equipmentRoot];
}

export function pdmTreeNodeComparator(a: PdmTreeNode, b: PdmTreeNode) {
  const orderA = a.sortOrder ?? 999999;
  const orderB = b.sortOrder ?? 999999;
  if (orderA !== orderB) return orderA - orderB;
  return a.label.localeCompare(b.label, "ko");
}

function sortPdmTree(node: PdmTreeNode) {
  node.children?.sort(pdmTreeNodeComparator);
  node.children?.forEach(sortPdmTree);
}

export function matchesPdmNode(drawing: PdmDrawing, node: PdmTreeNode | null) {
  if (!node) return true;
  if (node.category && drawing.category !== node.category) return false;
  if (node.companyName && (drawing.companyName || "업체 미지정") !== node.companyName) return false;
  if (node.projectName && (drawing.projectName || drawing.groupName || "프로젝트 미지정") !== node.projectName) return false;
  if (node.businessUnit && (drawing.businessUnit || "사업부 미지정") !== node.businessUnit) return false;
  if (node.processName && (drawing.processName || "공정 미지정") !== node.processName) return false;
  if (node.equipmentName && drawing.equipmentName !== node.equipmentName) return false;
  if (node.groupName && (drawing.groupName || "공통도면") !== node.groupName) return false;
  return true;
}

export function matchesPdmKeyword(drawing: PdmDrawing, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;
  return [
    drawing.drawingNo,
    drawing.title,
    drawing.currentRevisionLabel,
    drawing.currentOriginalFileName,
    drawing.companyName,
    drawing.projectName,
    drawing.businessUnit,
    drawing.processName,
    drawing.equipmentName,
    drawing.groupName
  ].some((value) => (value ?? "").toLowerCase().includes(normalized));
}

export function pdmNodePath(node: PdmTreeNode) {
  const parts = node.id.split(":");
  if (node.category === "PRODUCT") return ["제품도면", ...parts.slice(1)].join(" > ");
  if (node.category === "EQUIPMENT") return ["설비도면", ...parts.slice(1).filter((part) => part !== "eq" && part !== "common")].join(" > ");
  return node.label;
}

export function loadLocalPdmFolders(): PdmFolder[] {
  try {
    return JSON.parse(localStorage.getItem("pdmLocalFolders") ?? "[]") as PdmFolder[];
  } catch {
    return [];
  }
}

export function saveLocalPdmFolders(folders: PdmFolder[]) {
  localStorage.setItem("pdmLocalFolders", JSON.stringify(folders));
}

export function mergeServerAndLocalPdmFolders(current: PdmFolder[], localFolders: PdmFolder[]) {
  return [...current.filter((folder) => folder.folderId > 0), ...localFolders];
}

export function localPdmFolderFromForm(form: PdmFolderFormLike): PdmFolder {
  const folderName = form.folderName.trim() || "새 폴더";
  return {
    folderId: -Date.now(),
    category: form.category,
    companyName: form.folderKind === "COMPANY" ? null : form.companyName || null,
    projectName: form.folderKind === "PROJECT" ? folderName : form.projectName || null,
    businessUnit: form.folderKind === "BUSINESS" ? folderName : form.businessUnit || null,
    processName: form.folderKind === "PROCESS" ? folderName : form.processName || null,
    folderKind: form.folderKind,
    folderName,
    sortOrder: Date.now()
  };
}

export function pdmFolderKindFromNode(node: PdmTreeNode): PdmFolder["folderKind"] {
  if (node.type === "company") return "COMPANY";
  if (node.type === "project") return "PROJECT";
  if (node.type === "business") return "BUSINESS";
  if (node.type === "process") return "PROCESS";
  if (node.type === "common") return "COMMON";
  return "EQUIPMENT";
}

export function pdmFolderPathPayload(node: PdmTreeNode) {
  return {
    category: node.category ?? "PRODUCT",
    folderKind: pdmFolderKindFromNode(node),
    folderName: node.label,
    companyName: node.companyName ?? null,
    projectName: node.projectName ?? null,
    businessUnit: node.businessUnit ?? null,
    processName: node.processName ?? null
  };
}

export function renameLocalPdmFolders(node: PdmTreeNode, newName: string) {
  const oldName = node.label;
  return loadLocalPdmFolders().map((folder) => {
    if (!localPdmFolderInNode(folder, node)) return folder;
    const next = { ...folder };
    if (node.type === "company") {
      if (next.folderKind === "COMPANY" && next.folderName === oldName) next.folderName = newName;
      if (next.companyName === oldName) next.companyName = newName;
    } else if (node.type === "project") {
      if (next.folderKind === "PROJECT" && next.folderName === oldName) next.folderName = newName;
      if (next.projectName === oldName) next.projectName = newName;
    } else if (node.type === "business") {
      if (next.folderKind === "BUSINESS" && next.folderName === oldName) next.folderName = newName;
      if (next.businessUnit === oldName) next.businessUnit = newName;
    } else if (node.type === "process") {
      if (next.folderKind === "PROCESS" && next.folderName === oldName) next.folderName = newName;
      if (next.processName === oldName) next.processName = newName;
    } else {
      next.folderName = newName;
    }
    return next;
  });
}

export function localPdmFolderInNode(folder: PdmFolder, node: PdmTreeNode) {
  if (node.category && folder.category !== node.category) return false;
  if (node.type === "company") return folder.folderName === node.label || folder.companyName === node.label;
  if (node.type === "project") return folder.companyName === node.companyName && (folder.folderName === node.label || folder.projectName === node.label);
  if (node.type === "business") return folder.folderName === node.label || folder.businessUnit === node.label;
  if (node.type === "process") return folder.businessUnit === node.businessUnit && (folder.folderName === node.label || folder.processName === node.label);
  if (node.type === "common") return folder.folderKind === "COMMON" && folder.businessUnit === node.businessUnit && folder.processName === node.processName && folder.folderName === node.label;
  if (node.type === "equipment") return folder.folderKind === "EQUIPMENT" && folder.businessUnit === node.businessUnit && folder.processName === node.processName && folder.folderName === node.label;
  return false;
}

export function flattenDepartments(nodes: DeptNode[]): DeptNode[] {
  return nodes.flatMap((node) => [node, ...flattenDepartments(node.children ?? [])]);
}
