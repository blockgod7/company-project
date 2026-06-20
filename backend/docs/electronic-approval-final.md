# Electronic Approval Finalization

## Completion Status

Electronic approval is complete for the first production-ready pass.

Completed core scope:

- Draft, edit, submit, withdraw, cancel, reject, redraft.
- Agreement, sequential approval, receive, complete receipt.
- Reference/reader visibility.
- Template management and versioning.
- Personal and template default approval lines.
- Delegation, delegated action history, inactive/leave assignee blocking.
- Due dates and delayed reminders.
- Dashboard cards and drill-down filters.
- Attachment and PDF permission checks.
- Final approval PDF generation and regeneration.
- Operation settings managed from DB/UI.
- Admin retention delete, restore, status correction, and retention audit report.
- Standardized approval boxes and unified action endpoint.

## Roles

- `ADMIN`
  - Full system and approval operation access.
  - Can view all approval documents.
  - Can manage templates, default lines, operation settings, retention delete/restore, status correction, and retention audits.

- `APPROVAL_ADMIN`
  - Approval operation administrator.
  - Can manage approval templates, template default lines, operation settings, retention delete/restore, status correction, and retention audits.
  - Can view all approval documents.

- `AUDIT_ADMIN`
  - Audit/all-document viewing role.
  - Does not manage approval operation settings or templates.

- `MANAGER`, `USER`
  - Normal approval users.
  - Access is limited to requester, assigned line, delegated line, receiver, reference, and reader visibility.

## Main APIs

Document lifecycle:

- `POST /api/v1/approvals`
- `POST /api/v1/approvals/drafts`
- `GET /api/v1/approvals`
- `GET /api/v1/approvals/{approvalId}`
- `PUT /api/v1/approvals/{approvalId}/draft`
- `POST /api/v1/approvals/{approvalId}/submit`
- `POST /api/v1/approvals/{approvalId}/actions/{action}`

Supported unified actions:

- `approve`
- `reject`
- `withdraw`
- `cancel`
- `redraft`
- `receive`
- `complete-receipt`
- `status-correction`
- `regenerate-pdf`

Boxes and dashboard:

- `GET /api/v1/approvals/boxes`
- `GET /api/v1/approvals/dashboard`
- `GET /api/v1/approvals?dashboardFilter=myPending`
- `GET /api/v1/approvals?dashboardFilter=delegatedPending`
- `GET /api/v1/approvals?dashboardFilter=overdue`
- `GET /api/v1/approvals?dashboardFilter=requestedInProgress`
- `GET /api/v1/approvals?dashboardFilter=recentCompleted`

Templates and default lines:

- `GET /api/v1/approval-templates`
- `GET /api/v1/approval-templates/manage`
- `POST /api/v1/approval-templates`
- `PATCH /api/v1/approval-templates/{templateCode}/status`
- `GET /api/v1/approval-default-lines/effective`
- `PUT /api/v1/approval-default-lines/me`
- `GET /api/v1/approval-default-lines/templates/{templateCode}`
- `PUT /api/v1/approval-default-lines/templates/{templateCode}`

Delegation:

- `GET /api/v1/approval-delegations/me`
- `PUT /api/v1/approval-delegations/me`
- `DELETE /api/v1/approval-delegations/me`

PDF and files:

- `GET /api/v1/approvals/{approvalId}/pdf`
- `POST /api/v1/approvals/{approvalId}/pdf/regenerate`
- `GET /api/v1/files/{fileId}/download`

Operations and retention:

- `GET /api/v1/approval-operation-settings`
- `PUT /api/v1/approval-operation-settings`
- `DELETE /api/v1/approvals/{approvalId}`
- `GET /api/v1/approvals/deleted`
- `POST /api/v1/approvals/{approvalId}/restore`
- `GET /api/v1/approvals/retention-audits`
- `GET /api/v1/approvals/retention-audits/export`

## Operation Settings

DB-backed approval operation settings:

- `DECISION_DUE_HOURS`
  - Default: `72`
  - Controls due date assigned when an agreement/approval line opens.

- `REMINDER_FIXED_DELAY_MS`
  - Default: `300000`
  - Controls the minimum delayed-reminder scan interval.

- `DELETED_DOCUMENT_RETENTION_DAYS`
  - Default: `1825`
  - Controls the retention policy value shown for soft-deleted approval documents.

- `PERMANENT_DELETE_ENABLED`
  - Default: `false`
  - Physical permanent deletion is intentionally not exposed while this policy remains disabled.

Fallback environment settings remain available for bootstrapping:

- `APPROVAL_DECISION_DUE_HOURS`
- `APPROVAL_REMINDER_FIXED_DELAY_MS`
- `APPROVAL_REMINDER_SCHEDULER_TICK_MS`

## Database Patches

Existing databases must have these approval patches applied as needed:

- `backend/src/main/resources/db/schema/approval_phase1_patch.sql`
- `backend/src/main/resources/db/schema/approval_phase3_patch.sql`
- `backend/src/main/resources/db/schema/approval_phase5_default_line_patch.sql`
- `backend/src/main/resources/db/schema/approval_phase7_delegation_patch.sql`
- `backend/src/main/resources/db/schema/approval_operation_setting_patch.sql`

The baseline schema is:

- `backend/src/main/resources/db/schema/groupware_schema.sql`

## Final Verification

Last verified:

- Backend tests: `mvn test`
  - Tests run: 11
  - Failures: 0
  - Errors: 0

- Backend package: `mvn package -DskipTests`
  - Success

- Frontend build: `npm.cmd run build`
  - Success

- Runtime smoke:
  - Backend health OK.
  - Admin operation settings read/update OK.
  - Approval dashboard drill-down filters OK.
  - Deleted approval list/restore OK.
  - Retention audit report and CSV export OK.
  - Normal user forbidden checks OK where expected.

## Deferred Items

The following are intentionally deferred and should be treated as later enhancements, not blockers for the current approval release:

- Physical permanent deletion execution.
  - Current policy is DB/UI managed and defaults to disabled.
  - A future implementation should require retention period checks, explicit operation setting enablement, confirmation text, audit logging, and ideally backup/export review.

- Advanced administrator operation summary cards.
  - Current dashboard and drill-down are user-focused.
  - Future cards can summarize organization-wide delays, department/template volumes, and processing time.

- Full E2E browser automation suite.
  - Current backend tests, frontend build, API smoke, and browser smoke have been used during implementation.
  - A later suite can automate submit-to-approval, reject-redraft, delegation, inactive assignee blocking, retention restore, and PDF permission flows.

- Advanced template/PDF designer.
  - Current dynamic fields and PDF generation cover the first pass.
  - Drag-and-drop form design, refined print layout, watermark policy, and signature image quality can be improved later.
