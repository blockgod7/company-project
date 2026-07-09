# Groupware Backend

Backend for the company integrated groupware project.

Current working state: electronic approval finalization is complete for the first production-ready pass. Core workflow, operations settings, dashboard drill-down, retention restore, retention policy, audit report, CSV export, backend/frontend builds, and API smoke checks pass. Final handoff notes are in `docs/electronic-approval-final.md`.

## Stack

- Java 21
- Spring Boot 3.5
- Maven
- Spring Web
- Spring Data JPA
- Spring Security
- PostgreSQL
- JWT access and refresh tokens

## API Prefix

All backend APIs use `/api/v1`.

Implemented APIs include:

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/notices`
- `GET /api/v1/notices/{noticeId}`
- `POST /api/v1/notices`
- `PUT /api/v1/notices/{noticeId}`
- `DELETE /api/v1/notices/{noticeId}`
- `POST /api/v1/notices/{noticeId}/comments`
- `DELETE /api/v1/notices/comments/{commentId}`
- `POST /api/v1/notices/{noticeId}/read`
- `GET /api/v1/boards`
- `POST /api/v1/boards`
- `GET /api/v1/boards/{boardId}/posts`
- `POST /api/v1/boards/{boardId}/posts`
- `GET /api/v1/boards/posts/{postId}`
- `PUT /api/v1/boards/posts/{postId}`
- `DELETE /api/v1/boards/posts/{postId}`
- `POST /api/v1/boards/posts/{postId}/comments`
- `DELETE /api/v1/boards/posts/comments/{commentId}`
- `POST /api/v1/boards/posts/{postId}/read`
- `GET /api/v1/approvals`
  - optional dashboard drill-down query: `dashboardFilter=myPending|delegatedPending|overdue|requestedInProgress|recentCompleted`
- `GET /api/v1/approvals/boxes`
- `GET /api/v1/approvals/dashboard`
- `GET /api/v1/approvals/deleted`
- `GET /api/v1/approvals/retention-audits`
- `GET /api/v1/approvals/retention-audits/export`
- `POST /api/v1/approvals`
- `POST /api/v1/approvals/drafts`
- `GET /api/v1/approvals/{approvalId}`
- `PUT /api/v1/approvals/{approvalId}/draft`
- `POST /api/v1/approvals/{approvalId}/submit`
- `POST /api/v1/approvals/{approvalId}/withdraw`
- `POST /api/v1/approvals/{approvalId}/cancel`
- `POST /api/v1/approvals/{approvalId}/redraft`
- `POST /api/v1/approvals/{approvalId}/approve`
- `POST /api/v1/approvals/{approvalId}/actions/{action}`
- `POST /api/v1/approvals/{approvalId}/reject`
- `POST /api/v1/approvals/{approvalId}/receive`
- `POST /api/v1/approvals/{approvalId}/complete-receipt`
- `GET /api/v1/approvals/{approvalId}/pdf`
- `POST /api/v1/approvals/{approvalId}/pdf/regenerate`
- `DELETE /api/v1/approvals/{approvalId}`
- `POST /api/v1/approvals/{approvalId}/restore`
- `POST /api/v1/approvals/{approvalId}/status-correction`
- `GET /api/v1/approval-templates`
- `GET /api/v1/approval-templates/admin`
- `GET /api/v1/approval-templates/manage`
- `POST /api/v1/approval-templates`
- `PATCH /api/v1/approval-templates/{templateCode}/active`
- `PATCH /api/v1/approval-templates/{templateCode}/status`
- `GET /api/v1/approval-default-lines/effective`
- `PUT /api/v1/approval-default-lines/me`
- `GET /api/v1/approval-default-lines/templates/{templateCode}`
- `PUT /api/v1/approval-default-lines/templates/{templateCode}`
- `GET /api/v1/approval-delegations/me`
- `PUT /api/v1/approval-delegations/me`
- `DELETE /api/v1/approval-delegations/me`
- `GET /api/v1/approval-operation-settings`
- `PUT /api/v1/approval-operation-settings`
- `GET /api/v1/depts/tree`
- `GET /api/v1/emps`
- `GET /api/v1/notifications`
- `POST /api/v1/notifications`
- `PATCH /api/v1/notifications/{notificationId}/read`
- `PUT /api/v1/notifications/{notificationId}/read`
- `POST /api/v1/files`
- `POST /api/v1/files/batch`
- `GET /api/v1/files`
- `GET /api/v1/files/{fileId}/download`
- `DELETE /api/v1/files/{fileId}`
- `GET /api/v1/audit-logs`
- `GET /api/v1/audit-logs/paged`
- `GET /api/v1/admin/audit-logs`

## Response Format

Normal API responses use the shared wrapper:

```json
{
  "success": true,
  "data": {},
  "code": null,
  "message": null,
  "status": 200,
  "timestamp": "2026-06-17T15:00:00"
}
```

Error responses keep the same wrapper and include `code`, `message`, and `status`.

## Environment

Runtime settings are environment-variable driven:

- `SERVER_PORT`, default `8080`
- `DB_URL`, default `jdbc:postgresql://localhost:5432/groupware`
- `DB_USERNAME`, default `groupware`
- `DB_PASSWORD`, default `groupware`
- `JWT_SECRET`, required for non-local environments
- `JWT_ACCESS_TOKEN_VALIDITY_SECONDS`, default `1800`
- `JWT_REFRESH_TOKEN_VALIDITY_SECONDS`, default `1209600`
- `FILE_STORAGE_PATH`, default `uploads`
- `CORS_ALLOWED_ORIGINS`, default `http://localhost:5173,http://127.0.0.1:5173`
- frontend `VITE_ENABLE_TEMPLATE_FALLBACK=true` enables development fallback approval templates outside dev mode
- `APPROVAL_DECISION_DUE_HOURS`, default `72`
- `APPROVAL_REMINDER_FIXED_DELAY_MS`, default `300000`
- `APPROVAL_REMINDER_SCHEDULER_TICK_MS`, default `60000`

