# Deep Interview Spec: Electronic Approval Restructure

## Metadata

- Profile: Standard
- Brownfield: yes
- Rounds: 0-5
- Final ambiguity: 18%
- Threshold: 20%
- Date: 2026-07-08
- Context snapshot: inline workspace inspection only

## Clarity Breakdown

| Dimension | Score |
| --- | ---: |
| Intent | 0.93 |
| Outcome | 0.90 |
| Scope | 0.90 |
| Constraints | 0.85 |
| Success | 0.82 |
| Context | 0.88 |

## Intent

전자결재 상단 분류가 세부 상태 중심으로 나뉘어 사용자가 어디서 무엇을 해야 하는지 판단하기 어렵다. 업무 행동 기준으로 재구성해, 비개발자와 다양한 연령대 사용자가 결재 대상, 진행 문서, 완료 문서를 신뢰하고 빠르게 찾도록 한다.

## Desired Outcome

전자결재는 진행 중인 업무 처리 중심으로 단순화하고, 완료 문서는 별도 카테고리에서 내가 관여한 모든 완료 문서를 필터링해 찾을 수 있게 한다. 휴가/교육 기간에는 사용자가 선택한 경우에만 기본 대리자에게 대리결재 권한이 자동 적용된다.

## In Scope

1. 큰 카테고리 분리
   - 전자결재
   - 결재 완료문서

2. 전자결재 카테고리
   - 결재할문서: 내가 지금 결재, 합의/협의, 참조/연람, 수신 확인 등 처리 또는 확인해야 하는 문서
   - 결재진행문서: 내가 결재했지만 아직 완료되지 않은 문서, 또는 내 결재 순서가 아직 오지 않은 진행 중 문서
   - 임시보관함: 내가 작성 중인 임시저장 문서
   - 기안한문서는 상단 주요 분류에서 제거

3. 결재 완료문서 카테고리
   - 내가 관여한 모든 완료 문서 조회
   - 내가 최종 승인한 문서뿐 아니라 중간 결재, 합의/협의, 참조/연람, 수신 확인/접수, 대리결재로 처리한 문서 포함
   - 문서 자체는 완료 상태여야 함
   - 필터링 제공: 문서종류, 기간, 상태, 기안자, 내 역할

4. 대리결재
   - 사용자별 기본 대리자 1명 지정
   - 휴가 및 교육 문서 모두 포함
   - 휴가/교육 결재 작성 시 대리결재 적용 여부 선택
   - 기본값은 꺼짐
   - 사용자가 켠 경우에만 실제 휴가/교육 기간에 대리결재 가능
   - 상신일 기준이 아니라 실제 부재 날짜/시간 기준으로 적용
   - 예: 7월 9일 상신, 7월 20일 오후 반차이면 7월 20일 오후 반차 시간에만 대리결재 가능

## Out Of Scope / Non-Goals

- 모든 기존 문서함을 완전히 삭제하지는 않는다. 필요한 경우 더보기, 관리자, 검색/필터 내부 기능으로 흡수한다.
- 대리결재를 모든 휴가/교육 문서에 강제 적용하지 않는다.
- 휴가/교육 상신 시점부터 대리결재를 열지 않는다.
- 완료문서에서 내가 전혀 관여하지 않은 전체 회사 문서를 기본 노출하지 않는다.

## Decision Boundaries

Codex may decide:

- 기존 `agreement`, `pending`, `received`, `shared`, `requested`, `processed`, `all` 박스를 새 UI 분류에 매핑하는 세부 방식
- 완료문서 필터 UI 배치와 기본 컬럼
- 대리결재 적용 체크박스 문구와 배치
- 기존 수동 대리설정을 사용자별 기본 대리자 설정 화면으로 확장하는 UI 방식

Codex should confirm before deciding:

- 교육 문서의 정확한 템플릿 코드 범위가 불명확할 경우
- 반차/시간 단위 교육의 시간 범위 계산 규칙이 기존 데이터에 없을 경우
- 완료문서에 관리자 전체 문서 조회를 병합하려는 경우

## Constraints

- 기존 Spring Boot + React 구조를 유지한다.
- 기존 결재 상태/결재선 데이터와 호환되어야 한다.
- 아래 표에 이미 문서 상태와 현재 단계가 있으므로 상단 카테고리는 세부 상태명이 아니라 업무 목적명이어야 한다.
- 대리결재는 실제 부재 기간에만 유효해야 한다.

## Acceptance Criteria

1. 전자결재 화면 상단에는 `결재할문서`, `결재진행문서`, `임시보관함`이 주요 탭으로 표시된다.
2. `기안한문서`는 주요 탭에서 제거된다.
3. `결재할문서`에는 내가 지금 처리 또는 확인해야 하는 결재/합의/참조/수신 문서가 포함된다.
4. `결재진행문서`에는 내가 이미 관여했거나 내 순서가 오지 않은 진행 중 문서가 표시된다.
5. `결재 완료문서` 카테고리에서 내가 관여한 완료 문서를 조회할 수 있다.
6. 완료문서는 문서종류, 기간, 상태, 기안자, 내 역할로 필터링할 수 있다.
7. 사용자별 기본 대리자 1명을 지정할 수 있다.
8. 휴가/교육 결재 작성 시 `대리결재 적용` 선택이 가능하고 기본값은 꺼짐이다.
9. 대리결재를 켠 휴가/교육 문서는 실제 부재 기간에만 기본 대리자가 결재 가능하다.
10. 프론트 빌드와 백엔드 컴파일이 통과한다.

## Brownfield Evidence

- `frontend/src/App.tsx`에 전자결재 탭, 대리설정 화면, 휴가/교육 양식 처리, 대시보드 연결이 있다.
- `ApprovalQueryService`는 기존 문서함 및 dashboardFilter 기반 조회를 제공한다.
- `ApprovalDocumentRepository`와 `ApprovalLineRepository`는 역할/상태 기반 조회 쿼리를 갖고 있다.
- `ApprovalDelegationService`는 현재 대리결재 가능자 판단에 이미 사용된다.
- 휴가 관련 데이터는 `leaveSelectionsJson` 등 필드 값으로 저장/표시된다.

## Residual Risks

- 교육 일정의 날짜/시간 데이터가 휴가처럼 구조화되어 있지 않으면 별도 필드 정규화가 필요할 수 있다.
- 반차처럼 시간대가 있는 대리결재는 현재 서버 시간이 시간 단위 판정에 충분히 쓰이는지 확인이 필요하다.
- 완료문서의 "내 역할" 필터는 결재선 유형과 행동 상태를 함께 해석해야 한다.

## Condensed Transcript

- User proposed splitting into `전자결재` and `결재 완료문서`.
- User defined `결재할문서` as all documents requiring their action/confirmation, including 수신, 참조, 협의, 결재.
- User defined `결재진행문서` as documents they already approved but not completed, or documents where their turn has not arrived.
- User removed `기안한문서` from the main structure.
- User required completion archive filters.
- User clarified completion archive means every completed document they were involved in.
- User required delegation to include 휴가 and 교육.
- User clarified each user has one personally designated default delegate.
- User clarified delegation should be optional, default off.
- User clarified delegation should be valid only during actual leave/training period, not from submission date.
