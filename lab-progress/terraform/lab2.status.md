---
course: terraform
lab_number: 2
lab_name: Import Day 1-2 Infrastructure into Remote State
lab_instructions_path: I:/My Drive/CourseCreationKit/courses/Terraform_Day_3/labforge_iterations/iteration_1/Lab_02_Import_Legacy_Application.md
lab_starter_paths:
test_config_path: courses/terraform/tests/lab2.config.ts
test_spec_path: courses/terraform/tests/lab2-import-legacy-infra.spec.ts
registered_in_registry: true
last_updated: 2026-05-13
lab_instructions_hash: d43944b99cfdb0d574a066abf5e1a6983944dd352b8eb5aa5ea804ee1a2eaef7
lab_instructions_hashed_at: 2026-05-13
---

# Terraform Lab 2 — Import Legacy Application

## Phase A — Pre-test (scaffolding)

- [x] Lab markdown read & step inventory extracted
- [x] Manual inputs identified (env vars defined)
- [x] AWS / external prerequisites identified
- [x] Tool selection per step (CLI / Playwright / Nova Act)
- [x] Cleanup logic defined (resource tags / teardown order)
- [x] `lab2.config.ts` created
- [x] `lab2-import-legacy-infra.spec.ts` skeleton created
- [x] Registered in `lab-registry.ts`

## Phase B — Testing

- [x] Dry run passes (skeleton compiles, registry validates inputs)
- [x] First full run completed (any outcome)
- [x] All test steps pass (24/24 — 2.7 min wall time)
- [ ] QA bot review run (Stage 8.5)
- [x] Cleanup verified (0 resources left)
- [x] Last green run recorded in `last_green_run` field

## Notes / blockers

**Findings for the lab content team (Lab 2 markdown):**

1. **Step 10 (`-generate-config-out`) outcome.** ✅ **FIXED 2026-05-13 (commit 62a7afc on Advanced_Terraform main + lab markdown update).** Added a `lab2/import/generate-config-demo/` subfolder containing only `imports.tf` + `variables.tf` + `providers.tf` (local state, no backend). Lab markdown Steps 10-12 now instruct: `cd generate-config-demo`, run the demo, see the errors, `cd ..` back to `lab2/import/` for the real import. Test asserts the error fires + `generated.tf` has the expected mess. Lesson now lands as written.

2. **Inconsistent lifecycle commenting style between `network.tf` and `security-group.tf`.** `network.tf` ships with a live `lifecycle { }` block and an internally commented `# prevent_destroy = true`. `security-group.tf` ships with the entire lifecycle block commented (`# lifecycle {`, `# prevent_destroy = true`, `# }`). The student is told the same thing for both ("uncomment the lifecycle block") but the actual uncomment operation differs. Pick one convention.

**Test architecture decisions:**
- Self-contained: provisions its own state bucket inline (no Lab 1 dependency) since Day 1-2 normally provides it.
- Always deploys the lean VPC fallback in Step 2 (Step 1's branch condition is honored but in our flow there's no preexisting VPC).
- Step 10 assertion accepts both lab-as-documented (error) and repo-reality (success) outcomes.
