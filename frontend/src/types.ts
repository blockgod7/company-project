export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string | null;
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
  lineOrder: number;
  status: "WAITING" | "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
  comment: string | null;
  actedAt: string | null;
  approverEmpId: number;
  approverName: string;
  approverDeptName: string | null;
  approverPositionName: string | null;
};

export type ApprovalSummary = {
  approvalId: number;
  title: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  requestedAt: string;
  completedAt: string | null;
  requesterEmpId: number;
  requesterName: string;
  currentApproverName: string | null;
};

export type Approval = ApprovalSummary & {
  content: string;
  requesterDeptName: string | null;
  lines: ApprovalLine[];
};
