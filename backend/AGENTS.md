# Backend DOX

## Purpose
- `backend/` contains the Spring Boot API application for Groupware.
- The confirmed stack is Java 21, Spring Boot 3.5.7, Maven, Spring Web, Spring Data JPA, Spring Security, Validation, PostgreSQL, JJWT, PDFBox, Lombok, and Spring Boot test tooling.

## Ownership
- This file owns backend application guidance under `backend/`.
- Database schema, seed, and patch SQL guidance is delegated to `src/main/resources/db/AGENTS.md`.

## Local Contracts
- The backend API prefix is configured as `/api/v1`.
- Do not change API behavior, security behavior, DB schema, or runtime configuration during documentation-only tasks.
- Do not document secret values from environment defaults, local settings, seed data, or runtime configuration.
- Treat `backend/README.md` and `backend/docs/electronic-approval-final.md` as useful references, but verify any implementation claim against current code and configuration.
- Treat `backend/docs/electronic-approval-report.md` as potentially stale or encoding-sensitive until verified; it showed terminal mojibake and at least one health endpoint mismatch during this review.

## Work Guidance
- `auth` owns login, login options, current-user lookup, token refresh, and logout API behavior.
- Self-service `GET/PUT /auth/profile` reads the authenticated employee and updates only email, phone and extension; HR/account fields stay administrator-owned. `/auth/change-password` requires current and new passwords, revokes refresh tokens and expires the refresh cookie. Login, refresh and self-service writes acquire the same login advisory lock before employee/token writes; self-service reads employee state under a row lock.
- Concurrent attempts for the same login ID are serialized with the PostgreSQL transaction advisory lock in `EmpRepository.acquireLoginLock`; preserve this ordering before employee state and refresh-token writes.
- `approval` owns electronic approval documents, lines, templates, delegations, operation settings, leave balances, managed holidays, post-approval leave exclusions, retention/audit flows, PDFs, and related workflow APIs.
- Named REFERENCE assignees can read IN_PROGRESS/APPROVED/REJECTED documents from submission, including legacy WAITING lines. The shared inbox/search contains only IN_PROGRESS documents; APPROVED/REJECTED references remain readable under completed-involved (role SHARED). Drafts, withdrawn/canceled and deleted documents stay excluded. Submission opens/notifies once; authorized detail reads record the assigned reference's first readAt without moving inboxes. Keep RECEIVER/READER handoff timing and approved-only PDF permissions unchanged.
- Equipment/mold self-requests snapshot server-derived `fields.equipmentRequestMode` (`PE_SELF`/`STANDARD`) from requester department code `PROD_TECH` during draft/submit normalization. `PE_SELF` stores PE opinions with the initial request and routes to purchase after all initial decisions; missing markers retain the legacy PE workflow. Never infer historical routing from the requester's current department or duplicate integrated signatures in PDFs.
- `TrainingWorkflowService` projects private education schedules from immutable approval documents. Preserve server-owned workflow/source/revision fields, owner locking, legacy exclusion and report receipt completion. See `docs/training-workflow-20260831.md`.
- `work` owns work requests, changes, cancellation and schedules. Completion uses Asia/Seoul end timestamps (overnight included) and runs every minute; retain source-entry locking and the employee lock before compensatory-credit deduplication.
- Leave/work acceptance fixtures under `src/test/resources/leave-work-acceptance.sql` are restricted to the isolated `groupware_leave_work_qa` DB; never apply them to the business database.
- `board` and `notice` own board and notice APIs.
- `file` owns upload/download metadata and file access behavior.
- `pdm` owns drawing-management folders, documents, revisions, and related actions.
- `equipment` owns equipment masters, abnormal reports, assignment, completion-approval links, and equipment history APIs.
- `search` owns global search APIs. Providers with mixed statuses (menus and approvals) must apply the requested status before paging or limiting, while preserving their existing authorization checks.
- `menu` owns effective portal menus and per-employee menu preferences; menu visibility must be decided server-side before responses are returned.
- `emp`, `dept`, `role`, `code`, `notification`, and `log` own organization, role/code, notification, and audit-support APIs.
- `ApprovalPdfCanvas` owns reusable PDFBox drawing primitives; `ApprovalPdfService` owns PDF lifecycle, `ApprovalPdfRenderer` selects document renderers, and the standard/equipment renderers plus `ApprovalPdfRenderSupport` own layout generation.
- `ApprovalRichTextPdfBody` renders sanitized draft HTML with OpenHTMLtoPDF; external resources are denied. It reserves the first-page approval header/footer and paginates overflow. Preserve existing generated PDFs; use the existing authorized regeneration workflow to update them. Draft PDF rendering requires the existing Windows Malgun Gothic font.
- `PdmPermissionPolicy` owns PDM access and delegated department-manager scope checks; `PdmService` owns drawing/revision/download workflows while `PdmFolderService` owns folder-path persistence and ordering.
- Keep backend DTO and frontend type changes coordinated when API shapes change.

## Verification
- From `backend/`, set the repository root first: `$root = Split-Path -Parent (Get-Location)`.
- Backend tests: `& "$root\.tools\apache-maven-3.9.9\bin\mvn.cmd" test "-Dmaven.repo.local=$root\.m2repo"`.
- Backend local run: `& "$root\.tools\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run "-Dmaven.repo.local=$root\.m2repo"`.
- Health check after backend startup: `Invoke-WebRequest -UseBasicParsing http://localhost:8080/api/v1/health`.

## Child DOX Index
- `src/main/resources/db/AGENTS.md` - PostgreSQL baseline schema, seed data, patch SQL, and DB verification rules.
