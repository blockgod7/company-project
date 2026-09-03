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
- Fresh app entry with a restored session and successful login start at employee home; ordinary in-app navigation must not rerun authentication restoration. Shell name buttons open `AccountSettingsDialog` for contact-only self-service. `PasswordChangeForm` is shared with forced temporary-password changes; success clears the local session and requires login again.
- Portal menus come from `/menus/effective`; do not reintroduce a hardcoded sidebar catalog.
- Planned-feature content is read-only configuration under `src/config/plannedFeatures.ts` and must not expose mock workflow actions.
- Organization-directory screens use `/emps/directory`; do not expose account IDs, role codes, or managed permissions through that response.
- `src/App.tsx`, `src/AppShell.tsx`, and `src/AppRouteContent.tsx` own the main shell and route selection.
- Page modules under `src/pages/` own user-facing screens such as dashboard, login, approval, board/notice, drawing management, equipment management, organization, audit, notifications, and global search.
- Education editors preserve server-owned workflow/source/revision fields. The three education templates are available to regular users without enabling other preview features. Dashboard education data comes only from `/trainings/me`; completed dates mean education ended, and report receipt means completion.
- The employee personal calendar lives at `/portal/employee/calendar` and combines the current user's work schedules, approved education schedules, approved leave dates, and personal approval summaries using existing APIs.
- Keep electronic-approval state/loading in `useApprovalPageController.tsx`, document actions in `createApprovalDocumentActions.tsx`, and form/detail renderers in the focused `Approval*Parts` modules; do not rebuild `ApprovalPage.tsx` as a single page monolith.
- `ApprovalInfoModal.tsx` owns the shared approval-info dialog for every document and purchase/education receiver approval. Keep personal line save/load/rename/delete in `useApprovalLineLibrary.ts`. Personal lines exclude receivers on save and preserve the current document receivers on load, including legacy saved lines; only template-specific defaults may supply fallback receivers; document-specific rules are passed as options. Render the dialog outside document containers so template CSS cannot change its layout.
- The employee approval tab `참조문서` reuses the `shared` box for in-progress reference/reader documents, without an action-required dashboard filter. Completed references appear in `결재 완료문서` (role SHARED); read status does not move a document. References are view-only from submission; receive/decision/PDF buttons remain driven by server permissions.
- New DRAFT, WORK_REQUEST and WORK_REQUEST_CHANGE forms use the HR default receiver, as do education forms. PE-authored equipment/mold proposals default to the named purchase-request receiver; other departments retain production-engineering routing. Keep defaults aligned across creation, template changes and automatic line loading; preserve submitted documents.
- Purchase composing, previews and detail fields share `ApprovalPurchaseParts.tsx` and `styles/approval-purchase.css`. Keep approval-line setup in the common dialog and signatures out of the on-screen purchase document; preserve PDF rendering and purchase workflow APIs.
- `ApprovalFormBody.tsx` owns template-to-editor routing for compose, template selection and read-only previews. `utils/approvalForm.ts` supplies shared creation/preview defaults. Do not add separate mock/template-preview layouts; refresh the active template catalog when opening selection and preserve existing document/PDF snapshots.
- Keep drawing-management dialogs in `DrawingManagementModals.tsx` and folder/upload validation helpers under `src/utils/drawingManagement.ts`.
- Keep CSS entry files as import manifests and place rules in the focused files under `src/styles/` so purchase/training, leave, equipment, shell, and page styles remain independently maintainable.
- Draft, board and notice body formatting share the lazy-loaded Tiptap `RichTextEditor` and `styles/rich-text.css`; `utils/richText.ts` owns the HTML whitelist shared by editing and detail display. Board/notice opt into safe HTTP(S) images and migrate the previous Markdown image syntax when editing. Draft images remain disabled; keep draft formatting aligned with backend `ApprovalRichTextPdfBody`. Do not restore browser `execCommand` editing. Initialize the editor after mount so Suspense cannot reuse a destroyed instance.
- Keep backend endpoint changes coordinated with `src/api.ts` and `src/types.ts`.
- Prefer existing components and styling conventions before adding new abstractions.
- Equipment/mold composing and preview share `EquipmentProposalPeFields` for production-engineering self-requests; use `equipmentProposalReceiverId` across creation, template changes, default lines and submission. Frontend department matching is a display/default hint; the backend owns routing snapshots and returned `peSelfRequest` for detail views.
- Keep `EMERGENCY_CALL_REQUEST` out of selectable template categories; new emergency work uses `WORK_REQUEST` with `EMERGENCY_CALL`. Preserve legacy template metadata and document rendering for existing approvals.

## Verification
- Frontend build: `npm.cmd run build`.
- Login/home routing, personal contacts and password-change regressions: `npm.cmd run test:account` (JSDOM and mocked API; never modifies real employee credentials).
- Global-search filter and request-order regressions: `npm.cmd run test:search` (JSDOM and mocked API; no live services).
- Frontend dev server: `npm.cmd run dev`.
- Frontend preview: `npm.cmd run preview`.
- Rich-text component/serialization regressions: `npm.cmd run test:rich-text` (JSDOM, no live API or database).
- Approval form/preview parity and catalog refresh regressions: `npm.cmd run test:approval-preview` (JSDOM, API responses mocked; Node 22.15+ for asset-loading hooks).

## Child DOX Index
- No child AGENTS.md files are defined under `frontend/` yet.
