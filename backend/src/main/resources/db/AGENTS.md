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
- `training_workflow_20260831_patch.sql` registers education workflow templates after the legacy training patch. It is rerunnable without relying on a template-code/version unique constraint; existing document snapshots are unchanged.
- Current patch handling is driven by `setup-local-db.ps1`; verify the script before describing which patches are applied by default.
- `verify-local-db.ps1` checks local PostgreSQL availability, expected schema elements, seed state, and optional backend health.
- Keep patch order and idempotency clear when future DB changes are allowed.
- `schema/work_request_type_20260831_patch.sql` runs after the work-request management patch and repairs legacy three-type constraints without updating business rows. It can also be applied alone to an existing work-request schema; it is transactional and preserves the employee/date credit limit.
- Current portal/menu personalization, employee extension, revised annual-leave data, confirmed contract terms, and work-request management are applied by `portal_menu_personalization_202608_patch.sql`, `employee_contact_extension_202608_patch.sql`, `annual_leave_calculation_revision_202608_patch.sql`, `contract_employee_terms_202608_patch.sql`, and `work_request_management_202608_patch.sql` in that order. `employee_affiliation_20260821_patch.sql` runs after the employee seed so its PDF-confirmed affiliations and production-family managers remain authoritative.
- Keep the portal-menu patch rerunnable after `uq_menu_code` exists; legacy rows that map to an existing canonical menu code must remain inactive `LEGACY_DUPLICATE_<menu_id>` rows.
- E9024 belongs to `HR_ADMIN` per user confirmation on 2026-08-31; keep affiliation patches and verification aligned. Do not restore the historical VCB department or impose its production-manager assertion; the current manager is not changed by this correction.
- Do not treat old planning docs as proof that a schema feature is implemented; confirm with SQL files and current Java code.

## Verification
- From the repository root, DB verification script: `.\verify-local-db.ps1`.
- `.\verify-local-db.ps1 -WorkRequestOnly` runs `verify/work_request_integrity.sql` in a read-only snapshot, checking work types, source links, duplicate-credit protection and ledger balances without unrelated employee/seed assertions. It cannot be combined with `-ApplyLeavePatch`. Historical fractional credits are reported and preserved.
- From the repository root, local DB setup script: `.\setup-local-db.ps1`.
- Use `.\setup-local-db.ps1 -Recreate` only when destructive rebuild behavior is explicitly requested.

## Child DOX Index
- No child AGENTS.md files are defined under this DB area.
