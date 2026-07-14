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
- `approval` owns electronic approval documents, lines, templates, delegations, operation settings, retention/audit flows, PDFs, and related workflow APIs.
- `board` and `notice` own board and notice APIs.
- `file` owns upload/download metadata and file access behavior.
- `pdm` owns drawing-management folders, documents, revisions, and related actions.
- `equipment` owns equipment masters, abnormal reports, assignment, completion-approval links, and equipment history APIs.
- `search` owns global search APIs.
- `emp`, `dept`, `role`, `code`, `notification`, and `log` own organization, role/code, notification, and audit-support APIs.
- Keep backend DTO and frontend type changes coordinated when API shapes change.

## Verification
- From `backend/`, set the repository root first: `$root = Split-Path -Parent (Get-Location)`.
- Backend tests: `& "$root\.tools\apache-maven-3.9.9\bin\mvn.cmd" test "-Dmaven.repo.local=$root\.m2repo"`.
- Backend local run: `& "$root\.tools\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run "-Dmaven.repo.local=$root\.m2repo"`.
- Health check after backend startup: `Invoke-WebRequest -UseBasicParsing http://localhost:8080/api/v1/health`.

## Child DOX Index
- `src/main/resources/db/AGENTS.md` - PostgreSQL baseline schema, seed data, patch SQL, and DB verification rules.
