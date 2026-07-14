# Groupware UI Redesign Context

## Task Statement
Create a UI redesign principle and execution guide before changing screens. The redesign scope covers the whole app UX first, then electronic approval UI, then drawing/PDM UI.

## Probable Intent
The product is intended to replace an existing groupware system used by an organization. The main users are non-developers across varied age groups. The redesign must prioritize operational trust and discoverability over visual novelty.

## Known Facts And Evidence
- Current frontend is React/TypeScript with many screens concentrated in `frontend/src/App.tsx`.
- Current shared styling is in `frontend/src/styles.css`.
- Main routes include dashboard, approvals, PDM/drawing management, notifications, organization, audit, boards, and notices.
- Electronic approval and PDM/drawing management are existing modules, not greenfield features.
- Existing memory for this checkout indicates the user values real workflow fidelity, exact errors, realistic approval UI behavior, and PDM latest-version/history behavior.
- `graphify-out/` exists and can be used for later architecture/file relationship questions.

## Confirmed Priorities
1. UI redesign guide should be written before implementation.
2. Guide should be execution-oriented, not only abstract principles.
3. Primary user concern: users must trust work status and quickly find what to do next.
4. First workflow priority: electronic approval.
5. Second workflow priority: drawing/PDM history management.
6. PDM export control is about drawing release/export behavior broadly, not just file download.

## Constraints
- Users are non-developers with diverse ages.
- UI must support repeated real work, not marketing-style presentation.
- Existing business meaning, approval authority, permissions, and data policy must not be changed silently.
- Strong security such as DRM and complete screenshot prevention is not v1 scope.

## Decision Boundaries
Codex may propose detailed UI layout, button placement, status labels, component rules, information hierarchy, and screen priorities.

Codex must ask again before changing business policy, approval authority, permission meaning, retention policy, or strong security/DRM assumptions.

## Non-Goals
- Do not implement source changes during the interview/spec phase.
- Do not design full DRM, endpoint protection, or complete screenshot prevention in v1.
- Do not turn the app into a landing page or decorative dashboard.
- Do not make all screens equally broad in phase 1; approval comes first, PDM history second.

## Likely Touchpoints For Later Implementation
- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- Approval screens and components inside `ApprovalPage`, detail views, approval line editor, stamp views, dashboard cards.
- PDM screen inside `DrawingManagementPage`, including tree, list, preview, revisions, download/export request, permissions, and status labels.
