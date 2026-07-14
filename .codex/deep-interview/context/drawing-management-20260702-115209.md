# Deep Interview Context: Drawing Management

Task statement: Clarify requirements for a drawing management system after electronic approval phase 1 is considered complete.

Profile: Standard
Brownfield/greenfield: Brownfield new module inside C:\Project\Groupware

Known facts and evidence:
- Current frontend routes are centralized in `frontend/src/App.tsx`.
- Current route union has `dashboard`, `notices`, `boards`, `approvals`, `notifications`, `organization`, and `audit`; no drawing route was found.
- Current sidebar menu in `frontend/src/App.tsx` has dashboard, notices, boards, approvals, organization, and notifications.
- Backend domain packages include `pdm`, but only `package-info.java` exists under `backend/src/main/java/com/kjh/groupware/domain/pdm`.
- Repository search did not find existing drawing management implementation files.
- Existing schema only references drawing as an equipment proposal attachment flag (`attachment_drawing_yn`).
- Prior memory indicates the desired direction was PLM/Vault-style drawing management, not a simple upload box: top-level drawing menu, dashboard parent tab, product/equipment drawing explorer, revisions, download approval/logging, and future DB conversion considerations.

Constraints:
- Do not implement during interview.
- Ask one question per round.
- Clarify intent and boundaries before implementation details.

Unknowns:
- The core first-pass outcome.
- Who the primary users are.
- Drawing families are confirmed as product drawings and equipment drawings.
- Whether approval integration is required in phase 1.
- File storage is confirmed in scope for phase 1: drawing files themselves should be uploaded into the system.
- Versioning/latest-version control must operate against system-managed uploaded files.
- Migration/import expectations for existing drawings.
- View/download permission model is partly confirmed: default access is limited to related departments; system administrator grants view and download-related permissions; downloads require approval from someone with authority.

Decision-boundary unknowns:
- Codex may decide detailed screen composition, DB field names, permission codes, and API shape within the confirmed principles.
- Codex should ask again only if implementation would change the confirmed phase-1 scope, security model, approval ownership, or non-goals.
- Non-goals for phase 1 are mostly confirmed.

Likely touchpoints:
- `frontend/src/App.tsx`
- `backend/src/main/java/com/kjh/groupware/domain/pdm`
- `backend/src/main/resources/db/schema/groupware_schema.sql`
- `backend/src/main/resources/db/seed/local_seed.sql`
- Existing approval/file/auth domains

Round 0 answer:
- Drawing categories are product drawings and equipment drawings.
- Product drawings should be managed by customer/vendor/company. The important parts are history management and latest-version control.
- Product drawings are usually revised by the external company, so internal revision creation is rare. The business priority is knowing and controlling the latest drawing.
- Equipment drawings are mostly created internally.
- Equipment drawings should be managed by equipment, with some drawings shared/common across equipment.
- Equipment drawings require revision management and folder-like search by equipment.

Round 1 answer:
- The system should upload and store the drawing files themselves in phase 1.
- Phase 1 is not only a metadata registry or link-out to existing shared folders.

Round 2 answer:
- Latest-version detection should be automatic based on uploaded metadata, not by OCR/AI extraction from drawing forms.
- Required upload metadata can include drawing number, revision, revision date/received date, customer/vendor/company, equipment, and applicability/status.
- This avoids relying on drawing form recognition across inconsistent drawing layouts.

Round 3 answer:
- Product/equipment drawing registration and revision permissions should be granted by the system administrator.
- Do not hard-code editing responsibility only by department such as quality, sales, development, production engineering, or maintenance.

Round 4 answer:
- Default drawing visibility should be limited to related departments, not all employees.
- Download should require approval even for users who can view the drawing.
- View and download-related permissions should also be granted by the system administrator.

Round 5 answer:
- Download approval placement is undecided.
- User wants approvals centrally managed in the existing electronic approval area, but worries drawing download approvals may be hard to understand there without drawing context.
- User worries a separate lightweight approval feature inside drawing management would split the approval experience.
- A likely candidate is a hybrid: electronic approval owns approval tasks/inbox/status, while drawing management owns drawing-context request creation and context-rich detail.

Round 6 answer:
- The hybrid model is accepted for phase 1.
- Approval processing should be centralized in electronic approval.
- Drawing management should own download request creation and context-rich drawing details.
- Electronic approval list/detail should show enough drawing context so the approver understands which drawing, revision, category, requester, and purpose are being approved.

Round 7 answer:
- Phase 1 excludes OCR/AI automatic metadata recognition from drawing files.
- Phase 1 excludes CAD web preview/viewer for DWG, DXF, STEP, and similar CAD formats.
- Phase 1 excludes BOM/Where-used tracing.
- Phase 1 excludes formal ECO change management.
- Phase 1 excludes external customer/vendor login and direct external access.
- Phase 1 includes file upload/storage, product/equipment categories, customer/vendor and equipment-based organization, revision history, automatic latest-version designation from metadata, administrator-managed permissions, restricted view access, and electronic-approval-linked download approval.

Round 8 answer:
- Add a phase-1 success/safety criterion: if a user tries to upload the same drawing number without treating it as a revision, the system should show a popup/alert.
- This should prevent accidental duplicate uploads or silent replacement of an existing drawing number.

Round 9 answer:
- Duplicate warning should be based on drawing number alone.
- Drawing number should be treated as unique to one drawing, regardless of customer/vendor/equipment scope.
- If the same drawing number is uploaded as a new drawing, the system should alert and guide the user to register it as a revision or cancel.

Round 10 answer:
- User granted Codex authority to decide implementation details within the clarified principles.
- Decision boundary: Codex may decide screen layout, DB field names, permission codes, and API structure.
- Codex should reconfirm only if changing phase-1 scope, security model, approval ownership, or explicit non-goals.
