# Groupware DOX

## Purpose
- This repository contains a Spring Boot backend, a React/Vite frontend, PostgreSQL schema scripts, Windows local-run scripts, and project documentation.
- DOX files are operational guidance for agents. They do not replace source code, database scripts, runtime settings, or API behavior.

## Ownership
- This root file owns cross-project workflow, top-level structure, git hygiene, and the Child DOX Index.
- Backend, frontend, and database-specific contracts are delegated to child AGENTS.md files.

## Local Contracts
- Before editing, read this file and every AGENTS.md from the repository root to the target path.
- Preserve existing source code, DB schema, configuration, README files, and docs unless the task explicitly asks to change them.
- If existing docs conflict with current code or settings, use the current code/settings as evidence and report the conflict instead of guessing.
- Do not record passwords, tokens, DB passwords, JWT secrets, or other sensitive values in AGENTS.md.
- Do not treat historical plans, `.github/modernize/**`, `.codex/**`, or `graphify-out/**` as current implementation without checking current files.
- Stage or publish only the files intentionally requested for the task. `.codex/**` currently contains local interview/spec notes and is outside normal publish scope unless requested.

## Work Guidance
- Keep AGENTS.md files concise, current, and operational.
- Update the closest owning AGENTS.md only when structure, contracts, commands, or durable workflow guidance changes.
- Add child AGENTS.md files only at durable responsibility boundaries with distinct rules, commands, or ownership.
- Use Windows/PowerShell commands for this repository unless the task states otherwise.
- `.\start-web.ps1` starts the current backend on port 8080 and frontend on `127.0.0.1:5174`; port 5173 remains available for the remote comparison project.
- `.\stop-web.ps1` stops only the current-project process trees recorded by `start-web.ps1`; run startup scripts only when runtime verification is intended.
- `graphify-out/GRAPH_REPORT.md` exists, but it was built from an older commit during this review; verify against current HEAD before relying on it.

## Verification
- General doc-only check: `git diff --check`.
- Command/path availability checks should include `.tools\apache-maven-3.9.9\bin\mvn.cmd`, `backend\pom.xml`, `frontend\package.json`, and `frontend\.env.example` before citing backend or frontend commands.
- Full runtime checks require local services such as PostgreSQL and are not automatic for doc-only edits.
- `.\verify-leave-work.ps1 -BackupFile <dump> -JavaHome <Java21>` runs leave/work acceptance on a new isolated PostgreSQL cluster, API 8081 and UI 5175; it never connects to the source DB and stops only its own services. See `backend/docs/leave-work-readiness-20260831.md` for fixture/date prerequisites.

## Child DOX Index
- `backend/AGENTS.md` - Spring Boot API, domain modules, backend commands, and backend documentation rules.
- `frontend/AGENTS.md` - React/Vite TypeScript app, route shell, API wrapper, and frontend commands.
