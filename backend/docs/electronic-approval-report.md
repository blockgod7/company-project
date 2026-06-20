# 전자결재 구축 완료 보고서

작성일: 2026-06-20  
대상 시스템: CompanyProject Groupware 전자결재  
작성 목적: 전자결재 기능의 구축 범위, 운영 준비 상태, 검증 결과, 후속 과제를 정리한다.

## 1. 보고 요약

전자결재 모듈은 1차 운영 가능한 수준의 핵심 업무 흐름 구현을 완료했다. 문서 작성부터 제출, 승인, 반려, 회수, 취소, 재기안, 수신 처리, 완료 처리까지의 전자결재 생명주기를 지원하며, 템플릿 관리, 기본 결재선, 대리결재, 휴직/비활성 사용자 차단, 결재 기한, 지연 알림, 대시보드, PDF 생성, 첨부파일 권한, 보존 삭제, 복원, 감사 리포트까지 포함했다.

운영 설정은 DB와 관리자 화면에서 관리할 수 있도록 분리했으며, 배포 환경별로 결재 기한, 알림 주기, 삭제 보존 기간, 영구 삭제 허용 여부를 조정할 수 있다. 최종 검증 기준으로 백엔드 테스트, 패키징, 프론트엔드 빌드, 주요 API 스모크 테스트를 완료했다.

## 2. 추진 목표

전자결재 구축의 주요 목표는 다음과 같다.

- 사내 결재 문서를 시스템에서 작성, 제출, 승인, 보관할 수 있도록 한다.
- 결재자, 합의자, 수신자, 참조자, 열람자를 구분해 실제 업무 흐름에 맞는 권한을 제공한다.
- 관리자와 결재 운영 담당자가 템플릿, 기본 결재선, 운영 설정, 보존 정책을 관리할 수 있도록 한다.
- 대리결재, 휴직/비활성 사용자 검증, 기한 초과 알림 등 운영 중 발생 가능한 예외 상황을 시스템적으로 처리한다.
- 보존 삭제, 복원, 감사 기록, CSV 다운로드를 통해 결재 문서의 운영 추적성을 확보한다.

## 3. 구현 범위

### 3.1 결재 문서 생명주기

구현된 결재 문서 흐름은 다음과 같다.

- 임시저장
- 임시저장 문서 수정
- 제출
- 승인
- 반려
- 회수
- 취소
- 재기안
- 수신
- 수신 완료
- 최종 승인 PDF 생성 및 재생성

결재 액션은 통합 엔드포인트를 통해 처리할 수 있도록 정리했다.

```text
POST /api/v1/approvals/{id}/actions/{action}
```

지원 액션은 `approve`, `reject`, `withdraw`, `cancel`, `redraft`, `receive`, `complete-receipt`, `status-correction`, `regenerate-pdf`이다.

### 3.2 결재선 및 권한

전자결재는 결재 문서별 참여자의 역할에 따라 접근 권한을 제한한다.

- 기안자
- 결재자
- 합의자
- 수신자
- 참조자
- 열람자
- 대리결재자
- 관리자
- 감사 관리자

문서 조회, PDF 다운로드, 첨부파일 다운로드는 결재 문서 접근 권한과 연동된다. 일반 사용자는 본인이 관련된 결재 문서만 접근할 수 있고, 운영 관리자와 감사 관리자는 역할에 따라 전체 문서 조회 또는 운영 기능을 사용할 수 있다.

### 3.3 템플릿 및 기본 결재선

결재 템플릿과 기본 결재선 기능을 구현했다.

- 템플릿 목록 조회
- 템플릿 관리 목록 조회
- 템플릿 생성
- 템플릿 활성/비활성 상태 변경
- 사용자 개인 기본 결재선 관리
- 템플릿별 기본 결재선 관리
- 템플릿 버전 관리 기반 구조

이를 통해 반복적으로 사용되는 결재 양식과 결재선을 관리자가 통제할 수 있다.

### 3.4 대리결재 및 사용자 상태 처리

대리결재 기능과 사용자 상태 검증을 구현했다.

- 개인 대리결재 설정 조회
- 개인 대리결재 설정 등록/수정
- 개인 대리결재 설정 삭제
- 대리결재 실행 이력 기록
- 휴직 사용자 결재 배정 차단
- 비활성 사용자 결재 배정 차단

이를 통해 결재자 부재 시 업무 지연을 줄이고, 결재선에 유효하지 않은 사용자가 포함되는 문제를 방지한다.

### 3.5 기한 및 알림

결재 지연 관리를 위해 결재 기한과 리마인더 기반을 구현했다.

