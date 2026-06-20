export type ApiResponse<T> = {
  success: boolean;
  data: T;
  code?: string | null;
  message: string | null;
  status?: number;
  timestamp?: string;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type User = {
  empId: number;
  loginId: string;
  empName: string;
  roleCode: "ADMIN" | "MANAGER" | "USER";
  deptId: number | null;
  deptName: string | null;
  permissions: string[];
};

export type LoginResponse = User & {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

export type Notice = {
  noticeId: number;
  title: string;
  content: string;
  writerEmpId: number;
  writerName: string;
  viewCount: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string | null;
  comments: Comment[];
};

export type Board = {
  boardId: number;
  boardCode: string;
  boardName: string;
  deptId: number | null;
  deptName: string | null;
};

export type BoardPost = {
  postId: number;
  boardId: number;
  title: string;
  content: string;
  writerEmpId: number;
  writerName: string;
  viewCount: number;
  draft: boolean;
  createdAt: string;
  updatedAt: string | null;
  comments: Comment[];
};

export type Comment = {
  commentId: number;
  writerEmpId: number;
  writerName: string;
  content: string;
  createdAt: string;
};

export type NotificationItem = {
  notificationId: number;
  title: string;
  message: string | null;
  targetType: string | null;
  targetId: number | null;
  read: boolean;
  readStatus: "UNREAD" | "READ";
  notificationStatus: "PENDING" | "SENT" | "FAILED";
  retryCount: number;
  lastErrorMessage: string | null;
  readAt: string | null;
  createdAt: string;
};

export type DeptNode = {
  deptId: number;
  deptCode: string;
  deptName: string;
  parentDeptId: number | null;
  children: DeptNode[];
};

export type Employee = {
  empId: number;
  empNo: string;
  loginId: string;
  empName: string;
  email: string | null;
  phone: string | null;
  deptId: number | null;
  deptName: string | null;
  positionName: string | null;
  jobTitle: string | null;
  roleCode: string;
  status: string;
};

export type AuditLog = {
  auditId: number;
  empId: number | null;
  actionType: string;
  targetTable: string;
  targetId: number | null;
  reason: string | null;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AttachFile = {
  fileId: number;
  targetType: string;
  targetId: number;
  originalFileName: string;
  fileSize: number;
  fileExt: string | null;
  fileHash: string | null;
  mimeType: string | null;
  createdAt: string;
};

export type ApprovalLine = {
  lineId: number;
  lineType: "AGREEMENT" | "APPROVAL" | "RECEIVER" | "REFERENCE" | "READER";
  lineOrder: number;
  status: "WAITING" | "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED" | "RECEIVED" | "READ" | "RECEIPT_COMPLETED";
  comment: string | null;
  actedAt: string | null;
  readAt: string | null;
  signedAt: string | null;
  signatureSnapshotFileId: number | null;
  signatureSnapshotJson: string | null;
  approverEmpId: number;
  approverName: string;
  approverDeptName: string | null;
  approverPositionName: string | null;
  assignedEmpId: number | null;
  actedEmpId: number | null;
  empNoSnapshot: string | null;
  empNameSnapshot: string | null;
  deptIdSnapshot: number | null;
  deptCodeSnapshot: string | null;
  deptNameSnapshot: string | null;
  positionSnapshot: string | null;
};

export type ApprovalSummary = {
  approvalId: number;
  documentNo: string | null;
  title: string;
  templateCode: string | null;
  templateVersion: number | null;
  pdfStatus: "NONE" | "GENERATING" | "GENERATED" | "FAILED";
  status: "DRAFT" | "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "CANCELED";
  currentStage: "DRAFT" | "AGREEMENT_PROGRESS" | "APPROVAL_PROGRESS" | "RECEIVER_PROGRESS" | "COMPLETED" | "REJECTED" | "WITHDRAWN" | "CANCELED";
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  requestedAt: string;
  completedAt: string | null;
  requesterEmpId: number;
  requesterName: string;
  currentApproverName: string | null;
};

export type ApprovalPermissions = {
  canView: boolean;
  canEditDraft: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canWithdraw: boolean;
  canRedraft: boolean;
  canCancel: boolean;
  canReceive: boolean;
  canCompleteReceipt: boolean;
  canDownloadAttachment: boolean;
  canPrintPdf: boolean;
  canExport: boolean;
};

export type Approval = ApprovalSummary & {
  content: string;
  templateSnapshotJson: string | null;
  formDataJson: string | null;
  pdfFileId: number | null;
  pdfGeneratedAt: string | null;
  pdfErrorMessage: string | null;
  pdfHash: string | null;
  firstSubmittedAt: string | null;
  lastSubmittedAt: string | null;
  submitCount: number;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  requesterDeptName: string | null;
  requesterPositionName: string | null;
  draftDeptId: number | null;
  draftDeptCode: string | null;
  draftDeptName: string | null;
  lines: ApprovalLine[];
  permissions: ApprovalPermissions | null;
};

export type ApprovalTemplateApi = {
  templateCode: string;
  templateName: string;
  version: number;
  description: string | null;
  fieldsJson: string;
  printLayoutJson: string | null;
  sortOrder: number;
};
