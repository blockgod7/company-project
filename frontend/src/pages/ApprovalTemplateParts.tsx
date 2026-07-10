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
  Flag,
  History,
  Inbox,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { api, authenticatedFetch, jsonBody } from "../api";
import schunkLogo from "../assets/schunk-carbon-logo.png";
import { ApprovalListTable, ApprovalRetentionAuditTable, DeletedApprovalListTable } from "../components/ApprovalTables";
import { CardHeader } from "../components/CardHeader";
import { AttachmentBox, DraftAttachmentPicker, EditorHeader, EditorTools, ReadDetail, RichContent } from "../components/ContentTools";
import { ApprovalLineTableEditor, EmployeeMultiPicker } from "../components/EmployeePickers";
import { Empty, EmptyDetail } from "../components/Empty";
import { DetailPage, ListSummary, Toolbar, TwoPane } from "../components/PageLayout";
import { uploadAttachments } from "../utils/attachments";
import type { DraftAttachment } from "../utils/attachments";
import {
  approvalProgress,
  delegatedActionText,
  documentPrefix,
  isDelegatedAction,
  lineActedName,
  lineAssignedName,
  lineDueText,
  lineStatusLabel,
  lineTypeLabel,
  priorityLabel,
  receiverProgress,
  retentionAuditActionLabel,
  stageLabel,
  statusLabel,
  templateName
} from "../utils/approvalLabels";
import {
  approvalContent,
  approvalDraftData,
  approvalLinePerson,
  approvalOpinionLines,
  approvalTemplateByCode,
  APPROVAL_TEMPLATE_CATEGORIES,
  blankMoldFixturePart,
  blankPurchaseItem,
  categorizedTemplateGroups,
  currentUserDeptName,
  DEFAULT_APPROVAL_SEARCH,
  DEFAULT_APPROVAL_TEMPLATES,
  DEFAULT_TOTAL_ANNUAL_DAYS,
  defaultApprovalForm,
  defaultDelegationForm,
  defaultLineIds,
  defaultLinePayload,
  defaultOperationSettingsForm,
  employeeDisplay,
  employeesByIds,
  ENABLE_TEMPLATE_FALLBACK,
  equipmentProposalCapacityLabel,
  equipmentProposalGeneratedTitle,
  equipmentProposalItemFallback,
  equipmentProposalItemLabel,
  equipmentProposalTitle,
  firstReceiverLineOrder,
  firstSelectableApprovalTemplate,
  formatApprovalLines,
  formatDayValue,
  formatEmployeeList,
  formatShortDate,
  idsFromJson,
  isDeptManagerUser,
  isDraftTemplateCode,
  isEquipmentProposalTemplateCode,
  isLeaveCancelTemplateCode,
  isLeaveTemplateCode,
  isMoldFixtureTemplateCode,
  isPurchaseTemplateCode,
  isReceiverRoutedTemplateCode,
  isRequiredTemplateField,
  isTrainingReportTemplateCode,
  isTrainingRequestTemplateCode,
  isTrainingTemplateCode,
  KOREAN_PUBLIC_HOLIDAYS,
  lastReceiverLineOrder,
  LEAVE_TYPE_OPTIONS,
  leaveCancelContent,
  leaveDateRangeText,
  leaveDayValue,
  leaveRequestContent,
  leaveSummary,
  leaveUsageFieldValues,
  localDateKey,
  moldFixturePartsJson,
  normalizeMoldFixtureParts,
  normalizePurchaseItems,
  parseLeaveSelections,
  parseMoldFixtureParts,
  parsePurchaseItems,
  parseTemplateFields,
  productionEngineeringManagerId,
  PURCHASE_BU_CODES,
  PURCHASE_RECEIVER_LOGIN_ID,
  purchaseBuTotal,
  purchaseDefaultFieldValues,
  purchaseItemsJson,
  purchaseReceiptDate,
  purchaseReceiverId,
  purchaseRequestContent,
  remainingAnnualDaysText,
  selectableApprovalTemplates,
  templateAdminFormFromOption,
  templateOptionFromApi,
  todayDate,
  TRAINING_RECEIVER_LOGIN_ID,
  trainingReceiverId,
  trainingReportContent,
  trainingReportDefaultFieldValues,
  trainingRequestClosingText,
  trainingRequestContent,
  trainingRequestDefaultFieldValues,
  validatePurchaseRequest,
  validateTrainingReport,
  validateTrainingRequest,
  withLeaveCancelTemplate
} from "../utils/approvalDomain";
import type {
  ApprovalBox,
  ApprovalBoxApi,
  ApprovalCategory,
  ApprovalDashboardFilter,
  ApprovalDelegationForm,
  ApprovalForm,
  ApprovalLaunch,
  ApprovalOperationSettingsForm,
  ApprovalSearchForm,
  ApprovalTemplateAdminForm,
  ApprovalTemplateCategory,
  ApprovalTemplateField,
  ApprovalTemplateOption,
  ContentMode,
  LeaveSelection,
  MoldFixturePart,
  PurchaseRequestItem
} from "../utils/approvalDomain";
import { formatDate } from "../utils/date";
import type { GlobalSearchTarget } from "../utils/search";
import type {
  Approval,
  ApprovalDelegationApi,
  ApprovalDefaultLineApi,
  ApprovalDefaultLineStepApi,
  ApprovalLine,
  ApprovalOperationSettings,
  ApprovalSummary,
  ApprovalTemplateApi,
  AuditLog,
  Employee,
  EquipmentProposal,
  LeaveUsage,
  PageResponse,
  User
} from "../types";
export const APPROVAL_BOXES: { box: ApprovalBox; label: string }[] = [
  { box: "agreement", label: "합의대기" },
  { box: "pending", label: "결재대기" },
  { box: "received", label: "수신문서" },
  { box: "shared", label: "참조/연람" },
  { box: "requested", label: "기안문서" },
  { box: "processed", label: "처리문서" },
  { box: "all", label: "전체문서" }
];

