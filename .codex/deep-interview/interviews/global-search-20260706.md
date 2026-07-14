# Deep Interview: Home Global Search

## Summary

The user wants a global search tool on the home screen. Searching a word such as `김민수` should display all related results grouped by module. The first version should include all current modules and be extensible for future modules.

## Key Decisions

- Results stay on the home screen.
- Results are grouped by module.
- Every current searchable module is in scope.
- Future modules should be able to join through a backend extension pattern.
- Search covers DB text fields in the first version.
- Attachment body search is deferred.
- Result clicks navigate to the owning module/detail.
- Permission filtering is mandatory and server-side.
- Approval documents without read/review rights must not appear, not even by title.
- Admin-only groups appear only for admin users.

## Rounds

### Round 0

Question: Confirmed the topology of location, search targets, permission boundaries, result UX, and search method.

Answer: User agreed and added that results should be grouped by item/module type.

### Round 1

Question: Should all modules be included or only some in the first version?

Answer: Include everything, and include future items as they are added.

### Round 2

Question: How deep should search go: metadata only or content and attachment body?

Answer: User asked about the best approach, especially approval visibility.

### Round 3

Question: Should approval visibility follow existing access rights?

Answer: User confirmed documents without read rights should not show even by title.

### Round 4

Question: Should first version search DB text fields and defer attachment content?

Answer: User agreed.

### Round 5

Question: Should clicking a result navigate to the owning module/detail?

Answer: User agreed.

### Round 6

Question: Should admin-only data appear in global search?

Answer: User said admin-only data should appear only when logged in as admin.

### Round 7

Question: Confirmed success criteria: fast grouped results, drill-in navigation, and no unauthorized exposure.

Answer: User agreed.

### Round 8

Question: Can Codex choose result limits, ordering, labels, and backend extension structure?

Answer: User agreed, but requested a UI preview first.

### Round 9

Question: Should results be shown on the home screen or a separate integrated search page?

Answer: User chose home-screen inline results.
