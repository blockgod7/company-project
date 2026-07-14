# Deep Interview: Drawing Management

Metadata:
- Profile: Standard
- Rounds: 10
- Final ambiguity: 7%
- Threshold: 20%
- Type: Brownfield new module
- Context snapshot: `.codex/deep-interview/context/drawing-management-20260702-115209.md`

Clarity breakdown:

| Dimension | Score |
| --- | ---: |
| Intent | 0.96 |
| Outcome | 0.95 |
| Scope | 0.94 |
| Constraints | 0.92 |
| Success | 0.90 |
| Context | 0.92 |

## Intent

Build a first usable drawing management system after electronic approval phase 1. The system should replace loose shared-folder/manual tracking for controlled drawings, especially around latest-version certainty, revision history, access control, and approved downloads.

## Desired Outcome

Phase 1 should provide a real internal drawing repository with uploaded files, product/equipment drawing categories, metadata-based latest-version control, revision history, administrator-managed permissions, restricted viewing, and download approval integrated with the existing electronic approval experience.

## In Scope

- Top-level drawing management module.
- Product drawings managed by company/customer/vendor.
- Equipment drawings managed by equipment, with support for common drawings shared across equipment.
- File upload and system-managed storage.
- Required upload metadata such as drawing number, revision, revision/received date, company/customer/vendor, equipment, status/applicability.
- Automatic latest-version designation from metadata, not from OCR.
- Revision history for product and equipment drawings.
- Drawing-number duplicate warning based on drawing number alone.
- Administrator-managed registration, revision, view, and download-related permissions.
- Default view access limited to related departments or granted users.
- Download requires approval even when the user has view permission.
- Hybrid download approval model: drawing management starts the request and shows context; electronic approval owns approval task handling.
- Download history/audit tracking.
- Drawing status values such as active, old version, voided/obsolete, and on-hold.
- Approved downloads are available for 4 hours after approval.
- Already registered revision files cannot be overwritten.
- Revision display labels can be free-form, but latest-version ordering should use a separate numeric order.
- Data model should leave room for future Excel/CSV bulk import.

## Out Of Scope / Non-Goals

- OCR/AI automatic metadata recognition from drawing files.
- CAD web preview/viewer for DWG, DXF, STEP, and similar formats.
- BOM or Where-used tracing.
- Formal ECO change management.
- External customer/vendor account login or direct external access.
- Treating drawing management as only a metadata/link registry.
- Full Excel/CSV bulk import UI in phase 1.

## Decision Boundaries

Codex may decide:
- Screen composition and UI layout.
- DB field names and table structure.
- Permission code names.
- API endpoint structure.
- Internal service/class organization.

Codex must ask again if implementation would change:
- Phase-1 scope.
- Security model.
- Download approval ownership.
- Explicit non-goals.
- Drawing number uniqueness rule.

## Constraints

- Current repository has no implemented drawing module.
- Backend has an empty `pdm` package suitable as the new module home.
- Frontend routing/menu currently lives in `frontend/src/App.tsx`.
- Existing electronic approval module should remain the centralized approval work surface.
- Drawing file access must be permission-checked.

## Acceptance Criteria

1. Admin can grant drawing registration/revision/view/download-related permissions.
2. Authorized user can upload a product drawing file with metadata.
3. Product drawings can be found by company/customer/vendor and drawing number.
4. Uploading a newer revision automatically marks it as latest based on metadata.
5. Older revisions remain visible in drawing history.
6. Uploading the same drawing number as a new drawing triggers a popup warning and suggests registering it as a revision or canceling.
7. Authorized user can upload an equipment drawing under an equipment or common drawing group.
8. Equipment drawings can be searched by equipment, folder/group, and drawing number.
9. Unauthorized users cannot view restricted drawing records or files.
10. View-authorized users cannot download directly without approval.
11. A user can request a drawing download from drawing management with drawing context and reason.
12. The approval appears in electronic approval with enough context to identify drawing category, drawing number, revision, latest status, requester, and purpose.
13. Approver can approve or reject the download in electronic approval.
14. Approved requester can download the file within 4 hours after approval.
15. Download action is logged with user, drawing, revision/file, approval, and timestamp.
16. Registered revision files cannot be overwritten.
17. Drawing status distinguishes active/latest, old version, voided/obsolete, and on-hold drawings.

## Assumptions Resolved

- Latest-version control should not depend on reading drawing forms because formats vary.
- Drawing number is unique to one drawing and should trigger conflict warnings globally.
- Download approval should not become a separate disconnected approval island.
- Products and equipment both belong in phase 1, but with different management models.

## Pressure-Pass Findings

- A pure electronic approval approach risks losing drawing context.
- A drawing-only approval approach risks splitting approval work across modules.
- The selected hybrid keeps approval work centralized while preserving drawing-specific context.
- Duplicate drawing-number warnings are necessary to prevent silent mistakes in a metadata-driven latest-version model.

## Brownfield Evidence Vs Inference

Evidence:
- `frontend/src/App.tsx` currently owns the route union and sidebar menu.
- No drawing route or implemented drawing page was found.
- `backend/src/main/java/com/kjh/groupware/domain/pdm/package-info.java` exists, but no PDM implementation exists.
- Existing schema references drawing only as an equipment proposal attachment flag.
- `graphify-out/graph.json` exists and can support future codebase orientation.

Inference:
- The `pdm` backend package is the likely home for the drawing module.
- Existing file, auth, notification, and approval domains should be reused where possible.
- Electronic approval can be extended with a drawing download request template/type.

## Condensed Transcript

- User confirmed two drawing categories: product drawings and equipment drawings.
- Product drawings are managed by company/customer/vendor; latest-version and history matter most because external parties usually revise them.
- Equipment drawings are mostly internally created, managed by equipment, and may include common shared drawings.
- Files should be uploaded into the system, not only linked.
- Latest-version designation should be automatic from user-entered metadata.
- Registration/revision permissions should be admin-granted rather than hard-coded by department.
- View access is limited to related departments or granted users.
- Download requires approval even for users with view access.
- Download approval should use a hybrid model: request/context in drawing management, approval handling in electronic approval.
- Phase 1 excludes OCR, CAD preview, BOM/Where-used, ECO, and external access.
- Same drawing number should trigger duplicate warning globally.
- Codex may decide detailed design within these boundaries.

## Residual Risks

- Exact storage path and file retention policy still need technical design.
- Electronic approval integration needs careful UX so drawing context is obvious.
- Permission administration can become complex if not kept simple in phase 1.
- Revision comparison rules must handle non-numeric revisions such as A, B, C, 00, 01, R1, Rev.A by separating display labels from numeric latest-order values.
- Bulk import is not a phase-1 UI scope, but schema decisions should avoid blocking future Excel/CSV import.