export function isApprovalBox(value: string): value is ApprovalBox {
  return APPROVAL_BOXES.some((item) => item.box === value);
}

export function TemplateSelectModalV2({ templates, selected, fallbackActive, previewDeptName, previewRequesterName, onSelect, onCancel, onConfirm }: {
  templates: ApprovalTemplateOption[];
  selected: ApprovalTemplateOption;
  fallbackActive: boolean;
  previewDeptName: string;
  previewRequesterName: string;
  onSelect: (template: ApprovalTemplateOption) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    const initial = categorizedTemplateGroups(templates).find((category) => category.templates.some((template) => template.code === selected.code));
    return initial?.id ?? APPROVAL_TEMPLATE_CATEGORIES[0].id;
  });
  const [keyword, setKeyword] = useState("");
  const groups = categorizedTemplateGroups(templates);
  const activeCategory = groups.find((category) => category.id === selectedCategoryId) ?? groups[0];
  const filteredTemplates = (activeCategory?.templates ?? []).filter((template) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return true;
    return template.name.toLowerCase().includes(normalizedKeyword)
      || template.code.toLowerCase().includes(normalizedKeyword)
      || template.description.toLowerCase().includes(normalizedKeyword);
  });

  function selectCategory(category: ReturnType<typeof categorizedTemplateGroups>[number]) {
    setSelectedCategoryId(category.id);
    const firstMatched = category.templates.find((template) => template.code === selected.code) ?? category.templates[0];
    if (firstMatched) onSelect(firstMatched);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="template-select-modal template-select-modal-v2" role="dialog" aria-modal="true" aria-label="양식 선택">
        <div className="modal-head">
          <h3>양식선택</h3>
          <button type="button" className="icon-button" onClick={onCancel} title="닫기"><X size={18} /></button>
        </div>
        <div className="template-select-toolbar">
          <label>
            <span>양식명</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="검색어 입력" />
          </label>
          <button type="button" className="ghost" onClick={() => setKeyword("")}>초기화</button>
        </div>
        <div className="template-select-layout">
          <div className="template-category-list">
            <h3>양식함</h3>
            {fallbackActive && <p className="template-fallback-note">개발용 임시 목록</p>}
            {groups.map((category) => (
              <button type="button" key={category.id} className={activeCategory?.id === category.id ? "active" : ""} onClick={() => selectCategory(category)}>
                <span className="template-folder-icon" aria-hidden="true">▣</span>
                <strong>{category.label}</strong>
                <span>{category.templates.length}</span>
              </button>
            ))}
          </div>
          <div className="template-choice-panel">
            <div className="template-choice-list">
              <h3>양식리스트</h3>
              {filteredTemplates.length ? filteredTemplates.map((template) => (
                <button type="button" key={template.code} className={selected.code === template.code ? "active" : ""} onClick={() => onSelect(template)}>
                  <strong>{template.name}</strong>
                  <span>{template.code} v{template.version ?? 1}</span>
                </button>
              )) : <Empty text="표시할 양식이 없습니다." />}
              <div className="template-description-box">
                <strong>양식설명</strong>
                <span>{selected.description || "등록된 설명이 없습니다."}</span>
              </div>
            </div>
            <div className="template-preview">
              <h3>양식 미리보기</h3>
              <TemplatePaperPreview template={selected} previewDeptName={previewDeptName} previewRequesterName={previewRequesterName} />
              {!isReceiverRoutedTemplateCode(selected.code) && <div className="paper-preview legacy-template-summary">
                <h2>{selected.name} - 기안자명</h2>
                <div className="preview-grid">
                  <strong>기안부서</strong><span>{previewDeptName}</span>
                  <strong>기안자</strong><span>{previewRequesterName}</span>
                  <strong>문서번호</strong><span>상신 시 자동생성</span>
                  <strong>결재</strong><span>합의/결재자 표시</span>
                </div>
              </div>}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>취소</button>
          <button type="button" onClick={onConfirm} disabled={!selected}>확인</button>
        </div>
      </div>
    </div>
  );
}

