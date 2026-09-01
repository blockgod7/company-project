# Frontend DOX

## Purpose
- `frontend/` contains the Groupware React application.
- The confirmed stack is React 19, React DOM 19, TypeScript, Vite 8, and `lucide-react`.

## Ownership
- This file owns guidance for `frontend/package.json`, Vite/TypeScript config, and `frontend/src/**`.

## Local Contracts
- API calls should go through `src/api.ts`.
- The API base URL comes from `VITE_API_BASE_URL`, with the current code defaulting to `http://localhost:8080/api/v1`.
- The current-project Vite development and Playwright default URL is `http://127.0.0.1:5174`; port 5173 is reserved for the remote comparison project.
- Shared API-facing types belong in `src/types.ts`; keep them aligned with backend DTOs when API contracts change.
- Do not hardcode passwords, tokens, or local-only secrets in frontend docs or source.
- Korean UI text may appear corrupted in some terminal output; verify the actual UTF-8 source before editing localized labels.

## Work Guidance
- Canonical authenticated routes live in `src/navigation.ts`; use browser URLs rather than local route-only state for navigation.
- Portal menus come from `/menus/effective`; do not reintroduce a hardcoded sidebar catalog.
- Planned-feature content is read-only configuration under `src/config/plannedFeatures.ts` and must not expose mock workflow actions.
- Organization-directory screens use `/emps/directory`; do not expose account IDs, role codes, or managed permissions through that response.
- `src/App.tsx`, `src/AppShell.tsx`, and `src/AppRouteContent.tsx` own the main shell and route selection.
- Page modules under `src/pages/` own user-facing screens such as dashboard, login, approval, board/notice, drawing management, equipment management, organization, audit, notifications, and global search.
- Education editors preserve server-owned workflow/source/revision fields. The three education templates are available to regular users without enabling other preview features. Dashboard education data comes only from `/trainings/me`; completed dates mean education ended, and report receipt means completion.
- The employee personal calendar lives at `/portal/employee/calendar` and combines the current user's work schedules, approved education schedules, approved leave dates, and personal approval summaries using existing APIs.
- Keep electronic-approval state/loading in `useApprovalPageController.tsx`, document actions in `createApprovalDocumentActions.tsx`, and form/detail renderers in the focused `Approval*Parts` modules; do not rebuild `ApprovalPage.tsx` as a single page monolith.
- Keep drawing-management dialogs in `DrawingManagementModals.tsx` and folder/upload validation helpers under `src/utils/drawingManagement.ts`.
- Keep CSS entry files as import manifests and place rules in the focused files under `src/styles/` so purchase/training, leave, equipment, shell, and page styles remain independently maintainable.
- Keep backend endpoint changes coordinated with `src/api.ts` and `src/types.ts`.
- Prefer existing components and styling conventions before adding new abstractions.
- Keep `EMERGENCY_CALL_REQUEST` out of selectable template categories; new emergency work uses `WORK_REQUEST` with `EMERGENCY_CALL`. Preserve legacy template metadata and document rendering for existing approvals.

## Verification
- Frontend build: `npm.cmd run build`.
- Frontend dev server: `npm.cmd run dev`.
- Frontend preview: `npm.cmd run preview`.

## Child DOX Index
- No child AGENTS.md files are defined under `frontend/` yet.
