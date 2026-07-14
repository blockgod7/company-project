# Drawing Management Phase 1 Spec

Use this as the source of truth for planning and implementation.

## Product Shape

The module is a controlled internal drawing repository for two categories:

- Product drawings: managed by company/customer/vendor, with strong latest-version and history control.
- Equipment drawings: managed by equipment, including common drawings shared across equipment.

It stores drawing files in the system. It is not a shared-folder link registry.

## Phase 1 Scope

- Drawing file upload and storage.
- Product/equipment drawing categories.
- Company/customer/vendor organization for product drawings.
- Equipment and common-group organization for equipment drawings.
- Metadata-based latest-version designation.
- Revision history.
- Global duplicate drawing-number warning.
- Administrator-managed permissions.
- Restricted view access.
- Download approval integrated with electronic approval.
- Download logs.
- Drawing status values: active, old version, voided/obsolete, and on-hold.
- Approved download validity: 4 hours after approval.
- Immutable revision files: registered files cannot be overwritten.
- Revision display value plus numeric latest-order value.
- Future bulk import readiness in the data model.

## Explicit Non-Goals

- OCR/AI metadata extraction.
- CAD web preview.
- BOM/Where-used.
- ECO change management.
- External customer/vendor access.
- Full Excel/CSV bulk import UI in phase 1.

## Key Rules

- Latest version is determined from uploaded metadata, not drawing-form recognition.
- Drawing number is unique to one drawing. If the same drawing number is uploaded as a new drawing, warn the user and guide them to register a revision or cancel.
- Admin grants registration, revision, view, and download-related permissions.
- Default viewing is restricted to related departments or granted users.
- Download is not direct: users with view access still request approval first.
- Approved downloads are valid for 4 hours after approval.
- Already registered revision files cannot be overwritten; corrections must preserve history.
- Revision labels may be free-form, but latest-version ordering should use a separate numeric order.
- Drawing management owns request creation and drawing context.
- Electronic approval owns approval handling and approval lists.

## Acceptance Criteria

1. Admin can grant drawing permissions.
2. Authorized user can upload product drawing files.
3. Product drawings are searchable by company/customer/vendor and drawing number.
4. New revisions update latest-version status automatically.
5. Revision history remains visible.
6. Same drawing-number new uploads trigger a popup warning.
7. Authorized user can upload equipment/common drawings.
8. Equipment drawings are searchable by equipment, group/folder, and drawing number.
9. Unauthorized users cannot view restricted drawings or files.
10. View-authorized users must request approval before download.
11. Drawing management can create download requests with reason and drawing context.
12. Electronic approval shows enough drawing context for approval decisions.
13. Approved requests unlock download for the requester for 4 hours.
14. Downloads are logged.
15. Registered revision files cannot be overwritten.
16. Drawing status supports active/latest, old version, voided/obsolete, and on-hold distinctions.

## Implementation Authority

Codex may decide screen layout, DB field names, permission codes, API shape, and internal class organization. Codex should ask again only before changing scope, security model, approval ownership, non-goals, or drawing-number uniqueness.
