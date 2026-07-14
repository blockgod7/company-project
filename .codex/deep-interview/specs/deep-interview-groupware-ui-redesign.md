# Groupware UI Redesign Execution Guide v1

## Metadata
- Profile: Standard
- Rounds: 10
- Final ambiguity: 10%
- Threshold: 20%
- Type: Brownfield
- Context: `.codex/deep-interview/context/groupware-ui-redesign-20260707-110544.md`
- Interview: `.codex/deep-interview/interviews/groupware-ui-redesign-20260707-110544.md`

## Clarity Breakdown

| Dimension | Score |
| --- | ---: |
| Intent | 0.95 |
| Outcome | 0.90 |
| Scope | 0.86 |
| Constraints | 0.90 |
| Success | 0.88 |
| Context | 0.86 |

## Intent
The UI redesign must help this system replace an existing groupware product for real organization-wide use. The primary users are non-developers across varied age groups. The interface must make users trust work status and immediately understand what to do next.

## Desired Outcome
Create an execution-oriented UI guide that can drive later implementation across the app, with first priority on electronic approval and second priority on drawing/PDM history management.

## Core Principle
Every major screen must answer two questions without effort:

1. What is the current work status?
2. What is my next valid action?

Visual polish is secondary to status trust, action discoverability, and repeat-work efficiency.

## Product Priorities

### Priority 1: Electronic Approval
Electronic approval is the most important redesign target because it proves whether users can trust the replacement groupware.

The UI must make these things obvious:
- Which documents need my action.
- Which documents I requested and where they are blocked.
- Who has acted, who has not acted, and when.
- Whether a document is draft, submitted, pending, rejected, withdrawn, approved, completed, deleted, or restored.
- Which action is currently allowed: approve, reject, receive, complete receipt, withdraw, redraft, delete, restore, print, or download PDF.
- Why an action is unavailable.

### Priority 2: Drawing/PDM History Management
PDM must make latest-version use and drawing history trustworthy. The goal is not only security; it is preventing users from storing and using uncontrolled local copies.

The UI must make these things obvious:
- Which drawing is the latest valid version.
- Which revisions are old, held, voided, or deleted.
- Which file is being viewed.
- Whether a user is viewing inside the system or exporting the drawing.
- Who exported a drawing, why, when, and which revision.
- Whether a user is about to use an obsolete drawing.

## In Scope
- UI redesign principles for the full app.
- Execution rules for layout, navigation, buttons, tables, forms, modals, tabs, status labels, and action areas.
- Electronic approval screen guidance.
- Drawing/PDM history and export-flow guidance.
- Viewer-centered PDM behavior.
- Export approval/logging concepts for download, print, PDF conversion, and external handoff.
- Watermarking guidance for viewer and exported/printed output.
- Latest-version guidance and obsolete-version warnings.

## Out Of Scope / Non-Goals
- Source implementation during this interview.
- Full DRM design.
- Complete screenshot prevention.
- OS-level endpoint controls or required local security agents.
- Changing approval authority, permission meaning, or business policy without a separate decision.
- Decorative dashboard redesign that hides real work.
- Marketing-style landing pages.
- Replacing domain-specific forms with generic cards when form fidelity matters.

## Decision Boundaries
Codex may decide:
- Screen hierarchy.
- Layout and spacing direction.
- Button grouping and placement.
- Status label wording proposals.
- Table, filter, form, modal, tab, and toolbar rules.
- Which UI elements should be promoted, demoted, merged, or removed.
- Electronic approval and PDM screen-by-screen improvement checklist.

Codex must ask before changing:
- Approval policy or authority.
- Permission semantics.
- Data retention or audit policy.
- Strong security approach such as DRM or endpoint control.
- Whether printing/PDF export requires formal approval in each business case.

## Global UI Rules

### Navigation
- Keep the left navigation predictable and stable.
- Use plain business terms, not implementation terms.
- Surface "my work" and urgent work from the dashboard.
- Avoid hiding primary workflows behind generic settings or nested menus.

### Page Layout
- Use dense but organized operational layouts.
- Prefer clear page sections over decorative nested cards.
- Put primary actions near the context they affect.
- Keep detail screens anchored by status, owner, current step, and next action.

### Status Display
- Status must be text plus color, never color alone.
- Use consistent status placement in lists and detail headers.
- Show last updated time or acted time where trust matters.
- For blocked workflows, show who or what is blocking progress.

### Actions
- Primary action must be visually clear and near the relevant document/drawing.
- Destructive actions must be separated and confirmed.
- Disabled actions should explain why they are unavailable.
- Avoid hidden action menus for high-frequency work unless the page is crowded.

