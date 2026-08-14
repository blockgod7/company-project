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
- Keep electronic-approval state/loading in `useApprovalPageController.tsx`, document actions in `createApprovalDocumentActions.tsx`, and form/detail renderers in the focused `Approval*Parts` modules; do not rebuild `ApprovalPage.tsx` as a single page monolith.
- Keep drawing-management dialogs in `DrawingManagementModals.tsx` and folder/upload validation helpers under `src/utils/drawingManagement.ts`.
- Keep CSS entry files as import manifests and place rules in the focused files under `src/styles/` so purchase/training, leave, equipment, shell, and page styles remain independently maintainable.
- Keep backend endpoint changes coordinated with `src/api.ts` and `src/types.ts`.
- Prefer existing components and styling conventions before adding new abstractions.

## Verification
- Frontend build: `npm.cmd run build`.
- Frontend dev server: `npm.cmd run dev`.
- Frontend preview: `npm.cmd run preview`.

## Child DOX Index
- No child AGENTS.md files are defined under `frontend/` yet.
