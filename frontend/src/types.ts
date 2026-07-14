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
  roleCode: "ADMIN" | "APPROVAL_ADMIN" | "AUDIT_ADMIN" | "MANAGER" | "USER";
  deptId: number | null;
  deptName: string | null;
  permissions: string[];
};

export type LoginResponse = User & {
  accessToken: string;
  refreshToken: string | null;
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

export type GlobalSearchItem = {
  type: "APPROVAL" | "BOARD_POST" | "NOTICE" | "PDM_DRAWING" | "EMPLOYEE" | "NOTIFICATION" | "AUDIT_LOG";
  targetId: number;
  parentId: number | null;
  route: "approvals" | "boards" | "notices" | "pdm" | "organization" | "notifications" | "audit";
  title: string;
  summary: string | null;
  meta: string | null;
  badges: string[];
  occurredAt: string | null;
};

export type GlobalSearchGroup = {
  code: string;
  label: string;
  totalCount: number;
  items: GlobalSearchItem[];
};

export type GlobalSearchResponse = {
  keyword: string;
  groups: GlobalSearchGroup[];
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
  actedEmpName: string | null;
  actedEmpDeptName: string | null;
  actedEmpPositionName: string | null;
  dueAt: string | null;
  remindedAt: string | null;
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
  deletedAt: string | null;
  deletedByEmpId: number | null;
  deletedByName: string | null;
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

export type LeaveUsageSelection = {
  date: string;
  type: string;
  days: string;
  approvalId: number;
  documentNo: string | null;
};

export type LeaveUsage = {
  usedAnnualDays: string;
  totalAnnualDays: string;
  remainingAnnualDays: string;
  selections: LeaveUsageSelection[];
};

export type ApprovalTemplateApi = {
  templateCode: string;
  templateName: string;
  version: number;
  description: string | null;
  fieldsJson: string;
  printLayoutJson: string | null;
  activeYn: "Y" | "N";
  sortOrder: number;
};

export type ApprovalDefaultLineStepApi = {
  stepId: number;
  stepOrder: number;
  approverEmpId: number;
  approverName: string;
  approverDeptName: string | null;
  approverPositionName: string | null;
  lineType: "AGREEMENT" | "APPROVAL" | "RECEIVER" | "REFERENCE" | "READER";
  required: boolean;
};

export type ApprovalDefaultLineApi = {
  defaultLineId: number | null;
  lineName: string | null;
  defaultType: "PERSONAL" | "TEMPLATE" | null;
  source: "PERSONAL" | "TEMPLATE" | "EMPTY";
  templateCode: string | null;
  steps: ApprovalDefaultLineStepApi[];
};

export type ApprovalDelegationApi = {
  delegationId: number;
  ownerEmpId: number;
  ownerName: string;
  delegateEmpId: number;
  delegateName: string;
  delegateDeptName: string | null;
  delegatePositionName: string | null;
  startDate: string;
  endDate: string | null;
  reason: string | null;
  activeYn: "Y" | "N";
  activeNow: boolean;
};

export type ApprovalDashboard = {
  myPendingCount: number;
  delegatedPendingCount: number;
  overdueCount: number;
  requestedInProgressCount: number;
  recentCompletedCount: number;
};

export type ApprovalOperationSettings = {
  decisionDueHours: number;
  reminderFixedDelayMs: number;
  deletedDocumentRetentionDays: number;
  permanentDeleteEnabled: boolean;
  fallbackDecisionDueHours: number;
  fallbackReminderFixedDelayMs: number;
  fallbackDeletedDocumentRetentionDays: number;
  fallbackPermanentDeleteEnabled: boolean;
};

export type EquipmentProposal = {
  approvalId: number;
  workflowStage: "USER_APPROVAL" | "PE_INPUT" | "PE_APPROVAL" | "PURCHASE_INPUT" | "PURCHASE_APPROVAL" | "COMPLETED";
  requestDeptName: string | null;
  equipmentName: string | null;
  requiredCompletionDate: string | null;
  equipmentCapacity: string | null;
  requestType: string | null;
  moldFixtureType: string | null;
  customerName: string | null;
  productName: string | null;
  usageText: string | null;
  partName: string | null;
  cavity: string | null;
  material: string | null;
  moldNo: string | null;
  moldPartsJson: string | null;
  currentState: string | null;
  requirements: string | null;
  instructions: string | null;
  userEconomicReview: string | null;
  peOpinion: string | null;
  designOpinion: string | null;
  peEconomicReview: string | null;
  purchaseOpinion: string | null;
  vendorName: string | null;
  deliveryDueDate: string | null;
  purchaseItemName: string | null;
  purchaseUsage: string | null;
  quantity: string | null;
  price: string | null;
  purchaseNote: string | null;
  attachmentContract: boolean;
  attachmentQuote: boolean;
  attachmentDrawing: boolean;
  attachmentSpec: boolean;
  attachmentEtc: string | null;
  peAssigneeEmpId: number | null;
  peAssigneeName: string | null;
  purchaseAssigneeEmpId: number | null;
  purchaseAssigneeName: string | null;
  canEditUserSection: boolean;
  canEditPeSection: boolean;
  canEditPurchaseSection: boolean;
  canAssignPe: boolean;
  canAssignPurchase: boolean;
  agreementEmpIds?: number[];
  approverEmpIds?: number[];
};

export type PdmPermission = {
  canManage: boolean;
  canRegister: boolean;
  canRevise: boolean;
  canView: boolean;
  canRequestDownload: boolean;
  canApproveDownload: boolean;
};

export type PdmDrawing = {
  drawingId: number;
  category: "PRODUCT" | "EQUIPMENT";
  drawingNo: string;
  title: string;
  companyName: string | null;
  projectName: string | null;
  businessUnit: string | null;
  processName: string | null;
  equipmentName: string | null;
  groupName: string | null;
  status: "ACTIVE" | "OLD_VERSION" | "VOIDED" | "ON_HOLD";
  description: string | null;
  currentRevisionId: number | null;
  currentRevisionLabel: string | null;
  currentRevisionOrder: number | null;
  currentOriginalFileName: string | null;
  createdAt: string | null;
};

export type PdmFolder = {
  folderId: number;
  category: "PRODUCT" | "EQUIPMENT";
  companyName: string | null;
  projectName: string | null;
  businessUnit: string | null;
  processName: string | null;
  folderKind: "COMPANY" | "PROJECT" | "BUSINESS" | "PROCESS" | "COMMON" | "EQUIPMENT";
  folderName: string;
  sortOrder: number;
};

export type PdmRevision = {
  revisionId: number;
  drawingId: number;
  revisionLabel: string;
  revisionOrder: number;
  revisionDate: string | null;
  receivedDate: string | null;
  fileId: number | null;
  originalFileName: string | null;
  latestYn: "Y" | "N";
  voidYn: "Y" | "N";
  changeNote: string | null;
  createdAt: string | null;
};

export type PdmDrawingDetail = {
  drawing: PdmDrawing;
  revisions: PdmRevision[];
  permissions: PdmPermission;
};

export type PdmDownloadRequest = {
  requestId: number;
  drawingId: number;
  drawingNo: string;
  drawingTitle: string;
  revisionId: number;
  revisionLabel: string;
  approvalId: number;
  approvalStatus: "DRAFT" | "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "CANCELED";
  approvedUntil: string | null;
  reason: string;
};

export type PdmDuplicateCheck = {
  duplicate: boolean;
  drawingId: number | null;
  drawingNo: string | null;
  title: string | null;
  message: string | null;
};

export type PdmPermissionAdmin = {
  permissionId: number;
  category: "PRODUCT" | "EQUIPMENT" | null;
  drawingId: number | null;
  drawingNo: string | null;
  deptId: number | null;
  deptName: string | null;
  empId: number | null;
  empName: string | null;
  canRegister: boolean;
  canRevise: boolean;
  canView: boolean;
  canDownloadRequest: boolean;
  canDownloadApprove: boolean;
};

export type Equipment = {
  equipmentId: number;
  equipmentNo: string;
  equipmentName: string;
  equipmentType: "GENERAL" | "UTILITY";
  assetNo: string;
  processId: number | null;
  processName: string | null;
  ownerDeptId: number | null;
  ownerDeptName: string | null;
  modelName: string | null;
  introducedYear: number | null;
  introducedPrice: number | null;
  manufacturer: string | null;
  status: string;
};

export type EquipmentProcess = { processId: number; processName: string; useYn: string };

export type EquipmentReport = {
  reportId: number;
  equipmentId: number;
  equipmentNo: string;
  equipmentName: string;
  title: string;
  symptom: string;
  requestContent: string;
  priority: string;
  occurredOn: string | null;
  state: string;
  reporterEmpId: number;
  reporterName: string;
  assigneeEmpId: number | null;
  assigneeName: string | null;
  plannedStartOn: string | null;
  plannedEndOn: string | null;
  assignmentInstruction: string | null;
  workResult: string | null;
  causeAnalysis: string | null;
  actionTaken: string | null;
  initialApprovalId: number | null;
  completionApprovalId: number | null;
  createdAt: string;
};

export type EquipmentHistoryEvent = {
  eventId: number;
  reportId: number;
  eventType: string;
  message: string;
  actorEmpId: number | null;
  actorName: string | null;
  createdAt: string;
};
