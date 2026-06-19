# Groupware Backend

Phase 1 backend for the company integrated groupware project.

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

Implemented Phase 1 APIs:

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
- `POST /api/v1/approvals`
- `GET /api/v1/approvals/{approvalId}`
- `POST /api/v1/approvals/{approvalId}/approve`
- `POST /api/v1/approvals/{approvalId}/reject`
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

The PostgreSQL schema baseline is stored at:

`src/main/resources/db/schema/groupware_schema.sql`

JPA is configured with `ddl-auto: validate`; create/update database tables from the SQL schema before starting the backend.

## Local Run

From the repository root, the easiest local launcher is:

```powershell
.\start-web.ps1
```

Backend-only commands:

```powershell
cd C:\Project\Groupware\backend
& C:\Project\Groupware\.tools\apache-maven-3.9.9\bin\mvn.cmd test '-Dmaven.repo.local=C:\Project\Groupware\.m2repo'
& C:\Project\Groupware\.tools\apache-maven-3.9.9\bin\mvn.cmd spring-boot:run '-Dmaven.repo.local=C:\Project\Groupware\.m2repo'
```

Health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080/api/v1/health
```

Frontend commands:

```powershell
cd C:\Project\Groupware\frontend
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

- The current approval model supports `PENDING`, `APPROVED`, and `REJECTED` document states. Draft, withdrawal, and cancellation are planned later and are not part of the current Phase 1 implementation.
- Live end-to-end login requires a running PostgreSQL database with the schema and seed data applied.
