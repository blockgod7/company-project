# Groupware UI Redesign Deep Interview

## Metadata
- Profile: Standard
- Type: Brownfield
- Threshold: ambiguity <= 20%
- Final ambiguity: 10%
- Date: 2026-07-07
- Context: `.codex/deep-interview/context/groupware-ui-redesign-20260707-110544.md`

## Condensed Transcript

### Round 0 - Scope Topology
Question: Should the interview cover whole app UX, electronic approval UI, drawing/PDM UI, or all in priority order?

Answer: Cover 1 through 3 in order.

### Round 1 - Intent
Question: What is the core intent of the UI improvement?

Answer developed through follow-up: Since this is replacing existing groupware, the UI must serve real group users, not developers.

### Round 2 - Outcome
Question: Should the first deliverable be a redesign principle/guide document or a sample implemented screen?

Answer: A UI redesign principle/guide document first is better.

### Round 3 - Scope
Question: Should the guide be abstract principles only or an execution guide with component rules?

Answer developed through discussion: Execution guide is better, because it can keep later implementation consistent across screens.

### Round 4 - Success
Question: What makes the guide successful?

Answer: Actual users should be prioritized. The app is groupware, used by non-developers across varied ages.

### Round 5 - Critical Failures
Question: Which UI failure is most dangerous?

Answer: Most critical failures are inability to trust work status and inability to find what to do next.

### Round 6 - Representative Workflow
Question: Which workflow shows these risks most clearly?

Answer: Electronic approval is first priority; drawing/PDM history management follows.

### Round 7 - Decision Boundary
Question: Can Codex propose layout, button placement, status display, terminology, and priorities while asking again for data/policy/permission changes?

Answer: Yes.

### Round 8 - PDM Policy Boundary
Question: Is PDM control about file download only or overall drawing export/release behavior?

Answer: It is drawing export behavior overall. One reason for the system is preventing users from keeping many different local versions and using the wrong file.

### Round 9 - Non-Goals
Question: Should v1 exclude strong DRM/screenshot prevention and focus on UI, permission flow, export record, and latest-version guidance?

Answer developed through discussion: Yes. DRM and complete screenshot prevention are too heavy for v1.

### Round 10 - Security Scope Confirmation
Question: Confirm v1 PDM scope as viewer-centered viewing plus export approval/logging, watermarking, and latest-version guidance, with DRM/complete screenshot prevention deferred to v2?

Answer: 좋다.

## Pressure-Pass Findings
- The original idea of "download approval" was challenged because viewer printing/PDF conversion can bypass download-only control.
- The stronger requirement is not just security but preventing uncontrolled local copies and version drift.
- Therefore PDM UX must treat download, print, PDF conversion, and external sharing as export/release behavior.

## Final Clarity Scores
- Intent: 0.95
- Outcome: 0.90
- Scope: 0.86
- Constraints: 0.90
- Success: 0.88
- Context: 0.86
