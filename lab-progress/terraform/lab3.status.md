---
course: terraform
lab_number: 3
lab_name: Pipeline Operations
lab_instructions_path: I:/My Drive/CourseCreationKit/courses/Terraform_Day_3/labforge_iterations/iteration_1/Lab_03_Pipeline_Operations.md
lab_starter_paths:
test_config_path: courses/terraform/tests/lab3.config.ts
test_spec_path: courses/terraform/tests/lab3-pipeline-operations.spec.ts
registered_in_registry: true
last_updated: 2026-05-13
lab_instructions_hash: bf58313313509c28e93ca3db18baf819a9255ad9b70f8624def97b0647f7cdb5
lab_instructions_hashed_at: 2026-05-13
---

# Terraform Lab 3 — Deploy Pipeline & Promote Changes

## Phase A — Pre-test (scaffolding)

- [x] Lab markdown read & step inventory extracted
- [x] Manual inputs identified (env vars defined)
- [x] AWS / external prerequisites identified
- [x] Tool selection per step (CLI / Playwright / Nova Act)
- [x] Cleanup logic defined (resource tags / teardown order)
- [x] `lab3.config.ts` created
- [x] `lab3-pipeline-operations.spec.ts` skeleton created
- [x] Registered in `lab-registry.ts`

## Phase B — Testing

- [x] Dry run passes (skeleton compiles, registry validates inputs)
- [x] First full run completed (any outcome)
- [x] All automated steps pass (25/25, 7 properly skipped — 12.8 min wall time)
- [ ] QA bot review run (Stage 8.5)
- [x] Cleanup verified (0 resources left)
- [x] Last green run recorded in `last_green_run` field

## Notes / blockers

**Findings for the lab content team (Lab 3):**

1. **S3 artifacts bucket name not globally unique.** ✅ **FIXED 2026-05-13 (commit 1119ddb on Advanced_Terraform main).** Added `random_string.artifacts_suffix` resource and updated IAM policies to reference `aws_s3_bucket.artifacts.arn` directly. Test no longer needs the workaround patch.

2. **CodeCommit auth on Windows is fragile** — but this is a **local-Windows-testing artifact**, not a lab content issue. Students run the lab on EC2 instances with IAM instance profiles, where the credential helper resolves via instance metadata. No Git Credential Manager interference. The test's URL-embedded-creds workaround is only needed because we're running the test suite locally on a Windows machine. Long-term: move test execution to EC2 to match student environment.

3. **Lab markdown vs repo discrepancies** (many — likely needs a doc-content pass):
   - Lab text says "deploy to staging (us-east-2) → prod (us-west-2)". The repo deploys staging to **us-east-1**, prod to us-west-2.
   - Lab text describes deploying VPC + EC2 + Apache. The repo's `app-repo/` uses an SSM-parameter module (no EC2, no VPC). Acknowledged in iteration_1 advisories but not yet fixed in prose.
   - Lab text calls the CodeCommit repo `${userxx}-webapp`. The repo creates `${student_id}-terraform-repo`.
   - Lab text uses `account` variable. The repo's `variables.tf` uses `student_id`.

4. **Task 5 (secrets injection)** is internally inconsistent in the lab markdown — it tells the student to edit `codebuild.tf` to add `env: parameter-store: / secrets-manager:` blocks, but the repo's buildspec is already inline and the lab doesn't say where exactly to inject. **The test deferred Task 5 (steps 21-26) as `test.fixme`** — implementing it cleanly requires the lab content to be clarified first.

5. **Pipeline stage names use `-Staging` / `-Production`** (not `-Prod`). My initial inventory wrote `Plan-Prod` which is a substring of `Plan-Production` and silently passed the structural assertion in Step 2 — but failed at runtime in Step 27 when looking up the stage by name. Fixed.

6. **`aws codepipeline put-approval-result --result "summary=...,status=Approved"`** is parse-sensitive on Windows shell. Spaces and parentheses in the summary string cause exit 252. The helper now strips to `[A-Za-z0-9_-]` only.

**Test architecture decisions:**
- Self-contained: provisions own state bucket inline, doesn't require Labs 1/2 to have run.
- `beforeAll` includes a `preCleanLab3Resources()` step that tears down any leftover global-namespace resources from prior hung runs (CodePipeline, CodeBuild projects, CodeCommit repo, IAM roles, artifacts buckets, orphan state buckets). Makes re-runs idempotent.
- Manual approval gates driven via `aws codepipeline put-approval-result`, not Playwright + Console.
- Comprehensive cleanup in `afterAll`: terraform destroy for webapp staging+prod, manual SSM param sweep in both regions, secret deletion, pipeline destroy, bucket empty + delete.
- 25 of 32 inventory steps automated; 7 skipped (5 manual-only + 6 Task 5 fixme + 1 conditional Step 17 = double-counted some). Run takes 12-13 min wall time, dominated by pipeline stage waits.
