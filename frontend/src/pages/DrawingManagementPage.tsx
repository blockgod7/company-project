import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  FileText,
  Folder,
  History,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { api, authenticatedFetch, jsonBody } from "../api";
import { CardHeader } from "../components/CardHeader";
import { EmployeeMultiPicker } from "../components/EmployeePickers";
import { Empty, EmptyDetail } from "../components/Empty";
import { DetailPage, ListSummary, Toolbar, TwoPane } from "../components/PageLayout";
import { PdmTreeItem } from "../components/PdmTreeItem";
import { formatDate } from "../utils/date";
import type { ApprovalLaunch } from "../utils/approvalDomain";
import {
  approvalStatusLabel,
  fileExtension,
  fileNameFromContentDisposition,
  pdmPermissionLabel,
  pdmPermissionMark,
  pdmPermissionNames,
  pdmPermissionScopeLabel,
  pdmPermissionTargetKindLabel,
  pdmStatusLabel
} from "../utils/pdmLabels";
import { DEFAULT_PDM_FOLDER_FORM, DEFAULT_PDM_UPLOAD } from "../utils/pdmForms";
import type { PdmBottomTab, PdmFolderForm, PdmUploadForm } from "../utils/pdmForms";
import {
  buildPdmTree,
  flattenDepartments,
  loadLocalPdmFolders,
  localPdmFolderFromForm,
  localPdmFolderInNode,
  matchesPdmKeyword,
  matchesPdmNode,
  mergeServerAndLocalPdmFolders,
  pdmFolderKindFromNode,
  pdmFolderPathPayload,
  pdmNodePath,
  renameLocalPdmFolders,
  saveLocalPdmFolders
} from "../utils/pdmTree";
import type { PdmTreeNode } from "../utils/pdmTree";
import type { GlobalSearchTarget } from "../utils/search";
import { isSameServerFolderNode, validateUploadRequiredFields } from "../utils/drawingManagement";
import type {
  DeptNode,
  Employee,
  PdmDownloadRequest,
  PdmDrawing,
  PdmDrawingDetail,
  PdmDuplicateCheck,
  PdmFolder,
  PdmPermission,
  PdmPermissionAdmin,
  PdmRevision,
  PageResponse,
  User
} from "../types";