The PostgreSQL schema baseline is stored at:

`src/main/resources/db/schema/groupware_schema.sql`

JPA is configured with `ddl-auto: validate`; create/update database tables from the SQL schema before starting the backend.

## Local Run

From the repository root, the easiest local launcher is path-independent and works from either `D:\project\CompanyProject` now or `C:\Project\Groupware` later:

```powershell
.\start-web.ps1
```

## Local PostgreSQL Setup

The backend uses PostgreSQL in the `dev` profile and validates the schema at startup. If the database, schema, or seed data is missing, the backend can fail before login or API testing begins.

Default local database settings:

- database: `groupware`
- username: `groupware`
- password: `groupware`
- JDBC URL: `jdbc:postgresql://localhost:5432/groupware`

To patch an existing local database with the current idempotent local patches and reapply local seed data:

```powershell
.\setup-local-db.ps1
```

Older migration patch files are kept for historical upgrade paths. Applying all of them to an already-migrated database with real data can fail on constraints that are now part of the baseline schema. Use `-ApplyLegacyPatches` only when intentionally upgrading an older local DB and after reviewing the output.

To recreate the local database from `groupware_schema.sql` and then apply `local_seed.sql`:

```powershell
.\setup-local-db.ps1 -Recreate -AdminUser postgres
```

If the PostgreSQL admin account needs a password, pass it without storing it in source control:

```powershell
.\setup-local-db.ps1 -Recreate -AdminUser postgres -AdminPassword "<password>"
```

To verify the local DB and, when the backend is running, the health endpoint:

```powershell
.\verify-local-db.ps1
```

If `psql.exe` is not on `PATH`, the scripts try common PostgreSQL install locations. You can also pass `-PsqlPath "C:\Program Files\PostgreSQL\17\bin\psql.exe"`.

Backend-only commands:

```powershell
cd <PROJECT_ROOT>\backend
$root = Split-Path -Parent (Get-Location)
& "$root\.tools\apache-maven-3.9.9\bin\mvn.cmd" test "-Dmaven.repo.local=$root\.m2repo"
& "$root\.tools\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run "-Dmaven.repo.local=$root\.m2repo"
```

Health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080/api/v1/health
```

Frontend commands:

```powershell
cd <PROJECT_ROOT>\frontend
npm.cmd run build
npm.cmd run dev
```

Use `frontend\.env.example` as the local frontend environment template.

## Seed Data

The local seed file is:

`src/main/resources/db/seed/local_seed.sql`

Sample accounts use this temporary password:

`admin1234`

Important login IDs:

- `admin` - administrator
- `kim.manager` - manager / approver candidate
- `lee.sales` - manager / approver candidate
- `hong.gildong` - normal user

## Known Issues

- Electronic approval first-pass finalization is complete. Deferred enhancements are documented in `docs/electronic-approval-final.md`.
- Electronic approval PDF watermarking is intentionally excluded for now.
- Future template work can focus on richer field components, drag-and-drop template editing, and refined PDF layout if needed.
- Live end-to-end login requires a running PostgreSQL database with the schema and seed data applied.
