# Archived: pre-iteration_1 (DynamoDB locking) Lab 1 test files

**Archived:** 2026-05-13
**Reason:** Lab 1 was rewritten from "State Backend Setup & Locking Demo" (DDB locking,
top-level `04-lab-part1-state-backend.md`) to "Multi-Environment State Strategy"
(S3 native locking via `use_lockfile = true`, `labforge_iterations/iteration_1/Lab_01_*.md`).

These test files were built against the older DDB-based lab. Kept for reference only —
do NOT re-use directly; the new lab tests different concepts (workspaces, cross-state
dependencies, workspace safety guards).

Last successful run (pre-archive): 15/17 tests passed; 3 known issues identified
(DDB digest filter, AWS_PROFILE propagation in tfDestroy, Windows JSON arg escaping).
The latter two fixes apply to the helpers and have been carried forward to the new test.
