# Drawing Management UI Spec

Use this as the source of truth for the Phase 1 drawing management tab redesign.

## Goal

Redesign the drawing management tab from a form/list-centered page into a Vault-like workbench for finding, checking, and requesting drawing files.

The UI should reduce the chance of users accidentally using old revisions.

## Base Layout

The default screen uses four persistent areas:

- Top command/search bar.
- Left folder tree.
- Center drawing list.
- Bottom detail/preview area.

Do not include a persistent right-side properties panel in Phase 1.

## Top Bar

Top bar structure:

- Left: file registration button.
- Center: current selected path/breadcrumb.
- Right: integrated search.

Search behavior:

- Search fields: drawing number, file name, drawing title, revision, uploader/registrant.
- Default scope: currently selected tree node.
- Provide an option to search all drawings.

File registration behavior:

- Open an on-demand registration panel or modal.
- Prefill category/path context from the selected tree node.
- Registration button should be hidden or disabled for users without registration permission.

## Left Tree

Product drawing tree:

```text
제품도면
└─ 업체명
   └─ 프로젝트/제품명
      └─ 도면
```

Equipment drawing tree:

```text
설비도면
└─ 사업부
   └─ 공정
      ├─ 공통도면
      ├─ 설비명
      └─ 설비명
```

Common drawings and equipment folders are siblings under each process.

Do not show old-version folders in the left tree in Phase 1.

## Center Drawing List

The center list should show only the latest active revision by default.

Required columns:

- File name.
- Extension.
- Drawing number.
- Drawing title/name.
- Revision.
- Status.
- Uploader/registrant.
- Registration date.

Do not always show company, project, equipment, business unit, or process columns because the selected tree path already provides that context.

## Bottom Detail Area

Use four tabs:

- Preview.
- Revision history.
- Download request history.
- Properties.

Preview tab:

- PDF files should show an actual preview when technically available.
- CAD files should show a summary preview in Phase 1.
- Summary preview should include file extension, file name, drawing number, latest revision, status, download request action, and simple notes/context.

Revision history tab:

- Show older revisions here only.
- Users should not see older revisions as normal peer files in the center list.
- If a user requests a download for an older revision, show a clear old-version warning.

Download request history tab:

- Show download request status and approval/download availability.
- Approved downloads follow the existing 4-hour validity rule.

Properties tab:

- Show drawing metadata, path context, status, permission-related read indicators, and latest revision metadata.

## File Registration

Registration opens in a modal or slide panel so the workbench remains visible.

Fields:

- File.
- Drawing number.
- Drawing title/name.
- Revision label.
- Status.
- Memo/change note.

Context fields are prefilled from the selected tree node:

- Product: company/vendor and project/product.
- Equipment: business unit, process, common drawing or equipment.

Revision order:

- System-generated.
- First registration gets order 1.
- Additional revisions get the next order automatically.
- Users should not normally edit revision order in Phase 1.

## Latest Version Rule

The UI should strongly guide users toward the latest version:

- Center list shows latest revisions only.
- Old revisions are accessible only from the bottom revision history tab.
- No manual old-version folders.
- No old-version tree folders in Phase 1.
- Old revision download requests must display a warning.

## Acceptance Criteria

1. User can navigate product drawings by company and project/product.
2. User can navigate equipment drawings by business unit, process, common drawings, and equipment.
3. Selecting a tree node shows latest drawings only in the center list.
4. Center list shows the required file/drawing columns.
5. Selecting a drawing updates the bottom tabs.
6. PDF files can be previewed when supported.
7. CAD files show summary preview instead of CAD rendering.
8. Older revisions are visible only in revision history.
9. File registration preloads tree context.
10. Revision order is generated automatically.
11. Users without registration permission cannot register files.
12. Old revision download requests show an old-version warning.
