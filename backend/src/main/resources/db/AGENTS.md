# Database DOX

## Purpose
- `backend/src/main/resources/db/` contains PostgreSQL schema, seed, and patch SQL used by the backend.

## Ownership
- This file owns guidance for `schema/**` and `seed/**` SQL files.
- Runtime DB setup and verification scripts live at the repository root and should be checked before changing DB documentation.

## Local Contracts
- `schema/groupware_schema.sql` is the baseline schema file.
- The application uses JPA schema validation rather than automatic schema generation in the checked configuration.
- Schema changes should be expressed through reviewed SQL patches when a task explicitly allows DB work.
- Do not edit schema, seed, or patch SQL during documentation-only tasks.
- Do not record DB passwords, account passwords, tokens, or other secrets in AGENTS.md.
- Destructive local DB operations such as recreate/drop must be explicitly requested by the user.

## Work Guidance
- Current patch handling is driven by `setup-local-db.ps1`; verify the script before describing which patches are applied by default.
- `verify-local-db.ps1` checks local PostgreSQL availability, expected schema elements, seed state, and optional backend health.
- Keep patch order and idempotency clear when future DB changes are allowed.
- Do not treat old planning docs as proof that a schema feature is implemented; confirm with SQL files and current Java code.

## Verification
- From the repository root, DB verification script: `.\verify-local-db.ps1`.
- From the repository root, local DB setup script: `.\setup-local-db.ps1`.
- Use `.\setup-local-db.ps1 -Recreate` only when destructive rebuild behavior is explicitly requested.

## Child DOX Index
- No child AGENTS.md files are defined under this DB area.
