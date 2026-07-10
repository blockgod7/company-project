import type { PdmFolder } from "../types";

export type PdmUploadForm = {
  category: "PRODUCT" | "EQUIPMENT";
  drawingNo: string;
  title: string;
  companyName: string;
  projectName: string;
  businessUnit: string;
  processName: string;
  equipmentName: string;
  groupName: string;
  status: "ACTIVE" | "OLD_VERSION" | "VOIDED" | "ON_HOLD";
  description: string;
  revisionLabel: string;
  revisionOrder: string;
  revisionDate: string;
  receivedDate: string;
  changeNote: string;
};

export type PdmBottomTab = "preview" | "revisions" | "downloads" | "properties";

export type PdmFolderForm = {
  category: "PRODUCT" | "EQUIPMENT";
  folderKind: PdmFolder["folderKind"];
  folderName: string;
  companyName: string;
  projectName: string;
  businessUnit: string;
  processName: string;
};

export const DEFAULT_PDM_UPLOAD: PdmUploadForm = {
  category: "PRODUCT",
  drawingNo: "",
  title: "",
  companyName: "",
  projectName: "",
  businessUnit: "",
  processName: "",
  equipmentName: "",
  groupName: "",
  status: "ACTIVE",
  description: "",
  revisionLabel: "",
  revisionOrder: "",
  revisionDate: "",
  receivedDate: "",
  changeNote: ""
};

export const DEFAULT_PDM_FOLDER_FORM: PdmFolderForm = {
  category: "PRODUCT",
  folderKind: "COMPANY",
  folderName: "",
  companyName: "",
  projectName: "",
  businessUnit: "",
  processName: ""
};
