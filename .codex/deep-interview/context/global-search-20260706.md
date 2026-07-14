# Deep Interview Context: global-search

Task statement: Add a search tool at the top of the home screen so a user can enter a word and find everything related to it.

Stated solution:
- Home screen top search tool.
- Querying a specific word should search all related things.

Probable intent:
- Give users one fast entry point instead of visiting notices, boards, approvals, PDM, organization, and notifications separately.
- Make cross-module discovery possible from the dashboard.

Known facts and evidence:
- Frontend route type includes dashboard, notices, boards, approvals, pdm, notifications, organization, and audit in `frontend/src/App.tsx`.
- `Dashboard` is rendered when `route === "dashboard"` and current topbar already contains a search icon without an input.
- Existing module-local searches exist in organization/approver pickers and PDM.
- Backend has module APIs for notices, boards, approvals, PDM, employees, notifications, and audit.
- Approval listing already accepts a `keyword` parameter.
- PDM drawing listing already accepts `category` and `keyword` parameters.

Confirmed user intent:
- Search results should be grouped by item/module type.
- Electronic approvals should appear together, board results together, and so on, instead of mixing every result into a single flat list.
- The first version should include every current searchable module.
- Future modules/items should be able to join global search as they are added, instead of rebuilding the home search each time.
- Approval search must not expose documents the current user cannot read, including titles.
- For approvals, visibility should follow actual access rights: requester/approval line/receiver/reference/reader/delegation or equivalent existing approval permission logic.
- First version search depth should cover database text fields: titles, document numbers, authors/requesters, body/content, form field values, drawing numbers, drawing names, filenames, descriptions, departments, and employee names.
- Attachment internal content search for PDF/Excel/Word body text is out of scope for the first version and should be treated as a later phase.
- Clicking a search result should navigate to the owning module and open or select the specific item when possible.
- Examples: approval detail, board post detail, notice detail, PDM drawing selected in drawing management, employee/org location.
- Admin-only data such as audit logs or admin settings may appear in global search only when the current login has admin privileges.
- Non-admin users should not see admin-only result groups or existence hints.
- First version success means: grouped module results appear quickly after keyword input, result clicks move to the matching module detail/selection, and unauthorized items are not exposed even by title.
- Codex may choose exact result limits, module ordering, result labels, and backend extension interface to fit the existing codebase.
- Before implementation, user wants to see an expected UI mockup for searching the name "김민수".
- Search results should be displayed directly on the home screen, not on a separate integrated search page.
- The home result panel is the primary browsing surface; result clicks are for drilling into module details.

Constraints:
- Brownfield feature in existing Spring Boot + React app.
- Must respect existing authentication and permission boundaries.
- Do not implement during deep interview.

Unknowns:
- Final visual density and placement can be refined during implementation while preserving the home-screen grouped-results model.

Decision-boundary unknowns:
- Can Codex choose the minimum viable module list?
- Can Codex choose one global endpoint design?
- Can Codex defer full-text indexing/file-content search?
- Can Codex define result ranking and result labels?

Likely touchpoints:
- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/src/types.ts`
- New backend global search controller/service/dto/repositories
- Existing query services and repositories for approval, PDM, notice, board, emp, notification
- Tests around permission filtering and result links