- 결재 요청 시 기본 처리 기한 계산
- 운영 설정 기반 기한 시간 관리
- 지연 결재 건 대시보드 노출
- 리마인더 스케줄러 주기 설정 분리

기본 결재 기한은 72시간이며, 운영 설정에서 변경할 수 있다.

### 3.6 대시보드 및 결재함

대시보드 카드와 결재함 필터를 구현했다.

- 내 결재 대기
- 대리결재 대기
- 지연 결재
- 내가 요청한 진행 중 문서
- 최근 완료 문서

각 대시보드 카드는 결재 목록의 드릴다운 필터와 연결된다.

```text
GET /api/v1/approvals?dashboardFilter=myPending
GET /api/v1/approvals?dashboardFilter=delegatedPending
GET /api/v1/approvals?dashboardFilter=overdue
GET /api/v1/approvals?dashboardFilter=requestedInProgress
GET /api/v1/approvals?dashboardFilter=recentCompleted
```

### 3.7 PDF 및 첨부파일

최종 승인 문서의 PDF 관리와 첨부파일 권한 검사를 구현했다.

- 최종 승인 PDF 생성
- PDF 다운로드
- PDF 재생성
- 첨부파일 다운로드 권한 검사
- 결재 문서 접근 권한과 파일 접근 권한 연동

PDF 재생성은 운영성 보완을 위해 관리자 액션과 통합 액션 양쪽에서 사용할 수 있다.

### 3.8 보존 삭제, 복원, 감사

운영자가 결재 문서를 보존 삭제하고, 필요한 경우 복원할 수 있도록 구현했다.

- 결재 문서 보존 삭제
- 삭제 문서 목록 조회
- 삭제 문서 복원
- 복원 감사 로그 기록
- 보존 감사 리포트 조회
- 보존 감사 리포트 CSV 다운로드

영구 삭제는 운영 설정 항목으로 분리했으며, 기본값은 비활성화 상태이다. 실제 영구 삭제 실행은 별도의 운영 검토 후 후속 과제로 진행하는 것이 적절하다.

## 4. 역할별 권한

| 역할 | 주요 권한 |
| --- | --- |
| ADMIN | 전체 전자결재 문서 조회, 템플릿 관리, 기본 결재선 관리, 운영 설정, 보존 삭제, 복원, 상태 보정, 감사 리포트 |
| APPROVAL_ADMIN | 전자결재 운영 관리, 템플릿 및 기본 결재선 관리, 운영 설정, 보존 삭제, 복원, 상태 보정, 감사 리포트 |
| AUDIT_ADMIN | 전체 문서 조회 및 감사 목적 조회 |
| MANAGER | 본인이 관련된 결재 문서 조회 및 처리 |
| USER | 본인이 기안, 결재, 합의, 수신, 참조, 열람, 대리결재 대상인 문서 조회 및 처리 |

## 5. 운영 설정

운영 설정은 DB 기반으로 관리되며, 관리자 화면에서 수정할 수 있다. 일부 항목은 환경 변수 fallback을 지원한다.

| 설정 키 | 기본값 | 설명 |
| --- | ---: | --- |
| DECISION_DUE_HOURS | 72 | 결재 처리 기본 기한 |
| REMINDER_FIXED_DELAY_MS | 300000 | 지연 알림 반복 주기 |
| DELETED_DOCUMENT_RETENTION_DAYS | 1825 | 보존 삭제 문서 보관 기간 |
| PERMANENT_DELETE_ENABLED | false | 영구 삭제 기능 허용 여부 |

환경 변수 fallback 항목은 다음과 같다.

- `APPROVAL_DECISION_DUE_HOURS`
- `APPROVAL_REMINDER_FIXED_DELAY_MS`
- `APPROVAL_REMINDER_SCHEDULER_TICK_MS`

## 6. 주요 API

### 6.1 결재 문서

```text
POST   /api/v1/approvals
POST   /api/v1/approvals/drafts
GET    /api/v1/approvals
GET    /api/v1/approvals/{id}
PUT    /api/v1/approvals/{id}/draft
POST   /api/v1/approvals/{id}/submit
POST   /api/v1/approvals/{id}/actions/{action}
```

### 6.2 결재함 및 대시보드

```text
GET /api/v1/approvals/boxes
GET /api/v1/approvals/dashboard
```

### 6.3 템플릿 및 기본 결재선