function TemplatePaperPreview({ template, previewDeptName, previewRequesterName }: {
  template: ApprovalTemplateOption;
  previewDeptName: string;
  previewRequesterName: string;
}) {
  if (isPurchaseTemplateCode(template.code)) {
    return (
      <div className="template-paper template-purchase-preview">
        <div className="template-purchase-head">
          <TemplateMiniStamp label="결재" writer={previewRequesterName} />
          <h2>구매요구서</h2>
          <TemplateMiniStamp label="수신" writer="임나영" compact />
        </div>
        <div className="template-purchase-meta">
          <strong>부서명</strong><span>{previewDeptName}</span>
          <strong>성명</strong><span>{previewRequesterName}</span>
          <strong>청구일</strong><span>{todayDate()}</span>
          <strong>요구일</strong><span>작성자 입력</span>
          <strong>접수일</strong><span>수신 확인 시 자동 기입</span>
          <strong>입고일</strong><span>구매부서 입력</span>
          <strong>제목</strong><span className="wide">예: 구매요구서 - 안전장갑 외 3건 - 생산팀</span>
        </div>
        <div className="template-purchase-items">
          <span>품명</span><span>규격</span><span>수량</span><span>용도</span>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        <div className="template-purchase-bu-title">BU 비용분할 <b>합계 100%</b></div>
        <div className="template-purchase-bu">
          {PURCHASE_BU_CODES.map((code) => <span key={code}>{code}<br />%</span>)}
        </div>
        <div className="template-attachment">첨부&nbsp;&nbsp; 견적서 / 사양서 / 참고자료</div>
      </div>
    );
  }

  if (isTrainingRequestTemplateCode(template.code)) {
    return (
      <div className="template-paper template-training-preview">
        <div className="template-training-head">
          <TemplateMiniStamp label="신청부서" writer={previewRequesterName} />
          <h2>교육 신청서</h2>
          <TemplateMiniStamp label="주관부서" writer="" />
        </div>
        <div className="template-training-choice">수강(  ) 변경(  ) 불참(  )</div>
        <div className="template-training-meta">
          <strong>소속</strong><span>{previewDeptName}</span>
          <strong>직위</strong><span></span>
          <strong>성명</strong><span>{previewRequesterName}</span>
          <strong>교육명</strong><span></span>
          <strong>교육기관</strong><span></span>
          <strong>사유(구체적)</strong><span className="large"></span>
        </div>
        <div className="template-training-footer">
          <span>본인은 상기와 같이 교육의 수강(  ) 변경(  ) 불참(  ) 을 신청합니다.</span>
          <span>{todayDate()}</span>
        </div>
      </div>
    );
  }

  if (isTrainingReportTemplateCode(template.code)) {
    return (
      <div className="template-paper template-training-preview template-training-report-preview">
        <div className="template-training-head">
          <div></div>
          <h2>교육 훈련 보고서</h2>
          <TemplateMiniStamp label="결재" writer={previewRequesterName} />
        </div>
        <div className="template-training-meta">
          <strong>작성일</strong><span>{todayDate()}</span>
          <strong>사번</strong><span></span>
          <strong>성명</strong><span>{previewRequesterName}</span>
          <strong>교육명</strong><span></span>
          <strong>교육기관</strong><span></span>
          <strong>교육기간</strong><span></span>
          <strong>주요교육 내용</strong><span className="large"></span>
          <strong>업무수행 방안</strong><span className="large"></span>
          <strong>교육 소감</strong><span className="large"></span>
          <strong>차기에 받고 싶은 교육</strong><span className="large"></span>
          <strong>유효성 평가</strong><span></span>
          <strong>총무 인사카드기록 확인</strong><span></span>
        </div>
      </div>
    );
  }

  if (isLeaveTemplateCode(template.code) || isLeaveCancelTemplateCode(template.code)) {
    const cancelMode = isLeaveCancelTemplateCode(template.code);
    return (
      <div className="template-paper template-leave-preview">
        <h2>{cancelMode ? "휴가 취소계" : "휴가계 (연차, 반차, 교육 등)"}</h2>
        <div className="template-leave-stamps">
          <TemplateMiniStamp label="결재" writer={previewRequesterName} />
          <TemplateMiniStamp label="수신" writer="" />
        </div>
        <div className="template-leave-meta">
          <span>신청자 : {previewRequesterName}</span>
          <span>TEL :</span>
          <span>기 타 :</span>
          <span>부 서 : {previewDeptName}</span>
          <span>직 급 :</span>
          <span>신청일 : {todayDate()}</span>
        </div>
        <div className="template-leave-table">
          <strong>제 목</strong><span>{cancelMode ? "휴가 취소계" : "휴가계"} - {previewRequesterName}</span>
          <strong>{cancelMode ? "취소기간" : "신청기간"}</strong><span>YYYY-MM-DD ~ YYYY-MM-DD [ 0 일 ]</span>
          <strong>{cancelMode ? "취소구분" : "신청구분"}</strong><span>{cancelMode ? "최종 결재 완료된 휴가 날짜 선택" : "달력에서 날짜와 구분 선택"}</span>
          <strong>신청 전 연차사용 일수 / 총 연차일수</strong><span>0 / {DEFAULT_TOTAL_ANNUAL_DAYS} 일</span>
          <strong>신청 후 잔여 연차일수</strong><span>{DEFAULT_TOTAL_ANNUAL_DAYS} 일</span>
        </div>
      </div>
    );
  }

  if (isMoldFixtureTemplateCode(template.code)) {
    return (
      <div className="template-paper template-equipment-preview template-mold-preview">
        <div className="template-equipment-top">
          <TemplateMiniStamp label="사용부서" writer={previewRequesterName} />
          <div className="template-equipment-title">
            <strong>금형 치공구 품의서</strong>
            <span>작성일자: {todayDate()}</span>
          </div>
          <TemplateMiniStamp label="주관부서" writer="" />
        </div>
        <div className="template-mold-info">
          <strong>품목</strong><span>□ 금형&nbsp;&nbsp; □ 치공구</span>
          <strong>사용부서</strong><span>{previewDeptName}</span>
          <strong>제품(기종)명</strong><span></span>
          <strong>제작유형</strong><span>□ 고객지급&nbsp;&nbsp; □ 투자&nbsp;&nbsp; □ 설계 및 제작&nbsp;&nbsp; □ 구매&nbsp;&nbsp; □ 수리</span>
          <strong>사유</strong><span className="large"></span>
        </div>
        <div className="template-mold-parts">
          <strong>부품 정보</strong>
          <span>부품명</span><span>CAVITY</span><span>재질</span><span>수량</span><span>금형번호</span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div className="template-equipment-body">
          <div>요구사항</div><div>지시사항</div>
          <div>설계 의견</div><div>구매 의견</div>
        </div>
        <div className="template-attachment">첨부&nbsp;&nbsp; □ 분말금형기초자료&nbsp;&nbsp; □ 제품도면&nbsp;&nbsp; □ 부품도면&nbsp;&nbsp; □ 견적서</div>
      </div>
    );
  }

  if (isEquipmentProposalTemplateCode(template.code)) {
    const title = equipmentProposalTitle(template.code);
    return (
      <div className="template-paper template-equipment-preview">
        <div className="template-equipment-top">
          <TemplateMiniStamp label="사용부서" writer={previewRequesterName} />
          <div className="template-equipment-title">
            <strong>{title}</strong>
            <span>작성일 : {todayDate()}</span>
          </div>
          <TemplateMiniStamp label="주관부서" writer="" />
        </div>
        <div className="template-equipment-info">
          <strong>요청부서</strong><span>{previewDeptName}</span>
          <strong>완료요구일</strong><span></span>
          <strong className="type-label">구분</strong><span className="type-options">□구입 □제작 □개선<br />□수리 □매각 □폐기</span>
          <strong>{equipmentProposalItemLabel(template.code)}</strong><span></span>
          <strong>{equipmentProposalCapacityLabel(template.code)}</strong><span></span>
        </div>
        <div className="template-equipment-body">
          <div>현상</div><div>주관부서(PE) 의견</div>
          <div>요구사항</div><div>설계 의견</div>
          <div>지시 사항</div><div>구매 의견</div>
        </div>
        <div className="template-economic">
          <strong>경제성 검토</strong>
          <span>사용부서</span>
          <span>주관 부서</span>
        </div>
        <div className="template-attachment">첨부&nbsp;&nbsp; □ 계약서&nbsp;&nbsp; □ 견적서&nbsp;&nbsp; □ 도면&nbsp;&nbsp; □ 설비사양서</div>
      </div>
    );
  }

  return (
    <div className="template-paper template-draft-preview">
      <div className="template-draft-logo-wrap">
        <img src={schunkLogo} alt="SCHUNK" />
      </div>
      <h2>{template.name}</h2>
      <div className="template-draft-head">
        <div className="template-draft-info">
          <strong>문서번호</strong><span>상신 후 자동생성</span>
          <strong>기안부서(자)</strong><span>{previewDeptName} / {previewRequesterName}</span>
          <strong>기안일자</strong><span>{todayDate()}</span>
          <strong>제목</strong><span>{template.name}</span>
        </div>
        <div className="template-draft-stamp">
          <div>작성</div><div>검토</div><div>승인</div>
          <div>{previewRequesterName}</div><div></div><div></div>
        </div>
      </div>
      <div className="template-draft-body">본문</div>
      <div className="template-draft-footer">
        <span>수신</span><span>참조</span><span>열람</span><span>상태</span>
      </div>
    </div>
  );
}

function TemplateMiniStamp({ label, writer, compact = false }: { label: string; writer: string; compact?: boolean }) {
  return (
    <div className={`template-mini-stamp${compact ? " compact" : ""}`}>
      <div className="stamp-side">{label}</div>
      <div className="stamp-cell">작성</div>
      {!compact && <div className="stamp-cell">검토</div>}
      {!compact && <div className="stamp-cell">승인</div>}
      <div className="stamp-name">{writer}</div>
      {!compact && <div className="stamp-name"></div>}
      {!compact && <div className="stamp-name"></div>}
    </div>
  );
}
