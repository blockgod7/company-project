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

export type DrawingManagementModalsProps = {
  uploadOpen: boolean;
  folderOpen: boolean;
  folderEditOpen: boolean;
  statusOpen: boolean;
  adminOpen: boolean;
  selected: PdmDrawingDetail | null;
  uploadForm: PdmUploadForm;
  uploadFile: File | null;
  folderForm: PdmFolderForm;
  statusForm: PdmDrawing["status"];
  canManagePdmPermissions: boolean;
  canAdmin: boolean;
  permissionTargetMode: "DEPT" | "EMP";
  permissionForm: any;
  productCompanyOptions: string[];
  flatDepartments: { deptId: number; deptName: string }[];
  assignableEmployees: Employee[];
  departmentPermissionCount: number;
  personalPermissionCount: number;
  permissionKeyword: string;
  permissionEmployeeFilter: string;
  permissionListFilter: "ALL" | "DEPT" | "EMP";
  filteredPermissions: PdmPermissionAdmin[];
  setUploadOpen: (value: boolean) => void;
  setFolderOpen: (value: boolean) => void;
  setFolderEditOpen: (value: boolean) => void;
  setStatusOpen: (value: boolean) => void;
  setAdminOpen: (value: boolean) => void;
  setUploadForm: (value: PdmUploadForm) => void;
  setUploadFile: (value: File | null) => void;
  setFolderForm: (value: PdmFolderForm) => void;
  setStatusForm: (value: PdmDrawing["status"]) => void;
  setPermissionTargetMode: (value: "DEPT" | "EMP") => void;
  setPermissionForm: (value: any) => void;
  setPermissionKeyword: (value: string) => void;
  setPermissionEmployeeFilter: (value: string) => void;
  setPermissionListFilter: (value: "ALL" | "DEPT" | "EMP") => void;
  checkDuplicate: () => void;
  uploadDrawing: (event: FormEvent) => void;
  saveFolder: (event: FormEvent) => void;
  saveFolderRename: (event: FormEvent) => void;
  saveDrawingStatus: (event: FormEvent) => void;
  savePermission: (event: FormEvent) => void;
};

function requiredLabel(label: string) {
  return (
    <span className="pdm-required-label">
      {label}
      <em>필수 입력</em>
    </span>
  );
}

