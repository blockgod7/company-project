# Deep Interview Spec: Home Global Search

## Metadata

- Profile: Standard
- Rounds: 9
- Final ambiguity: 11%
- Threshold: 20%
- Type: Brownfield
- Context snapshot: `.codex/deep-interview/context/global-search-20260706.md`

## Clarity Breakdown

| Dimension | Score |
| --- | ---: |
| Intent | 0.94 |
| Outcome | 0.94 |
| Scope | 0.90 |
| Constraints | 0.93 |
| Success | 0.88 |
| Context | 0.84 |

## Intent

Users need one fast search entry point from the home screen so they do not have to visit notices, boards, approvals, PDM, organization, notifications, and admin screens one by one.

## Desired Outcome

Add a home-screen global search tool. When a user searches a word such as `김민수`, the home screen shows grouped results by module. Clicking a result moves to the owning module and opens or selects the matching item when possible.

## In Scope

- Home-screen global search input and results panel.
- Results grouped by module/item type, for example:
  - 전자결재
  - 게시판
  - 공지사항
  - 도면관리
  - 조직/직원
  - 알림
  - 관리자, only for admin users
- First version includes every current searchable module.
- Future modules should be able to join global search through a backend extension pattern without rebuilding the home search UI each time.
- Search DB text fields such as titles, document numbers, authors/requesters, body/content, form field values, drawing numbers, drawing names, filenames, descriptions, departments, and employee names.
- Result rows should include enough metadata to identify the item and a drill-in action.
- Result clicks should navigate to details or selection state:
  - Approval detail
  - Board post detail
  - Notice detail
  - PDM drawing selected in drawing management
  - Employee or organization location

## Out Of Scope

- Attachment internal content search for PDF, Excel, Word, and similar files.
- Showing any unauthorized item, including title-only hints.
- Showing admin-only search groups to non-admin users.
- A separate integrated search result page for the first version.

## Decision Boundaries

Codex may decide these during implementation, based on the existing codebase:

- Exact result limits per module.
- Module order in the home search panel.
- Result labels and badges.
- Backend interface shape for future searchable modules.
- Visual density and layout details, as long as results remain on the home screen and grouped by module.

Codex should not change these without asking:

- Moving results to a separate page.
- Exposing title-only results for inaccessible approvals or admin data.
- Implementing attachment body indexing as part of the first version.

## Constraints

- Permission filtering must happen server-side.
- Electronic approval search must follow actual read/access rights. If the user has no right to read or review a document, even the title must not appear.
- Approval visibility should align with existing access logic such as requester, approval line, receiver, reference, reader, delegation, or equivalent permission checks.
- Admin-only data appears only when the current login is admin.
- Non-admin users should not see admin-only groups or existence hints.

## Acceptance Criteria

- Searching `김민수` from the home screen shows grouped results without leaving the home screen.
- Groups are visually separated by module.
- Each result has a clear title, metadata, module/status badges, and a drill-in affordance.
- Clicking an approval result opens the corresponding approval detail.
- Clicking a board result opens the corresponding board post detail.
- Clicking a PDM result navigates to drawing management with the drawing selected when possible.
- A non-authorized approval document does not appear at all, including its title.
- Admin-only results appear for admin login only.
- The backend has a structure that lets future modules contribute to global search without duplicating all home-search logic.
- Frontend build and backend tests pass after implementation.

## Brownfield Evidence

- `frontend/src/App.tsx` has routes for dashboard, notices, boards, approvals, PDM, notifications, organization, and audit.
- `Dashboard` renders at the `dashboard` route.
- Current topbar contains a search icon but no global input.
- Existing module-local search exists in organization/approver pickers and PDM.
- Approval listing already accepts a `keyword` parameter.
- PDM drawing listing already accepts `category` and `keyword`.
- Backend has module controllers for notices, boards, approvals, PDM, employees, notifications, and audit.

## Pressure-Pass Findings

- The biggest risk is information leakage through search results.
- Approval titles are sensitive and must be hidden unless the user can access the approval.
- Admin-only data must not create existence hints for non-admin users.
- Home-screen grouped results fit the user's desired workflow better than a separate search page.

## Residual Risks

- Some current module APIs may not expose detail-selection behavior yet, especially PDM selected-state navigation and employee/org drill-in.
- Reusing existing module search endpoints may not be enough for consistent permission-safe grouped results; a dedicated global search backend service is likely better.
- Attachment content search will require a later indexing strategy.

## Condensed Transcript

- User requested a home-screen search tool that searches everything related to a word.
- User confirmed grouped module results, such as approvals together and boards together.
- User requested all current modules and future modules be included.
- Approval access was clarified: documents without read/review access must not show even by title.
- First version search depth was limited to DB text fields; attachment body search is later.
- Result clicks should navigate to the relevant module/detail.
- Admin-only results should show only for admin login.
- Success means fast grouped results, drill-in navigation, and no unauthorized exposure.
- User approved Codex choosing implementation details such as result limits and backend extension structure.
- User reviewed the `김민수` UI direction and chose home-screen inline results rather than a separate results page.