### Tables And Lists
- Tables should support scanning: title/identifier first, status and owner near the front, dates aligned, action at the end.
- Important rows should not require opening detail just to know status.
- Filters should use business labels and preserve the user's mental model.

### Forms
- Prefer selects or pickers when the value should already exist.
- Group fields by user task, not database shape.
- Make required fields visible before submit.
- Show exact validation messages.

### Modals
- Use modals for focused decisions: confirm, short create/edit, export reason, permission grant.
- Avoid large workflow authoring inside modals when a full page would be clearer.

## Electronic Approval Guidance

### Dashboard Entry
- Dashboard cards should lead directly to actionable boxes: 내 결재대기, 대리대기, 기한초과, 진행문서, 최근완료.
- Counts must match the destination filter.
- If counts fail to load, show an explicit error or fallback state, not silent emptiness.

### Approval List
- The list must show document title, document number, requester, current status, current actor/blocker, requested date, due/acted dates, and next available action.
- Filters should clearly distinguish "내가 처리할 문서" from "내가 올린 문서".
- Status correction/admin actions should not compete visually with normal user actions.

### Approval Detail
- Detail header must show current state, current step, requester, document number, and the next valid action.
- Approval line/stamp area must reflect the actual flow, not a fixed visual assumption.
- Opinions and acted history should be inline and chronological.
- Reject, approve, receive, and receipt-complete actions should collect comments in context.
- Print/PDF actions should make it clear whether the document is final, draft, or historical.

## Drawing/PDM Guidance

### Drawing Browser
- Product and equipment drawing separation must stay clear.
- Tree, breadcrumb, list, and detail selection must always agree.
- The selected folder/path must be visible while browsing.
- Search should not make users lose their current context without a clear reset.

### Latest Version And History
- The latest valid revision should be visually dominant.
- Old, on-hold, voided, and deleted revisions must be unmistakable.
- Users should see revision history without downloading files.
- If a user opens an old revision, show a warning with a path to the latest revision.

### Viewer-Centered Use
- Default behavior should encourage viewing drawings inside the system.
- Viewer should display drawing number, revision, status, and watermark context.
- The UI should avoid nudging users to local download for normal viewing.

### Export / Release Behavior
Treat download, print, PDF conversion, and external sharing as "drawing export" behavior.

For v1, export should support:
- Export reason.
- Export target or purpose when practical.
- User, department, time, drawing number, and revision logging.
- Approval where business policy requires it.
- Watermarking in viewer and exported/printed output.
- Strong warnings for old/voided/deleted revisions.

### Security Scope
- v1 does not attempt full DRM or complete screenshot prevention.
- v1 should still reduce uncontrolled local file use by making system viewing easier than exporting.
- v2 may evaluate DRM, endpoint agents, clipboard/screenshot prevention, file expiry, or external viewer control.

## Testable Acceptance Criteria
- A non-developer can identify their pending approval work from the dashboard without training.
- An approval detail page shows current status, blocker/current actor, and next action above the fold.
- A user can distinguish requested documents from documents awaiting their approval.
- Approval action buttons are not hidden away from the document context.
- PDM users can identify the latest valid drawing revision from list/detail/history views.
- PDM users receive a clear warning before using an old, on-hold, voided, or deleted drawing.
- PDM export actions collect or display reason, user, time, drawing number, and revision.
- The UI does not imply that download-only approval is sufficient control when print/PDF export exists.
- Disabled or unavailable actions explain why.
- The guide can be converted into a screen-by-screen implementation checklist.

## Assumptions Exposed And Resolved
- "All UI at once" is possible only if driven by shared guide first, not simultaneous deep redesign.
- "Download approval" is too narrow because viewer printing/PDF conversion can also externalize drawings.
- The PDM goal includes central latest-version use, not just confidential-file protection.
- v1 should be practical and lightweight; heavy DRM/screenshot prevention moves to v2.

## Brownfield Evidence Vs Inference
- Evidence: `frontend/src/App.tsx` contains main route and module surfaces including dashboard, approvals, and PDM.
- Evidence: `frontend/src/styles.css` contains shared UI styling and PDM/approval-specific styles.
- Evidence: `graphify-out/` exists for later code relationship analysis.
- Inference: A UI guide should be implemented first because shared CSS and centralized app structure increase the risk of inconsistent ad hoc redesign.

## Handoff Options
1. Convert this guide into a concrete implementation plan.
2. Start implementation with electronic approval UI as the first screen family.
3. Continue interview only for PDM export policy details.
4. Keep this as a clarified design artifact for later.
