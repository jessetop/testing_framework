---
course: terraform
lab_number: 1
lab_name: Multi-Environment State Strategy
lab_instructions_path: I:/My Drive/CourseCreationKit/courses/Terraform_Day_3/labforge_iterations/iteration_1/Lab_01_Multi_Environment_State_Strategy.md
lab_starter_paths:
test_config_path: courses/terraform/tests/lab1.config.ts
test_spec_path: courses/terraform/tests/lab1-multi-env-state.spec.ts
registered_in_registry: true
last_updated: 2026-05-13
lab_instructions_hash: d7b039b7a6ee1e1d2300abc3b8f693a488955147ec3149a65b69adeca31964b9
lab_instructions_hashed_at: 2026-05-13
---

# Terraform Lab 1 — Multi-Environment State Strategy

## Phase A — Pre-test (scaffolding)

- [x] Lab markdown read & step inventory extracted
- [x] Step inventory file authored (`lab1.inventory.ts`)
- [x] Manual inputs identified (env vars defined)
- [x] AWS / external prerequisites identified
- [x] Tool selection per step (CLI / Playwright / Nova Act / manual)
- [x] Cleanup logic defined (resource tags / teardown order)
- [x] `lab1.config.ts` created
- [x] `lab1-multi-env-state.spec.ts` skeleton created
- [x] Registered in `lab-registry.ts`

## Phase B — Testing

- [x] Dry run passes (skeleton compiles, registry validates inputs)
- [x] First full run completed (any outcome)
- [x] All automated steps pass
- [x] Manual-only steps documented and surfaced in test report
- [ ] QA bot review run (Stage 8.5)
- [x] Cleanup verified (0 resources left)
- [x] Last green run recorded in `last_green_run` field

## Notes / blockers

**Lab topic (per iteration_1):** Multi-Environment State Strategy. Covers Terraform workspaces, workspace safety guards (`null_resource` + preconditions), cross-state dependencies (`terraform_remote_state`), and the workspaces-vs-directory-structure decision framework.

**Locking:** S3 native locking (`use_lockfile = true`), not DynamoDB. Requires Terraform >= 1.10.0.

**Lab files:** External git repo — `github.com/AWSClassroom-com/Advanced_Terraform` → `lab1/state-infra/`, `lab1/networking/`, `lab1/directories/`. Test must clone this repo into the per-student workspace.

**Step inventory (35 numbered steps, 4 tasks + bonus + cleanup):**
- Task 1 (steps 1-10): workspace fundamentals — clone, init, create/select/delete workspaces
- Task 2 (steps 11-16): workspace safety guard — apply state bucket, migrate to remote, test guard blocks `default`/invalid workspaces, feature workspace
- Task 3 (steps 17-22): cross-state dependencies — deploy networking state, read via `terraform_remote_state`, verify VPC ID matches
- Task 4 (steps 23-25): state inspection — `terraform state pull`, `jq` queries, conceptual force-unlock
- Task 5 (steps 26-29): review directory-structure alternative (review-only, no apply)
- Bonus (step 30): materialize prod workspace state to demonstrate isolation
- Task 6 (steps 31-35): cleanup — state rm bootstrap resources, destroy, delete workspaces, optionally rb bucket

**Strategy distribution (estimate):** ~22 local-cli, ~3 aws-cli, ~10 manual-only (conceptual reviews and decision points). No `aws-ui` steps. No `external-ui`. No `local-install`.

**Manual inputs:**
- `TERRAFORM_STUDENT_ID` (e.g. `student99`)
- `TERRAFORM_REGION` (e.g. `us-east-2` — instructor-assigned; the lab references it but doesn't pick one)
- `AWS_PROFILE` (default `roitraining`)

**Carried-over helper bug fixes from pre-archive Lab 1 run:**
- `tfDestroy()` must accept + pass `AWS_PROFILE` (cleanup hit `InvalidClientTokenId` without it)
- `emptyVersionedBucket()` must pass `--delete` JSON via file:// on Windows (shell strips quotes)
- DDB digest filter no longer relevant (S3 native locking has no DDB items)

**Note on "hardcoded provider region" finding** (withdrawn 2026-05-13): the lab markdown DOES instruct students to check and update the region in providers.tf. My earlier finding was incorrect — students who follow the lab will correctly update both provider and backend regions.

**Previous test files** (pre-DDB-version) archived at `courses/terraform/tests/_archive/2026-05-13_pre-iteration1-ddb/`. Helpers under `courses/terraform/helpers/` are kept (tool-level, not lab-specific) with the two fixes above pending.
