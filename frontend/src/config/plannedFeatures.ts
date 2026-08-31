export type PlannedFeatureDefinition = {
  code: string;
  name: string;
  purpose: string;
  targetUsers: string[];
  expectedScreens: string[];
  expectedPermissions: string[];
  relatedFeatures: string[];
  apiDbWork: string[];
  status: "RESEARCH" | "DESIGN" | "READY";
  priority: "HIGH" | "MEDIUM" | "LOW";
  remoteReference: string;
};

export const plannedFeatures: Record<string, PlannedFeatureDefinition> = {
  PDM: {
    code: "PDM",
    name: "도면관리",
    purpose: "도면의 등록, 개정, 열람, 다운로드 승인 이력을 한 흐름으로 관리합니다.",
    targetUsers: ["설계·생산기술 담당자", "도면 승인자", "열람 권한이 부여된 임직원"],
    expectedScreens: ["도면 폴더 탐색", "도면 상세·개정 이력", "등록·개정 요청", "다운로드 승인함"],
    expectedPermissions: ["도면 분류별 열람", "등록·개정", "다운로드 요청", "다운로드 승인"],
    relatedFeatures: ["전자결재", "통합검색", "첨부파일 보안", "감사 로그"],
    apiDbWork: ["도면 분류·문서·개정 스키마 검토", "파일 권한·워터마크 정책", "결재 연계 API", "검색 인덱스와 감사 이벤트"],
    status: "DESIGN",
    priority: "MEDIUM",
    remoteReference: "feature/cmms-priority-menus의 도면 메뉴 구조와 탐색 경험"
  },
  EQUIPMENT: {
    code: "EQUIPMENT",
    name: "설비관리",
    purpose: "설비 기준정보와 이상 발생, 배정, 조치 완료, 결재 이력을 연결합니다.",
    targetUsers: ["생산·보전 담당자", "조치 배정자", "완료 승인자"],
    expectedScreens: ["설비 목록·상세", "이상 발생 등록", "작업 배정", "조치 완료·승인", "설비 이력"],
    expectedPermissions: ["설비 열람", "이상 등록", "작업 배정", "완료 승인", "기준정보 관리"],
    relatedFeatures: ["전자결재", "조직도", "알림", "통합검색", "감사 로그"],
    apiDbWork: ["설비 마스터 정합성 검토", "이상·배정·완료 상태 모델", "결재·알림 연계", "설비별 이력 조회 API"],
    status: "RESEARCH",
    priority: "MEDIUM",
    remoteReference: "feature/cmms-priority-menus의 CMMS 메뉴 분류와 관리 화면 흐름"
  }
};
