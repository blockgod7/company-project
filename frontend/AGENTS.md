# Frontend DOX

## Purpose
- `frontend/` contains the Groupware React application.
- The confirmed stack is React 19, React DOM 19, TypeScript, Vite 7, and `lucide-react`.

## Ownership
- This file owns guidance for `frontend/package.json`, Vite/TypeScript config, and `frontend/src/**`.

## Local Contracts
- API calls should go through `src/api.ts`.
- The API base URL comes from `VITE_API_BASE_URL`, with the current code defaulting to `http://localhost:8080/api/v1`.
- Shared API-facing types belong in `src/types.ts`; keep them aligned with backend DTOs when API contracts change.
- Do not hardcode passwords, tokens, or local-only secrets in frontend docs or source.
- Korean UI text may appear corrupted in some terminal output; verify the actual UTF-8 source before editing localized labels.

## Work Guidance
- `src/App.tsx`, `src/AppShell.tsx`, and `src/AppRouteContent.tsx` own the main shell and route selection.
- Page modules under `src/pages/` own user-facing screens such as dashboard, login, approval, board/notice, drawing management, organization, audit, notifications, and global search.
- Keep backend endpoint changes coordinated with `src/api.ts` and `src/types.ts`.
- Prefer existing components and styling conventions before adding new abstractions.

## Verification
- Frontend build: `npm.cmd run build`.
- Frontend dev server: `npm.cmd run dev`.
- Frontend preview: `npm.cmd run preview`.

## Child DOX Index
- No child AGENTS.md files are defined under `frontend/` yet.