```text
GET   /api/v1/approval-templates
GET   /api/v1/approval-templates/manage
POST  /api/v1/approval-templates
PATCH /api/v1/approval-templates/{templateCode}/status

GET /api/v1/approval-default-lines/effective
PUT /api/v1/approval-default-lines/me
GET /api/v1/approval-default-lines/templates/{templateCode}
PUT /api/v1/approval-default-lines/templates/{templateCode}
```

### 6.4 대리결재

```text
GET    /api/v1/approval-delegations/me
PUT    /api/v1/approval-delegations/me
DELETE /api/v1/approval-delegations/me
```

### 6.5 PDF, 운영, 보존

```text
GET    /api/v1/approvals/{id}/pdf
POST   /api/v1/approvals/{id}/pdf/regenerate
GET    /api/v1/files/{fileId}/download

GET    /api/v1/approval-operation-settings
PUT    /api/v1/approval-operation-settings

DELETE /api/v1/approvals/{id}
GET    /api/v1/approvals/deleted
POST   /api/v1/approvals/{id}/restore
GET    /api/v1/approvals/retention-audits
GET    /api/v1/approvals/retention-audits/export
```

## 7. 데이터베이스 반영 항목

전자결재 기능을 위해 다음 DB 패치와 기준 스키마가 사용된다.

- `groupware_schema.sql`
- `approval_phase1_patch.sql`
- `approval_phase3_patch.sql`
- `approval_phase5_default_line_patch.sql`
- `approval_phase7_delegation_patch.sql`
- `approval_operation_setting_patch.sql`

운영 반영 시에는 기준 스키마 적용 여부와 각 패치의 적용 순서를 확인해야 한다.

## 8. 검증 결과

최종 검증 결과는 다음과 같다.

| 구분 | 명령 또는 항목 | 결과 |
| --- | --- | --- |
| 백엔드 테스트 | `mvn test` | 성공, Tests run: 11, Failures: 0, Errors: 0 |
| 백엔드 패키징 | `mvn package -DskipTests` | 성공 |
| 프론트엔드 빌드 | `npm.cmd run build` | 성공 |
| 백엔드 헬스체크 | `GET /actuator/health` | 200 OK |
| 운영 설정 API | 조회/수정 | 성공 |
| 대시보드 필터 | 카드별 드릴다운 | 성공 |
| 보존 삭제/복원 | 삭제 목록, 복원 | 성공 |
| 감사 리포트 | 조회, CSV 다운로드 | 성공 |
| 일반 사용자 제한 | 권한 없는 운영 기능 접근 | 차단 확인 |

## 9. 운영 시 확인사항

운영 반영 전 확인할 항목은 다음과 같다.

- 운영 DB에 전자결재 관련 패치가 모두 적용되었는지 확인한다.
- 관리자 계정에 `ADMIN` 또는 `APPROVAL_ADMIN` 권한이 부여되어 있는지 확인한다.
- 감사 전용 계정은 `AUDIT_ADMIN` 권한으로 운영 기능 접근 범위를 분리한다.
- `DELETED_DOCUMENT_RETENTION_DAYS` 값을 회사 보존 정책에 맞게 조정한다.
- `PERMANENT_DELETE_ENABLED`는 기본 비활성화 상태로 유지하고, 영구 삭제 정책이 확정된 뒤 활성화 여부를 결정한다.
- PDF 파일 저장 위치와 백업 정책을 운영 환경 기준으로 점검한다.
- 지연 알림 주기와 결재 기한은 부서별 운영 방식에 맞게 조정한다.

## 10. 잔여 및 후속 과제

전자결재 1차 운영 범위는 완료되었으며, 다음 항목은 고도화 또는 별도 정책 확정 후 진행하는 것이 적절하다.

- 영구 삭제 실제 실행 기능
- 영구 삭제 전 확인 문구, 이중 승인, 백업 검토 절차
- 관리자 운영 요약 카드 고도화
- 전자결재 전체 E2E 브라우저 자동화 테스트
- 템플릿 디자이너 고도화
- PDF 레이아웃 디자이너 고도화
- 조직도 기반 결재선 추천
- 모바일 화면 최적화
- 알림 채널 확장

## 11. 결론

전자결재 모듈은 현재 1차 운영에 필요한 핵심 기능과 운영 관리 기능을 갖춘 상태이다. 결재 문서의 작성, 처리, 조회, 보관, 감사 흐름이 연결되어 있으며, 관리자 설정과 보존 정책도 시스템에서 관리할 수 있다.

따라서 현 시점에서는 전자결재 기본 구축을 완료로 판단할 수 있다. 이후 작업은 운영 정책 확정, 사용자 피드백, 감사 기준, UI 편의성 요구에 따라 고도화 과제로 분리해 진행하는 것이 적절하다.