export function DrawingManagementModals(props: DrawingManagementModalsProps) {
  const { uploadOpen, folderOpen, folderEditOpen, statusOpen, adminOpen, selected, uploadForm, folderForm, statusForm, canManagePdmPermissions, canAdmin, permissionTargetMode, permissionForm, productCompanyOptions, flatDepartments, assignableEmployees, departmentPermissionCount, personalPermissionCount, permissionKeyword, permissionEmployeeFilter, permissionListFilter, filteredPermissions, setUploadOpen, setFolderOpen, setFolderEditOpen, setStatusOpen, setAdminOpen, setUploadForm, setUploadFile, setFolderForm, setStatusForm, setPermissionTargetMode, setPermissionForm, setPermissionKeyword, setPermissionEmployeeFilter, setPermissionListFilter, checkDuplicate, uploadDrawing, saveFolder, saveFolderRename, saveDrawingStatus, savePermission } = props;
  return <>
      {uploadOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="pdm-upload-modal pdm-file-modal" onSubmit={uploadDrawing} role="dialog" aria-modal="true" aria-label="도면 파일 등록">
            <div className="modal-head">
              <h3>도면 파일 등록</h3>
              <button type="button" className="icon-button" onClick={() => setUploadOpen(false)}><X size={18} /></button>
            </div>
            <div className="pdm-file-fields">
              <fieldset>
                <legend>기본 정보</legend>
                <label>
                  {requiredLabel("도면 구분")}
                  <select required value={uploadForm.category} onChange={(event) => setUploadForm({ ...uploadForm, category: event.target.value as "PRODUCT" | "EQUIPMENT" })}>
                    <option value="PRODUCT">제품도면</option>
                    <option value="EQUIPMENT">설비도면</option>
                  </select>
                </label>
                <label>
                  {requiredLabel("도면번호")}
                  <input required value={uploadForm.drawingNo} onBlur={checkDuplicate} onChange={(event) => setUploadForm({ ...uploadForm, drawingNo: event.target.value })} placeholder="도면번호" />
                </label>
                <label className="wide">
                  {requiredLabel("도면명")}
                  <input required value={uploadForm.title} onChange={(event) => setUploadForm({ ...uploadForm, title: event.target.value })} placeholder="도면명" />
                </label>
              </fieldset>
              <fieldset>
                <legend>분류 위치</legend>
                {uploadForm.category === "PRODUCT" ? (
                  <>
                    <label>
                      {requiredLabel("업체명")}
                      <input required value={uploadForm.companyName} onChange={(event) => setUploadForm({ ...uploadForm, companyName: event.target.value })} placeholder="업체명" />
                    </label>
                    <label>
                      {requiredLabel("프로젝트/제품명")}
                      <input required value={uploadForm.projectName} onChange={(event) => setUploadForm({ ...uploadForm, projectName: event.target.value })} placeholder="프로젝트/제품명" />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      {requiredLabel("사업부")}
                      <input required value={uploadForm.businessUnit} onChange={(event) => setUploadForm({ ...uploadForm, businessUnit: event.target.value })} placeholder="사업부" />
                    </label>
                    <label>
                      {requiredLabel("공정")}
                      <input required value={uploadForm.processName} onChange={(event) => setUploadForm({ ...uploadForm, processName: event.target.value })} placeholder="공정" />
                    </label>
                    <label>
                      <span className="pdm-required-label">공통도면 폴더<em>둘 중 하나 필수</em></span>
                      <input value={uploadForm.groupName} onChange={(event) => setUploadForm({ ...uploadForm, groupName: event.target.value })} placeholder="공통도면 폴더" />
                    </label>
                    <label>
                      <span className="pdm-required-label">설비명<em>둘 중 하나 필수</em></span>
                      <input value={uploadForm.equipmentName} onChange={(event) => setUploadForm({ ...uploadForm, equipmentName: event.target.value })} placeholder="설비명" />
                    </label>
                  </>
                )}
              </fieldset>
              <fieldset>
                <legend>리비전 및 파일</legend>
                <label>
                  {requiredLabel("리비전 표기")}
                  <input required value={uploadForm.revisionLabel} onChange={(event) => setUploadForm({ ...uploadForm, revisionLabel: event.target.value })} placeholder="A, B, 1, 2 등" />
                </label>
                <label>
                  <span>도면 상태</span>
                  <select value={uploadForm.status} onChange={(event) => setUploadForm({ ...uploadForm, status: event.target.value as PdmUploadForm["status"] })}>
                    <option value="ACTIVE">사용중</option>
                    <option value="ON_HOLD">보류</option>
                    <option value="VOIDED">폐기/무효</option>
                  </select>
                </label>
                <label className="wide">
                  {requiredLabel("도면 파일")}
                  <input required type="file" accept=".pdf,.dwg,.dxf,.step,.stp,.igs,.iges" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
                </label>
              </fieldset>
              <fieldset>
                <legend>메모</legend>
                <label>
                  <span>변경/접수 메모</span>
                  <textarea value={uploadForm.changeNote} onChange={(event) => setUploadForm({ ...uploadForm, changeNote: event.target.value })} placeholder="변경/접수 메모" />
                </label>
                <label>
                  <span>도면 설명</span>
                  <textarea value={uploadForm.description} onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })} placeholder="도면 설명" />
                </label>
              </fieldset>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setUploadOpen(false)}>취소</button>
              <button><Save size={16} /> 등록</button>
            </div>
          </form>
        </div>
      )}

      {folderOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="pdm-upload-modal pdm-folder-modal" onSubmit={saveFolder} role="dialog" aria-modal="true" aria-label="도면 폴더 추가">
            <div className="modal-head">
              <h3>도면 폴더 추가</h3>
              <button type="button" className="icon-button" onClick={() => setFolderOpen(false)}><X size={18} /></button>
            </div>
            <div className="pdm-folder-fields">
              <label className="pdm-folder-field">
                <span>도면 구분</span>
                <select value={folderForm.category} onChange={(event) => {
                  const nextCategory = event.target.value as "PRODUCT" | "EQUIPMENT";
                  setFolderForm({ ...DEFAULT_PDM_FOLDER_FORM, category: nextCategory, folderKind: nextCategory === "PRODUCT" ? "COMPANY" : "BUSINESS" });
                }}>
                  <option value="PRODUCT">제품도면</option>
                  <option value="EQUIPMENT">설비도면</option>
                </select>
              </label>
              {folderForm.category === "PRODUCT" ? (
                <>
                  <label className="pdm-folder-field">
                    <span>추가 위치</span>
                    <select value={folderForm.folderKind} onChange={(event) => setFolderForm({ ...folderForm, folderKind: event.target.value as PdmFolder["folderKind"] })}>
                      <option value="COMPANY">업체 폴더</option>
                      <option value="PROJECT">프로젝트/제품 폴더</option>
                    </select>
                  </label>
                  {folderForm.folderKind === "PROJECT" && (
                    <label className="pdm-folder-field">
                      <span>상위 업체</span>
                      <select value={folderForm.companyName} onChange={(event) => setFolderForm({ ...folderForm, companyName: event.target.value })}>
                        <option value="">상위 업체 선택</option>
                        {productCompanyOptions.map((companyName) => <option key={companyName} value={companyName}>{companyName}</option>)}
                      </select>
                    </label>
                  )}
                  {folderForm.folderKind === "PROJECT" && !productCompanyOptions.length && <small className="pdm-folder-help">업체 폴더를 먼저 추가하거나 제품도면을 등록하면 선택할 수 있습니다.</small>}
                  <label className="pdm-folder-field wide">
                    <span>{folderForm.folderKind === "COMPANY" ? "업체명" : "프로젝트/제품명"}</span>
                    <input value={folderForm.folderName} onChange={(event) => setFolderForm({ ...folderForm, folderName: event.target.value })} placeholder={folderForm.folderKind === "COMPANY" ? "업체명을 입력하세요" : "프로젝트/제품명을 입력하세요"} />
                  </label>
                </>
              ) : (
                <>
                  <label className="pdm-folder-field">
                    <span>추가 위치</span>
                    <select value={folderForm.folderKind} onChange={(event) => setFolderForm({ ...folderForm, folderKind: event.target.value as PdmFolder["folderKind"] })}>
                      <option value="BUSINESS">사업부 폴더</option>
                      <option value="PROCESS">공정 폴더</option>
                      <option value="COMMON">공통도면 폴더</option>
                      <option value="EQUIPMENT">설비 폴더</option>
                    </select>
                  </label>
                  {folderForm.folderKind !== "BUSINESS" && (
                    <label className="pdm-folder-field">
                      <span>상위 사업부</span>
                      <input value={folderForm.businessUnit} onChange={(event) => setFolderForm({ ...folderForm, businessUnit: event.target.value })} placeholder="상위 사업부" />
                    </label>
                  )}
                  {(folderForm.folderKind === "COMMON" || folderForm.folderKind === "EQUIPMENT") && (
                    <label className="pdm-folder-field">
                      <span>상위 공정</span>
                      <input value={folderForm.processName} onChange={(event) => setFolderForm({ ...folderForm, processName: event.target.value })} placeholder="상위 공정" />
                    </label>
                  )}
                  <label className="pdm-folder-field wide">
                    <span>추가할 폴더명</span>
                    <input value={folderForm.folderName} onChange={(event) => setFolderForm({ ...folderForm, folderName: event.target.value })} placeholder="추가할 폴더명" />
                  </label>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setFolderOpen(false)}>취소</button>
              <button><Save size={16} /> 추가</button>
            </div>
          </form>
        </div>
      )}

      {folderEditOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="pdm-upload-modal" onSubmit={saveFolderRename} role="dialog" aria-modal="true" aria-label="폴더명 수정">
            <div className="modal-head">
              <h3>폴더명 수정</h3>
              <button type="button" className="icon-button" onClick={() => setFolderEditOpen(false)}><X size={18} /></button>
            </div>
            <div className="form-grid compact">
              <input value={folderForm.folderName} onChange={(event) => setFolderForm({ ...folderForm, folderName: event.target.value })} placeholder="폴더명" />
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setFolderEditOpen(false)}>취소</button>
              <button><Save size={16} /> 저장</button>
            </div>
          </form>
        </div>
      )}

      {statusOpen && selected && (
        <div className="modal-backdrop" role="presentation">
          <form className="pdm-upload-modal" onSubmit={saveDrawingStatus} role="dialog" aria-modal="true" aria-label="도면 상태 변경">
            <div className="modal-head">
              <h3>도면 상태 변경</h3>
              <button type="button" className="icon-button" onClick={() => setStatusOpen(false)}><X size={18} /></button>
            </div>
            <label>도면번호
              <input value={selected.drawing.drawingNo} readOnly />
            </label>
            <label>현재 상태
              <select value={statusForm} onChange={(event) => setStatusForm(event.target.value as PdmDrawing["status"])}>
                <option value="ACTIVE">사용중</option>
                <option value="OLD_VERSION">구버전</option>
                <option value="ON_HOLD">보류</option>
                <option value="VOIDED">폐기/무효</option>
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setStatusOpen(false)}>취소</button>
              <button><Save size={16} /> 저장</button>
            </div>
          </form>
        </div>
      )}

      {adminOpen && canManagePdmPermissions && (
        <div className="modal-backdrop" role="presentation">
          <div className="pdm-admin-modal" role="dialog" aria-modal="true" aria-label="도면 권한 관리">
            <div className="modal-head">
              <h3>{canAdmin ? "도면 권한 관리" : "우리 부서 권한"}</h3>
              <button type="button" className="icon-button" onClick={() => setAdminOpen(false)}><X size={18} /></button>
            </div>
            <div className="pdm-admin-layout">
              <form className="form-grid compact" onSubmit={savePermission}>
                {canAdmin ? (
                  <div className="pdm-permission-mode" aria-label="권한 대상 유형">
                    <button
                      type="button"
                      className={permissionTargetMode === "DEPT" ? "active" : ""}
                      onClick={() => {
                        setPermissionTargetMode("DEPT");
                        setPermissionForm({ ...permissionForm, empId: "" });
                      }}
                    >
                      부서 권한 범위
                    </button>
                    <button
                      type="button"
                      className={permissionTargetMode === "EMP" ? "active" : ""}
                      onClick={() => {
                        setPermissionTargetMode("EMP");
                        setPermissionForm({ ...permissionForm, deptId: "" });
                      }}
                    >
                      직원 권한 배정
                    </button>
                  </div>
                ) : (
                  <div className="pdm-permission-mode single" aria-label="권한 대상 유형">
                    <button type="button" className="active">직원 권한 배정</button>
                  </div>
                )}
                <div className="pdm-permission-note">
                  <strong>{canAdmin && permissionTargetMode === "DEPT" ? "부서가 가질 수 있는 최대 권한" : "직원이 실제로 사용할 권한"}</strong>
                  <span>{canAdmin && permissionTargetMode === "DEPT" ? "관리자가 부서별 허용 범위를 정하면, 부서장은 이 범위 안에서 직원에게 권한을 배정합니다." : "부서에 허용된 권한 안에서 특정 직원이 실제로 사용할 권한을 지정합니다."}</span>
                </div>
                <select value={permissionForm.category} onChange={(event) => setPermissionForm({ ...permissionForm, category: event.target.value })}>
                  <option value="">전체 구분</option>
                  <option value="PRODUCT">제품도면</option>
                  <option value="EQUIPMENT">설비도면</option>
                </select>
                {canAdmin && permissionTargetMode === "DEPT" ? (
                  <select value={permissionForm.deptId} onChange={(event) => setPermissionForm({ ...permissionForm, deptId: event.target.value })}>
                    <option value="">부서 선택</option>
                    {flatDepartments.map((dept) => <option key={dept.deptId} value={dept.deptId}>{dept.deptName}</option>)}
                  </select>
                ) : (
                  <select value={permissionForm.empId} onChange={(event) => setPermissionForm({ ...permissionForm, empId: event.target.value })}>
                    <option value="">사용자 선택</option>
                    {assignableEmployees.map((employee) => <option key={employee.empId} value={employee.empId}>{employee.empName} · {employee.deptName ?? "-"}</option>)}
                  </select>
                )}
                <div className="pdm-permission-checks" aria-label="권한 항목">
                  {(["canRegister", "canRevise", "canView", "canDownloadRequest", "canDownloadApprove"] as const).map((key) => (
                    <label className="check-line" key={key}>
                      <input type="checkbox" checked={permissionForm[key]} onChange={(event) => setPermissionForm({ ...permissionForm, [key]: event.target.checked })} />
                      <span>{pdmPermissionLabel(key)}</span>
                    </label>
                  ))}
                </div>
                <button className="pdm-permission-save"><Save size={16} /> 저장</button>
              </form>
              <div className="pdm-permission-workbench">
                <div className="pdm-permission-summary">
                  <div>
                    <strong>{departmentPermissionCount}</strong>
                    <span>부서 권한 범위</span>
                  </div>
                  <div>
                    <strong>{personalPermissionCount}</strong>
                    <span>직원 권한 배정</span>
                  </div>
                  <div className="muted">
                    <strong>다음</strong>
                    <span>권한 요청/승인</span>
                  </div>
                </div>
                <div className="pdm-role-group-preview">
                  <strong>추가 권한은 승인 절차로 처리</strong>
                  <span>직원이 부서 범위를 넘는 권한을 요청하면 부서장 또는 관리자가 승인한 뒤 반영합니다.</span>
                </div>
                <div className="pdm-permission-toolbar">
                  <input value={permissionKeyword} onChange={(event) => setPermissionKeyword(event.target.value)} placeholder="부서, 직원, 권한 검색" />
                  <select value={permissionEmployeeFilter} onChange={(event) => {
                    const nextEmployeeId = event.target.value;
                    setPermissionEmployeeFilter(nextEmployeeId);
                    if (nextEmployeeId) setPermissionListFilter("EMP");
                  }}>
                    <option value="">직원 전체</option>
                    {assignableEmployees.map((employee) => (
                      <option key={employee.empId} value={employee.empId}>{employee.empName} · {employee.deptName ?? "-"}</option>
                    ))}
                  </select>
                  <select value={permissionListFilter} onChange={(event) => {
                    const nextFilter = event.target.value as "ALL" | "DEPT" | "EMP";
                    setPermissionListFilter(nextFilter);
                    if (nextFilter === "DEPT") setPermissionEmployeeFilter("");
                  }}>
                    <option value="ALL">전체</option>
                    <option value="DEPT">부서 권한 범위</option>
                    <option value="EMP">직원 권한 배정</option>
                  </select>
                </div>
                {filteredPermissions.length ? (
                  <div className="pdm-permission-table">
                    <div className="pdm-permission-row head">
                      <span>대상</span>
                      <span>유형</span>
                      <span>범위</span>
                      <span>등록</span>
                      <span>개정</span>
                      <span>조회</span>
                      <span>반출요청</span>
                      <span>반출승인</span>
                    </div>
                    {filteredPermissions.map((permission) => (
                      <div className="pdm-permission-row" key={permission.permissionId}>
                        <strong>{permission.empName ?? permission.deptName ?? "-"}</strong>
                        <span>{pdmPermissionTargetKindLabel(permission)}</span>
                        <span>{pdmPermissionScopeLabel(permission.category)}</span>
                        <span>{pdmPermissionMark(permission.canRegister)}</span>
                        <span>{pdmPermissionMark(permission.canRevise)}</span>
                        <span>{pdmPermissionMark(permission.canView)}</span>
                        <span>{pdmPermissionMark(permission.canDownloadRequest)}</span>
                        <span>{pdmPermissionMark(permission.canDownloadApprove)}</span>
                      </div>
                    ))}
                  </div>
                ) : <Empty text="조건에 맞는 도면 권한이 없습니다." />}
              </div>
            </div>
          </div>
        </div>
      )}
  </>;
}