import { DrawingManagementModals } from "./DrawingManagementModals";
export function DrawingManagementPage({ user, openApprovals, target }: { user: User; openApprovals: (target?: ApprovalLaunch) => void; target: GlobalSearchTarget | null }) {
  const [tab, setTab] = useState<"drawings" | "downloads" | "permissions">("drawings");
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searchAll, setSearchAll] = useState(false);
  const [drawings, setDrawings] = useState<PdmDrawing[]>([]);
  const [folders, setFolders] = useState<PdmFolder[]>([]);
  const [selected, setSelected] = useState<PdmDrawingDetail | null>(null);
  const [selectedNode, setSelectedNode] = useState<PdmTreeNode | null>(null);
  const [bottomTab, setBottomTab] = useState<PdmBottomTab>("preview");
  const [downloads, setDownloads] = useState<PdmDownloadRequest[]>([]);
  const [permissions, setPermissions] = useState<PdmPermissionAdmin[]>([]);
  const [categoryPermissions, setCategoryPermissions] = useState<Record<"PRODUCT" | "EQUIPMENT", PdmPermission | null>>({ PRODUCT: null, EQUIPMENT: null });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<DeptNode[]>([]);
  const [message, setMessage] = useState("");
  const [uploadForm, setUploadForm] = useState<PdmUploadForm>(DEFAULT_PDM_UPLOAD);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderEditOpen, setFolderEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusForm, setStatusForm] = useState<PdmDrawing["status"]>("ACTIVE");
  const [folderForm, setFolderForm] = useState<PdmFolderForm>(DEFAULT_PDM_FOLDER_FORM);
  const [adminOpen, setAdminOpen] = useState(false);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [revisionLabel, setRevisionLabel] = useState("");
  const [revisionOrder, setRevisionOrder] = useState("");
  const [downloadReason, setDownloadReason] = useState("");
  const [downloadApproverId, setDownloadApproverId] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfPreviewError, setPdfPreviewError] = useState("");
  const [permissionForm, setPermissionForm] = useState({
    category: "",
    deptId: "",
    empId: "",
    canRegister: false,
    canRevise: false,
    canView: true,
    canDownloadRequest: true,
    canDownloadApprove: false
  });
  const [permissionTargetMode, setPermissionTargetMode] = useState<"DEPT" | "EMP">("DEPT");
  const [permissionListFilter, setPermissionListFilter] = useState<"ALL" | "DEPT" | "EMP">("ALL");
  const [permissionKeyword, setPermissionKeyword] = useState("");
  const [permissionEmployeeFilter, setPermissionEmployeeFilter] = useState("");

  const canAdmin = user.roleCode === "ADMIN" || user.roleCode === "APPROVAL_ADMIN";
  const canManagePdmPermissions = canAdmin || user.roleCode === "MANAGER";
  const tree = buildPdmTree(drawings, folders);
  const activePdmCategory = selectedNode?.category ?? selected?.drawing.category ?? null;
  const canRegisterProduct = canAdmin || Boolean(categoryPermissions.PRODUCT?.canRegister);
  const canRegisterEquipment = canAdmin || Boolean(categoryPermissions.EQUIPMENT?.canRegister);
  const canRegisterPdmCategory = (categoryValue: PdmDrawing["category"] | null | undefined) => (
    categoryValue ? categoryValue === "PRODUCT" ? canRegisterProduct : canRegisterEquipment : canRegisterProduct || canRegisterEquipment
  );
  const canRegisterCurrentPdmCategory = canRegisterPdmCategory(activePdmCategory);
  const selectedServerFolder = selectedNode ? folders.find((folder) => isSameServerFolderNode(folder, selectedNode)) : null;
  const selectedMoveFolderId = selectedNode?.folderId && selectedNode.folderId > 0 ? selectedNode.folderId : selectedServerFolder?.folderId;
  const selectedRevision = selected?.revisions.find((revision) => revision.latestYn === "Y") ?? selected?.revisions[0] ?? null;
  const selectedDownloads = selected ? downloads.filter((request) => request.drawingId === selected.drawing.drawingId) : downloads;
  const selectedApprovedDownloads = selectedDownloads.filter((request) => request.approvalStatus === "APPROVED").length;
  const selectedOpenDownloads = selectedDownloads.filter((request) => request.approvalStatus === "PENDING" || request.approvalStatus === "IN_PROGRESS").length;
  const selectedOldRevisionCount = selected?.revisions.filter((revision) => revision.latestYn !== "Y").length ?? 0;
  const selectedFileName = selectedRevision?.originalFileName ?? selected?.drawing.currentOriginalFileName ?? selected?.drawing.title ?? "";
  const selectedExtension = fileExtension(selectedFileName);
  const selectedPath = selectedNode ? pdmNodePath(selectedNode) : "도면관리";
  const assignableEmployees = canAdmin ? employees : employees.filter((employee) => employee.deptId === user.deptId);
  const permissionKeywordNormalized = permissionKeyword.trim().toLowerCase();
  const filteredPermissions = permissions
    .filter((permission) => permissionListFilter === "ALL" || (permissionListFilter === "DEPT" ? permission.deptId != null : permission.empId != null))
    .filter((permission) => !permissionEmployeeFilter || permission.empId === Number(permissionEmployeeFilter))
    .filter((permission) => {
      if (!permissionKeywordNormalized) return true;
      return [
        permission.deptName,
        permission.empName,
        permission.category,
        pdmPermissionScopeLabel(permission.category),
        pdmPermissionTargetKindLabel(permission),
        pdmPermissionNames(permission).join(" ")
      ].filter(Boolean).join(" ").toLowerCase().includes(permissionKeywordNormalized);
    });
  const departmentPermissionCount = permissions.filter((permission) => permission.deptId != null).length;
  const personalPermissionCount = permissions.filter((permission) => permission.empId != null).length;

  async function loadDrawings() {
    const params = new URLSearchParams();
    params.set("size", "300");
    const page = await api<PageResponse<PdmDrawing>>(`/pdm/drawings?${params.toString()}`);
    setDrawings(page.content);
  }

  async function loadFolders() {
    try {
      const serverFolders = await api<PdmFolder[]>("/pdm/folders");
      setFolders([...serverFolders, ...loadLocalPdmFolders()]);
    } catch {
      setFolders(loadLocalPdmFolders());
    }
  }

  async function loadDetail(drawingId: number) {
    const detail = await api<PdmDrawingDetail>(`/pdm/drawings/${drawingId}`);
    setSelected(detail);
  }

  async function loadDownloads() {
    setDownloads(await api<PdmDownloadRequest[]>("/pdm/download-requests/me"));
  }

  async function loadEffectivePdmPermissions() {
    try {
      const [product, equipment] = await Promise.all([
        api<PdmPermission>("/pdm/permissions/effective?category=PRODUCT"),
        api<PdmPermission>("/pdm/permissions/effective?category=EQUIPMENT")
      ]);
      setCategoryPermissions({ PRODUCT: product, EQUIPMENT: equipment });
    } catch {
      setCategoryPermissions({ PRODUCT: null, EQUIPMENT: null });
    }
  }

  async function loadAdminData() {
    const employeeParams = new URLSearchParams({ size: "200" });
    if (!canAdmin && user.deptId != null) employeeParams.set("deptId", String(user.deptId));
    const [employeePage, deptTree] = await Promise.all([
      api<PageResponse<Employee>>(`/emps?${employeeParams.toString()}`),
      api<DeptNode[]>("/depts/tree")
    ]);
    setEmployees(employeePage.content);
    setDepartments(deptTree);
    if (canManagePdmPermissions) {
      setPermissions(await api<PdmPermissionAdmin[]>("/pdm/permissions"));
    }
  }

  useEffect(() => {
    void loadDrawings();
    void loadFolders();
    void loadDownloads();
    void loadEffectivePdmPermissions();
    void loadAdminData();
  }, []);

  useEffect(() => {
    if (target?.type === "PDM_DRAWING") {
      setTab("drawings");
      setSearchAll(true);
      setKeyword(target.keyword);
      setSelectedNode(null);
      setBottomTab("preview");
      void loadDetail(target.targetId);
    }
  }, [target?.nonce]);

  useEffect(() => {
    setPdfPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setPdfPreviewError("");
    if (bottomTab !== "preview" || !selectedRevision || selectedExtension !== "pdf") return;
    let cancelled = false;
    authenticatedFetch(`/pdm/revisions/${selectedRevision.revisionId}/preview`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          if (!cancelled) setPdfPreviewError(payload?.message ?? "PDF 미리보기를 불러올 수 없습니다.");
          return;
        }
        const blob = await response.blob();
        if (blob.size < 5) {
          if (!cancelled) setPdfPreviewError("PDF 파일이 비어 있거나 손상되었습니다.");
          return;
        }
        if (!cancelled) setPdfPreviewUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) setPdfPreviewError("PDF 미리보기를 불러올 수 없습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [bottomTab, selectedRevision?.revisionId, selectedExtension]);

  async function checkDuplicate() {
    if (!uploadForm.drawingNo.trim()) return;
    const result = await api<PdmDuplicateCheck>(`/pdm/drawings/duplicate?drawingNo=${encodeURIComponent(uploadForm.drawingNo.trim())}`);
    if (result.duplicate) {
      alert(result.message ?? "이미 등록된 도면번호입니다. 새 리비전으로 등록하거나 업로드를 취소하세요.");
    }
  }

  function appendUploadFields(formData: FormData, form: PdmUploadForm) {
    Object.entries(form).forEach(([key, value]) => {
      if (value !== "") formData.set(key, value);
    });
    if (form.category === "PRODUCT" && form.projectName && !form.groupName) {
      formData.set("groupName", form.projectName);
    }
    if (!formData.has("revisionOrder")) {
      formData.set("revisionOrder", "1");
    }
  }

  async function uploadDrawing(event: FormEvent) {
    event.preventDefault();
    try {
      const requiredMessage = validateUploadRequiredFields(uploadForm, uploadFile);
      if (requiredMessage) {
        setMessage(requiredMessage);
        alert(requiredMessage);
        return;
      }
      if (!uploadFile) {
        setMessage("도면 파일을 선택해 주세요.");
        return;
      }
      const duplicate = await api<PdmDuplicateCheck>(`/pdm/drawings/duplicate?drawingNo=${encodeURIComponent(uploadForm.drawingNo.trim())}`);
      if (duplicate.duplicate) {
        alert(duplicate.message ?? "이미 등록된 도면번호입니다. 새 리비전으로 등록하거나 업로드를 취소하세요.");
        return;
      }
      const formData = new FormData();
      appendUploadFields(formData, uploadForm);
      formData.set("file", uploadFile);
      const detail = await api<PdmDrawingDetail>("/pdm/drawings", { method: "POST", body: formData });
      setSelected(detail);
      setUploadForm(DEFAULT_PDM_UPLOAD);
      setUploadFile(null);
      setUploadOpen(false);
      setMessage("도면이 등록되었습니다.");
      await loadDrawings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "도면 등록 중 오류가 발생했습니다.";
      setMessage(message);
      alert(message);
    }
  }

  async function addRevision(event: FormEvent) {
    event.preventDefault();
    if (!selected || !revisionFile) return;
    const formData = new FormData();
    formData.set("revisionLabel", revisionLabel);
    formData.set("revisionOrder", `${(selected.drawing.currentRevisionOrder ?? 0) + 1}`);
    formData.set("file", revisionFile);
    const detail = await api<PdmDrawingDetail>(`/pdm/drawings/${selected.drawing.drawingId}/revisions`, { method: "POST", body: formData });
    setSelected(detail);
    setRevisionLabel("");
    setRevisionFile(null);
    setMessage("리비전이 추가되었습니다.");
    await loadDrawings();
  }

  async function voidSelectedDrawing() {
    if (!selected) {
      setMessage("폐기할 도면을 선택해 주세요.");
      return;
    }
    if (!confirm(`${selected.drawing.drawingNo} 도면을 폐기 처리할까요?`)) return;
    try {
      const detail = await api<PdmDrawingDetail>(`/pdm/drawings/${selected.drawing.drawingId}/actions/void`, { method: "POST" });
      setSelected(detail);
      setMessage("도면이 폐기 처리되었습니다.");
      await loadDrawings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "도면 폐기 중 오류가 발생했습니다.";
      setMessage(message);
      alert(message);
    }
  }

  function openStatusChange() {
    if (!selected) {
      setMessage("상태를 변경할 도면을 선택해 주세요.");
      return;
    }
    setStatusForm(selected.drawing.status);
    setStatusOpen(true);
  }

  async function saveDrawingStatus(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      const detail = await api<PdmDrawingDetail>(`/pdm/drawings/${selected.drawing.drawingId}/actions/status`, {
        method: "POST",
        body: jsonBody({ status: statusForm })
      });
      setSelected(detail);
      setStatusOpen(false);
      setMessage("도면 상태가 변경되었습니다.");
      await loadDrawings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "도면 상태 변경 중 오류가 발생했습니다.";
      setMessage(message);
      alert(message);
    }
  }

  async function deleteRevision(revision: PdmRevision) {
    if (!selected) return;
    if (!confirm(`Rev ${revision.revisionLabel} 리비전을 삭제할까요? 삭제된 리비전은 열람/다운로드할 수 없습니다.`)) return;
    try {
      const detail = await api<PdmDrawingDetail>(`/pdm/revisions/${revision.revisionId}/actions/delete`, { method: "POST" });
      setSelected(detail);
      setMessage("리비전이 삭제되었습니다.");
      await loadDrawings();
      await loadDownloads();
    } catch (error) {
      const message = error instanceof Error ? error.message : "리비전 삭제 중 오류가 발생했습니다.";
      setMessage(message);
      alert(message);
    }
  }

  async function requestDownload(revisionId: number) {
    if (!downloadReason.trim() || !downloadApproverId) {
      setMessage("다운로드 사유와 결재자를 선택해 주세요.");
      return;
    }
    const revision = selected?.revisions.find((item) => item.revisionId === revisionId);
    if (revision && revision.latestYn !== "Y" && !confirm("구버전 도면입니다. 그래도 다운로드 결재를 요청할까요?")) return;
    await api<PdmDownloadRequest>(`/pdm/revisions/${revisionId}/download-requests`, {
      method: "POST",
      body: jsonBody({ reason: downloadReason, approverEmpIds: [Number(downloadApproverId)] })
    });
    setDownloadReason("");
    setDownloadApproverId("");
    setMessage("다운로드 결재가 상신되었습니다.");
    await loadDownloads();
    openApprovals({ box: "requested", dashboardFilter: "requestedInProgress", label: "진행문서" });
  }

  async function downloadRequest(request: PdmDownloadRequest) {
    const response = await authenticatedFetch(`/pdm/download-requests/${request.requestId}/download`);
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setMessage(payload?.message ?? "다운로드 가능한 승인 상태가 아니거나 유효기간이 만료되었습니다.");
      return;
    }
    const blob = await response.blob();
    if (!blob.size) {
      setMessage("다운로드 파일이 비어 있습니다.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileNameFromContentDisposition(response.headers.get("Content-Disposition")) ?? `${request.drawingNo}-${request.revisionLabel}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function openRevisionPdfViewer(revisionId: number) {
    const viewer = window.open("about:blank", "_blank");
    try {
      const response = await authenticatedFetch(`/pdm/revisions/${revisionId}/preview`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        viewer?.close();
        setMessage(payload?.message ?? "PDF 열람 파일을 불러올 수 없습니다.");
        return;
      }
      const blob = await response.blob();
      if (blob.size < 5) {
        viewer?.close();
        setMessage("PDF 열람 파일이 비어 있거나 손상되었습니다.");
        return;
      }
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (!viewer) {
        URL.revokeObjectURL(url);
        setMessage("팝업이 차단되어 PDF 열람 창을 열 수 없습니다.");
        return;
      }
      viewer.opener = null;
      viewer.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      viewer?.close();
      setMessage("PDF 열람 중 오류가 발생했습니다.");
    }
  }

  async function savePermission(event: FormEvent) {
    event.preventDefault();
    const effectivePermissionTargetMode = canAdmin ? permissionTargetMode : "EMP";
    if (effectivePermissionTargetMode === "DEPT" && !permissionForm.deptId) {
      setMessage("권한 범위를 설정할 부서를 선택해 주세요.");
      return;
    }
    if (effectivePermissionTargetMode === "EMP" && !permissionForm.empId) {
      setMessage("권한을 배정할 직원을 선택해 주세요.");
      return;
    }
    await api<PdmPermissionAdmin>("/pdm/permissions", {
      method: "POST",
      body: jsonBody({
        category: permissionForm.category || null,
        deptId: effectivePermissionTargetMode === "DEPT" && permissionForm.deptId ? Number(permissionForm.deptId) : null,
        empId: effectivePermissionTargetMode === "EMP" && permissionForm.empId ? Number(permissionForm.empId) : null,
        canRegister: permissionForm.canRegister,
        canRevise: permissionForm.canRevise,
        canView: permissionForm.canView,
        canDownloadRequest: permissionForm.canDownloadRequest,
        canDownloadApprove: permissionForm.canDownloadApprove
      })
    });
    setMessage("도면 권한이 저장되었습니다.");
    await loadAdminData();
  }

  async function saveFolder(event: FormEvent) {
    event.preventDefault();
    try {
      await api<PdmFolder>("/pdm/folders", {
        method: "POST",
        body: jsonBody({
          category: folderForm.category,
          folderKind: folderForm.folderKind,
          folderName: folderForm.folderName,
          companyName: folderForm.companyName || null,
          projectName: folderForm.projectName || null,
          businessUnit: folderForm.businessUnit || null,
          processName: folderForm.processName || null
        })
      });
      setFolderOpen(false);
      setFolderForm(DEFAULT_PDM_FOLDER_FORM);
      setMessage("폴더가 추가되었습니다.");
      await loadFolders();
    } catch (error) {
      const localFolder = localPdmFolderFromForm(folderForm);
      const nextFolders = [...loadLocalPdmFolders(), localFolder];
      saveLocalPdmFolders(nextFolders);
      setFolders((current) => [...current, localFolder]);
      setFolderOpen(false);
      setFolderForm(DEFAULT_PDM_FOLDER_FORM);
      setMessage("백엔드 재시작 전까지 임시 폴더로 추가했습니다.");
    }
  }

  async function saveFolderRename(event: FormEvent) {
    event.preventDefault();
    if (!selectedNode || selectedNode.type === "root") {
      alert("수정할 폴더를 선택해 주세요.");
      return;
    }
    if (!canRegisterPdmCategory(selectedNode.category)) {
      setMessage("도면 파일 등록 권한이 있어야 폴더명을 수정할 수 있습니다.");
      return;
    }
    const folderName = folderForm.folderName.trim();
    if (!folderName) {
      alert("폴더명을 입력해 주세요.");
      return;
    }
    if (selectedNode.folderId && selectedNode.folderId < 0) {
      const renamed = renameLocalPdmFolders(selectedNode, folderName);
      saveLocalPdmFolders(renamed);
      setFolders((current) => mergeServerAndLocalPdmFolders(current, renamed));
      setSelectedNode(null);
      setFolderEditOpen(false);
      setMessage("폴더명이 수정되었습니다.");
      return;
    }
    try {
      await api<PdmFolder[]>("/pdm/folders/actions/rename", {
        method: "POST",
        body: jsonBody({ ...pdmFolderPathPayload(selectedNode), newFolderName: folderName })
      });
      setFolderEditOpen(false);
      setSelectedNode(null);
      setMessage("폴더명이 수정되었습니다.");
      await loadDrawings();
      await loadFolders();
    } catch (error) {
      const message = error instanceof Error ? error.message : "폴더명 수정 중 오류가 발생했습니다.";
      setMessage(message);
      alert(message);
    }
  }

  async function deleteSelectedFolder() {
    if (!selectedNode || selectedNode.type === "root") {
      alert("삭제할 폴더를 선택해 주세요.");
      return;
    }
    if (!canRegisterPdmCategory(selectedNode.category)) {
      setMessage("도면 파일 등록 권한이 있어야 폴더를 삭제할 수 있습니다.");
      return;
    }
    if (!window.confirm(`${selectedNode.label} 폴더를 삭제할까요? 도면이 들어 있는 폴더는 삭제되지 않습니다.`)) return;
    if (visibleDrawings.length > 0) {
      alert("도면이 들어 있는 폴더는 삭제할 수 없습니다. 도면을 먼저 이동하거나 정리해 주세요.");
      return;
    }
    if (selectedNode.folderId && selectedNode.folderId < 0) {
      const nextFolders = loadLocalPdmFolders().filter((folder) => !localPdmFolderInNode(folder, selectedNode));
      saveLocalPdmFolders(nextFolders);
      setFolders((current) => mergeServerAndLocalPdmFolders(current, nextFolders));
      setSelectedNode(null);
      setMessage("폴더가 삭제되었습니다.");
      return;
    }
    try {
      await api<PdmFolder[]>("/pdm/folders/actions/delete", {
        method: "POST",
        body: jsonBody(pdmFolderPathPayload(selectedNode))
      });
      setSelectedNode(null);
      setMessage("폴더가 삭제되었습니다.");
      await loadFolders();
    } catch (error) {
      const message = error instanceof Error ? error.message : "폴더 삭제 중 오류가 발생했습니다.";
      setMessage(message);
      alert(message);
    }
  }

  async function moveSelectedFolder(direction: "UP" | "DOWN") {
    if (!selectedNode || !selectedMoveFolderId || selectedNode.type === "root") {
      setMessage("순서를 변경할 서버 폴더를 선택해 주세요.");
      return;
    }
    if (!canRegisterPdmCategory(selectedNode.category)) {
      setMessage("도면 파일 등록 권한이 없어 폴더 순서를 변경할 수 없습니다.");
      return;
    }
    try {
      const updated = await api<PdmFolder[]>(`/pdm/folders/${selectedMoveFolderId}/actions/move`, {
        method: "POST",
        body: jsonBody({ direction })
      });
      setFolders([...updated, ...loadLocalPdmFolders()]);
      setMessage(direction === "UP" ? "폴더를 위로 이동했습니다." : "폴더를 아래로 이동했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "폴더 순서 변경 중 오류가 발생했습니다.";
      setMessage(message);
      alert(message);
    }
  }

  const flatDepartments = flattenDepartments(departments);
  const approverOptions = employees.filter((employee) => employee.status === "ACTIVE");
  const productCompanyOptions = Array.from(new Set([
    ...drawings.filter((drawing) => drawing.category === "PRODUCT").map((drawing) => drawing.companyName).filter(Boolean),
    ...folders.filter((folder) => folder.category === "PRODUCT" && folder.folderKind === "COMPANY").map((folder) => folder.folderName).filter(Boolean),
    ...folders.filter((folder) => folder.category === "PRODUCT").map((folder) => folder.companyName).filter(Boolean)
  ] as string[])).sort((a, b) => a.localeCompare(b, "ko"));
  const visibleDrawings = drawings
    .filter((drawing) => searchAll || matchesPdmNode(drawing, selectedNode))
    .filter((drawing) => matchesPdmKeyword(drawing, keyword))
    .sort((a, b) => b.drawingId - a.drawingId);

  function openUploadFromNode(node: PdmTreeNode | null) {
    const targetCategory = node?.category ?? (canRegisterProduct ? "PRODUCT" : canRegisterEquipment ? "EQUIPMENT" : null);
    if (!targetCategory || (targetCategory === "PRODUCT" ? !canRegisterProduct : !canRegisterEquipment)) {
      setMessage("도면 파일 등록 권한이 필요합니다.");
      return;
    }
    const next: PdmUploadForm = { ...DEFAULT_PDM_UPLOAD };
    next.category = targetCategory;
    if (targetCategory === "PRODUCT") {
      next.category = "PRODUCT";
      next.companyName = node?.companyName ?? "";
      next.projectName = node?.projectName ?? "";
    }
    if (targetCategory === "EQUIPMENT") {
      next.category = "EQUIPMENT";
      next.businessUnit = node?.businessUnit ?? "";
      next.processName = node?.processName ?? "";
      next.groupName = node?.type === "common" ? node.groupName ?? "공통도면" : "";
      next.equipmentName = node?.type === "equipment" ? node.equipmentName ?? "" : "";
    }
    setUploadForm(next);
    setUploadFile(null);
    setUploadOpen(true);
  }

  function openFolderFromNode(node: PdmTreeNode | null) {
    const targetCategory = node?.category ?? (canRegisterProduct ? "PRODUCT" : canRegisterEquipment ? "EQUIPMENT" : null);
    if (!targetCategory || (targetCategory === "PRODUCT" ? !canRegisterProduct : !canRegisterEquipment)) {
      setMessage("도면 파일 등록 권한이 있어야 폴더를 추가할 수 있습니다.");
      return;
    }
    const next: PdmFolderForm = { ...DEFAULT_PDM_FOLDER_FORM };
    next.category = targetCategory;
    if (targetCategory === "PRODUCT") {
      next.category = "PRODUCT";
      next.companyName = node?.companyName ?? "";
      next.projectName = node?.projectName ?? "";
      next.folderKind = node?.type === "company" ? "PROJECT" : "COMPANY";
    }
    if (targetCategory === "EQUIPMENT") {
      next.category = "EQUIPMENT";
      next.businessUnit = node?.businessUnit ?? "";
      next.processName = node?.processName ?? "";
      next.folderKind = node?.type === "business" ? "PROCESS" : node?.type === "process" ? "EQUIPMENT" : "BUSINESS";
    }
    setFolderForm(next);
    setFolderOpen(true);
  }

  function openFolderRenameFromNode(node: PdmTreeNode | null) {
    if (!node || node.type === "root") {
      alert("수정할 폴더를 선택해 주세요.");
      return;
    }
    setFolderForm({
      category: node.category ?? "PRODUCT",
      folderKind: pdmFolderKindFromNode(node),
      folderName: node.label,
      companyName: node.companyName ?? "",
      projectName: node.projectName ?? "",
      businessUnit: node.businessUnit ?? "",
      processName: node.processName ?? ""
    });
    setFolderEditOpen(true);
  }

  function openMyDownloadRequests() {
    setSelected(null);
    setBottomTab("downloads");
    void loadDownloads();
  }

  return (
    <section className="page-section pdm-page pdm-workbench">
      <div className="pdm-commandbar">
        <div className="pdm-command-left pdm-actions">
          <button className="primary-action" onClick={() => openUploadFromNode(selectedNode)} disabled={!canRegisterCurrentPdmCategory}><Upload size={16} /> 파일 등록</button>
          <button className="ghost" onClick={() => openFolderFromNode(selectedNode)} disabled={!canRegisterCurrentPdmCategory}><Folder size={16} /> 폴더 추가</button>
          <button className="ghost" onClick={() => openFolderRenameFromNode(selectedNode)} disabled={!selectedNode || selectedNode.type === "root" || !canRegisterCurrentPdmCategory}><Edit3 size={16} /> 폴더명 수정</button>
          <button className="ghost danger" onClick={() => void deleteSelectedFolder()} disabled={!selectedNode || selectedNode.type === "root" || !canRegisterCurrentPdmCategory}><Trash2 size={16} /> 폴더 삭제</button>
          {selected?.permissions.canRevise && (
            <button className="ghost" onClick={openStatusChange}><Edit3 size={16} /> 상태 변경</button>
          )}
          {selected?.permissions.canRevise && selected.drawing.status !== "VOIDED" && (
            <button className="ghost danger" onClick={() => void voidSelectedDrawing()}><Trash2 size={16} /> 도면 폐기</button>
          )}
          <button className="ghost" onClick={openMyDownloadRequests}><Download size={16} /> 내 다운로드</button>
          <button className="ghost" onClick={() => openApprovals({ box: "requested", label: "내 결재 요청" })}><ClipboardCheck size={16} /> 결재함</button>
        </div>
        <div className="pdm-command-meta">
          <div className="pdm-breadcrumb" title={selectedPath}>{selectedPath}</div>
          <div className="pdm-search">
            <Search size={16} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="도면번호, 파일명, 도면명, 리비전 검색" />
            <label><input type="checkbox" checked={searchAll} onChange={(event) => setSearchAll(event.target.checked)} /> 전체 검색</label>
          {canManagePdmPermissions && (
            <button
              className="ghost"
              onClick={() => {
                if (!canAdmin) {
                  setPermissionTargetMode("EMP");
                  setPermissionListFilter("ALL");
                  setPermissionForm({ ...permissionForm, deptId: "" });
                }
                setAdminOpen(true);
                void loadAdminData();
              }}
            >
              <Shield size={16} /> {canAdmin ? "권한" : "우리 부서 권한"}
            </button>
          )}
          </div>
        </div>
      </div>
      {message && <div className="notice-banner">{message}</div>}

      <div className="pdm-workbench-grid">
        <aside className="pdm-tree-panel">
          <div className="panel-head">
            <h3>도면 폴더</h3>
            <div className="pdm-tree-head-actions">
              <button className="ghost" onClick={() => void moveSelectedFolder("UP")} disabled={!selectedMoveFolderId || !canRegisterCurrentPdmCategory} aria-label="폴더 위로 이동"><ArrowUp size={15} /></button>
              <button className="ghost" onClick={() => void moveSelectedFolder("DOWN")} disabled={!selectedMoveFolderId || !canRegisterCurrentPdmCategory} aria-label="폴더 아래로 이동"><ArrowDown size={15} /></button>
              <button className="ghost" onClick={loadDrawings} aria-label="도면 폴더 새로고침"><RefreshCw size={15} /></button>
            </div>
          </div>
          <div className="pdm-tree">
            {tree.map((node) => (
              <PdmTreeItem key={node.id} node={node} selectedId={selectedNode?.id ?? ""} onSelect={(item) => { setSelectedNode(item); setSelected(null); }} />
            ))}
          </div>
        </aside>

        <div className="pdm-main-panel">
          <div className="pdm-list-head">
            <div>
              <p className="eyebrow">LATEST DRAWINGS</p>
              <h2>{selectedNode?.label ?? "전체 도면"}</h2>
            </div>
            <span>{visibleDrawings.length}건</span>
          </div>
          <div className="pdm-table-wrap">
            <table className="content-table pdm-file-table">
              <thead>
                <tr>
                  <th>파일명</th>
                  <th>확장자</th>
                  <th>도면번호</th>
                  <th>도면명</th>
                  <th>리비전</th>
                  <th>상태</th>
                  <th>등록자</th>
                  <th>등록일</th>
                </tr>
              </thead>
              <tbody>
                {visibleDrawings.map((drawing) => (
                  <tr key={drawing.drawingId} className={`pdm-row-status-${drawing.status.toLowerCase()} ${selected?.drawing.drawingId === drawing.drawingId ? "selected" : ""}`} onClick={() => { setBottomTab("preview"); void loadDetail(drawing.drawingId); }}>
                    <td><FileText size={15} /> {drawing.currentOriginalFileName ?? drawing.title}</td>
                    <td>{fileExtension(drawing.currentOriginalFileName ?? "") || "-"}</td>
                    <td>{drawing.drawingNo}</td>
                    <td>{drawing.title}</td>
                    <td><span className="pdm-revision-badge">Rev {drawing.currentRevisionLabel ?? "-"}</span></td>
                    <td><span className={`status-pill pdm-status-${drawing.status.toLowerCase()}`}>{pdmStatusLabel(drawing.status)}</span></td>
                    <td>-</td>
                    <td>{formatDate(drawing.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleDrawings.length && <Empty text="선택한 위치에 표시할 최신 도면이 없습니다." />}
          </div>
        </div>

        <div className="pdm-bottom-panel">
          {selected ? (
            <>
              <div className="pdm-detail-head">
                <div>
                  <strong>{selected.drawing.drawingNo}</strong>
                  <span>{selected.drawing.title}</span>
                </div>
                <div className="segmented">
                  <button className={bottomTab === "preview" ? "active" : ""} onClick={() => setBottomTab("preview")}><Eye size={14} /> 미리보기</button>
                  <button className={bottomTab === "revisions" ? "active" : ""} onClick={() => setBottomTab("revisions")}><History size={14} /> 리비전 이력</button>
                  <button className={bottomTab === "downloads" ? "active" : ""} onClick={() => setBottomTab("downloads")}><Download size={14} /> 요청 이력</button>
                  <button className={bottomTab === "properties" ? "active" : ""} onClick={() => setBottomTab("properties")}><FileText size={14} /> 속성</button>
                </div>
              </div>
              <div className="pdm-signal-strip">
                <div className={`pdm-signal-card pdm-signal-${selected.drawing.status.toLowerCase()}`}>
                  <span>도면 상태</span>
                  <strong>{pdmStatusLabel(selected.drawing.status)}</strong>
                </div>
                <div className="pdm-signal-card">
                  <span>최신 리비전</span>
                  <strong>Rev {selected.drawing.currentRevisionLabel ?? "-"}</strong>
                </div>
                <div className="pdm-signal-card">
                  <span>리비전 이력</span>
                  <strong>{selected.revisions.length}건</strong>
                  {selectedOldRevisionCount > 0 && <em>구버전 {selectedOldRevisionCount}건</em>}
                </div>
                <div className="pdm-signal-card">
                  <span>반출 요청</span>
                  <strong>{selectedDownloads.length}건</strong>
                  <em>승인 {selectedApprovedDownloads} · 진행 {selectedOpenDownloads}</em>
                </div>
              </div>

              {bottomTab === "preview" && (
                <div className="pdm-preview-grid">
                  {selectedExtension === "pdf" && pdfPreviewUrl ? (
                    <iframe className="pdm-pdf-preview" src={pdfPreviewUrl} title="PDF preview" />
                  ) : (
                    <div className="pdm-cad-summary">
                      <FileText size={44} />
                      <strong>{selectedFileName || selected.drawing.title}</strong>
                      <span>{selectedExtension ? `${selectedExtension.toUpperCase()} 파일` : "파일 정보 없음"}</span>
                      <p>{pdfPreviewError || (selectedExtension === "pdf" ? "PDF 미리보기를 불러오는 중입니다." : "CAD 파일은 1차 범위에서 요약 정보로 표시합니다.")}</p>
                    </div>
                  )}
                  <div className="pdm-preview-side">
                    <div className="info-grid">
                      <span>도면번호</span><strong>{selected.drawing.drawingNo}</strong>
                      <span>최신 리비전</span><strong>{selected.drawing.currentRevisionLabel ?? "-"}</strong>
                      <span>상태</span><strong>{pdmStatusLabel(selected.drawing.status)}</strong>
                      <span>파일명</span><strong>{selectedFileName || "-"}</strong>
                    </div>
                    {selectedRevision && selectedExtension === "pdf" && (
                      <div className="pdm-actions">
                        <button className="ghost" onClick={() => openRevisionPdfViewer(selectedRevision.revisionId)}><Eye size={15} /> PDF 열람</button>
                      </div>
                    )}
                    {selected.permissions.canRequestDownload && selectedRevision && (
                      <div className="pdm-download-box">
                        <input value={downloadReason} onChange={(event) => setDownloadReason(event.target.value)} placeholder="다운로드 요청 사유" />
                        <select value={downloadApproverId} onChange={(event) => setDownloadApproverId(event.target.value)}>
                          <option value="">결재자 선택</option>
                          {approverOptions.map((employee) => <option key={employee.empId} value={employee.empId}>{employee.empName} · {employee.deptName ?? "-"}</option>)}
                        </select>
                        <button onClick={() => requestDownload(selectedRevision.revisionId)}><Download size={15} /> 최신본 다운로드 요청</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bottomTab === "revisions" && (
                <div className="pdm-revision-layout">
                  <div className="pdm-revision-list">
                    {selected.revisions.map((revision) => (
                      <div className={`file-row ${revision.latestYn === "Y" ? "latest" : "old"}`} key={revision.revisionId}>
                        <strong>Rev {revision.revisionLabel}</strong>
                        <span>순번 {revision.revisionOrder} · {revision.latestYn === "Y" ? "최신본" : "구버전"} · {revision.originalFileName ?? "-"}</span>
                        <div className="pdm-row-actions">
                          {fileExtension(revision.originalFileName ?? "") === "pdf" && (
                            <button className="ghost" onClick={() => openRevisionPdfViewer(revision.revisionId)}><Eye size={15} /> PDF 열람</button>
                          )}
                          {selected.permissions.canRequestDownload && (
                            <button className="ghost" onClick={() => requestDownload(revision.revisionId)}><Download size={15} /> 다운로드 요청</button>
                          )}
                          {selected.permissions.canRevise && (
                            <button className="ghost danger" onClick={() => void deleteRevision(revision)}><Trash2 size={15} /> 삭제</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selected.permissions.canRevise && (
                    <form className="pdm-revision-form" onSubmit={addRevision}>
                      <h3>새 리비전 등록</h3>
                      <input value={revisionLabel} onChange={(event) => setRevisionLabel(event.target.value)} placeholder="리비전 표기" />
                      <input type="file" accept=".pdf,.dwg,.dxf,.step,.stp,.igs,.iges" onChange={(event) => setRevisionFile(event.target.files?.[0] ?? null)} />
                      <button><Plus size={16} /> 리비전 추가</button>
                      <small>리비전 순서는 시스템이 자동으로 지정합니다.</small>
                    </form>
                  )}
                </div>
              )}

              {bottomTab === "downloads" && (
                <div className="pdm-request-list">
                  <div className="panel-head">
                    <h3>다운로드 요청 이력</h3>
                    <button className="ghost" onClick={loadDownloads}><RefreshCw size={16} /> 새로고침</button>
                  </div>
                  {selectedDownloads.length ? selectedDownloads.map((request) => (
                    <div className={`file-row pdm-request-${request.approvalStatus.toLowerCase()}`} key={request.requestId}>
                      <strong>{request.drawingNo} · Rev {request.revisionLabel}</strong>
                      <span><em className={`pdm-request-status pdm-request-status-${request.approvalStatus.toLowerCase()}`}>{approvalStatusLabel(request.approvalStatus)}</em> · 유효기한 {formatDate(request.approvedUntil)} · {request.reason}</span>
                      <div className="pdm-row-actions">
                        <button onClick={() => downloadRequest(request)} disabled={request.approvalStatus !== "APPROVED"}><Download size={15} /> 다운로드</button>
                      </div>
                    </div>
                  )) : <Empty text="이 도면의 다운로드 요청 이력이 없습니다." />}
                </div>
              )}

              {bottomTab === "properties" && (
                <div className="info-grid pdm-properties">
                  <span>구분</span><strong>{selected.drawing.category === "PRODUCT" ? "제품도면" : "설비도면"}</strong>
                  <span>업체</span><strong>{selected.drawing.companyName ?? "-"}</strong>
                  <span>프로젝트/제품</span><strong>{selected.drawing.projectName ?? "-"}</strong>
                  <span>사업부</span><strong>{selected.drawing.businessUnit ?? "-"}</strong>
                  <span>공정</span><strong>{selected.drawing.processName ?? "-"}</strong>
                  <span>설비/공통</span><strong>{selected.drawing.equipmentName ?? selected.drawing.groupName ?? "-"}</strong>
                  <span>상태</span><strong>{pdmStatusLabel(selected.drawing.status)}</strong>
                  <span>메모</span><strong>{selected.drawing.description ?? "-"}</strong>
                </div>
              )}
            </>
          ) : bottomTab === "downloads" ? (
            <div className="pdm-request-list">
              <div className="panel-head">
                <h3>내 다운로드 요청</h3>
                <button className="ghost" onClick={loadDownloads}><RefreshCw size={16} /> 새로고침</button>
              </div>
              {selectedDownloads.length ? selectedDownloads.map((request) => (
                <div className={`file-row pdm-request-${request.approvalStatus.toLowerCase()}`} key={request.requestId}>
                  <strong>{request.drawingNo} · Rev {request.revisionLabel}</strong>
                  <span><em className={`pdm-request-status pdm-request-status-${request.approvalStatus.toLowerCase()}`}>{approvalStatusLabel(request.approvalStatus)}</em> · 유효기한 {formatDate(request.approvedUntil)} · {request.reason}</span>
                  <div className="pdm-row-actions">
                    <button onClick={() => downloadRequest(request)} disabled={request.approvalStatus !== "APPROVED"}><Download size={15} /> 다운로드</button>
                  </div>
                </div>
              )) : <Empty text="내 다운로드 요청 이력이 없습니다." />}
            </div>
          ) : <Empty text="중앙 목록에서 도면을 선택하면 미리보기와 이력을 확인할 수 있습니다." />}
        </div>
      </div>

      <DrawingManagementModals
        {...{ uploadOpen, folderOpen, folderEditOpen, statusOpen, adminOpen, selected, uploadForm, uploadFile, folderForm, statusForm, canManagePdmPermissions, canAdmin, permissionTargetMode, permissionForm, productCompanyOptions, flatDepartments, assignableEmployees, departmentPermissionCount, personalPermissionCount, permissionKeyword, permissionEmployeeFilter, permissionListFilter, filteredPermissions, setUploadOpen, setFolderOpen, setFolderEditOpen, setStatusOpen, setAdminOpen, setUploadForm, setUploadFile, setFolderForm, setStatusForm, setPermissionTargetMode, setPermissionForm, setPermissionKeyword, setPermissionEmployeeFilter, setPermissionListFilter, checkDuplicate, uploadDrawing, saveFolder, saveFolderRename, saveDrawingStatus, savePermission }}
      />
    </section>
  );

}
