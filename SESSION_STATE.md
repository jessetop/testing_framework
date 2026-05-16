# Session State — Lab Walkthrough Iteration

Last updated: 2026-05-15

## Where we are

| Lab | Status | Last run pass / fail / manual / drift |
|---|---|---|
| Lab 1 (Multi-Environment State Strategy) | **Green** | 24 / 0 / 10 / 1 (step 20 cd patch applied; step 21 drift expected to clear) |
| Lab 2 (Import Legacy Application) | **Blocked** — persistent shell hangs at step 15 (`ls/cat` blocks) | 4 / 18 / 4 (run 1; runs 2-6 hang before report) |
| Lab 3 (Pipeline Operations) | **Baseline established** | 11 / 7 / 13 (run 3, --steps 1-31; step 32 git push to CodeCommit was hanging) |
| Lab 4 (Auditing & Observability) | **In flight** — run 1 (baseline) | — |

## How to resume

### From another machine

```bash
git clone https://github.com/jessetop/testing_framework.git
cd testing_framework
npm ci
# AWS creds: profile `roitraining` in account 029331796573, us-east-1
```

### Re-run Lab 1 (currently green) from EC2

```bash
# SSH/SSM into i-04f87355d5735664b (us-east-1), then:
sudo -u ec2-user bash -lc 'cd ~/testing_framework && \
  LAB_REPO_ROOT=/home/ec2-user/Advanced_Terraform \
  TERRAFORM_STUDENT_ID=user99 \
  AWS_REGION=us-east-1 \
  npx ts-node scripts/walkthrough.ts terraform 1 --skip-checks --auto-skip'
```

### Re-run on a fresh EC2

Recipe to spin up a fresh runner is in `_archive/walkthrough-ec2-userdata.sh`. AMI: AL2023, instance type t3.small, IAM instance profile `EC2InstanceRole`, tag `ManagedBy=playwright-lab-tester`.

## EC2 runner

| Field | Value |
|---|---|
| Instance ID | `i-04f87355d5735664b` |
| Region | `us-east-1` |
| IAM instance profile | `EC2InstanceRole` (Admin + SSM Managed) |
| Access | SSM `AWS-RunShellScript` (no SSH keys) |
| Cost | ~$0.02/hr running |

To stop (saves $$, preserves state): `aws --profile roitraining ec2 stop-instances --instance-ids i-04f87355d5735664b --region us-east-1`

To terminate: `aws --profile roitraining ec2 terminate-instances --instance-ids i-04f87355d5735664b --region us-east-1`

## Framework wins (durable across all labs)

| Area | Fix |
|---|---|
| Parser | Indented-fence detection in backward walk; H2 heading closes step boundary (prevents troubleshooting blocks being attributed to last step) |
| Smart-apply | tfvars smart-merge; HCL block-replace (`terraform`/`provider`/`resource`/`data`/`module`/`output`/`variable`/`locals`); dedent of indented blocks; `<paste-X-output-here>` / `<your-bucket-name>` / `<your-assigned-region>` substitutions; identity overrides for student_id/region from env |
| Runner | Auto-inject `-auto-approve` for apply/destroy + `-force-copy` for init -migrate-state; positional `terraform output NAME` capture (single-command blocks only — no subshell poisoning); bash-block placeholder substitution; `git clone Advanced_Terraform` → `cp -r $LAB_REPO_ROOT` redirect |
| Inventory | Honors `expectFailure: true` (workspace guard tests, state list before apply) |
| Pre-run | AWS cleanup of orphaned SSM params and versioned S3 buckets scoped to `${STUDENT_ID}-*` |
| Workspace setup | Pre-stage `LAB_REPO_ROOT` into workspace; export `DEPLOY_REGION` mirroring `AWS_REGION` |

## Lab 1 markdown patches (Drive master synced)

| Patch | What |
|---|---|
| studentXX → userXX | All example values; users are assigned `user01..user50` IAM usernames |
| Validation regex | `^student[0-9]{2}$` → `^user[0-9]{2}$` in variables.tf |
| Step 20 cd | Explicit `cd ~/Advanced_Terraform/lab1/state-infra` before terraform plan (was prose-only) |
| Step 30 cd | Same — was "Confirm you're in..." prose |
| Step 34 tolerant | `terraform workspace delete <name> 2>/dev/null \|\| echo "(not present)"` so missing workspaces don't fail cleanup |

## Outstanding work

- Lab 2: in-flight run 2; reading result next
- Lab 3, 4: not started
- Lab markdown patches still need to flow to AWSClassroom-com/Advanced_Terraform (GitHub auth not set up on EC2). Currently held in EC2's local `/home/ec2-user/Advanced_Terraform` clone and used via LAB_REPO_ROOT redirect.

## New Google Doc URLs (Drive `_archive/` holds prior versions)

| Lab | URL |
|---|---|
| 1 | https://docs.google.com/document/d/1wxU73qmLaNntUDCD9HVCzL4B8IstiEu96mhx0dpkTQw/edit |
| 2 | https://docs.google.com/document/d/1-9Yq-QitUlMfkHJ6qBOxZs88f090TJVJ93mkBSez90U/edit |
| 3 | https://docs.google.com/document/d/1m69cnSRrPrmrWFx1a6GMP8qr-CPCKICzih7to6qN8OM/edit |
| 4 | https://docs.google.com/document/d/1u9ez3FzF8gzYedvmwZ4MMWdcXCpStdIreiBHtFexQ2g/edit |

## Lab 1 iteration log (12 runs to green)

| Run | Time | P/F/M/D | Fix introduced |
|-----|------|---------|-----------------|
| 1 | 677s | 13/12/10/0 | (baseline; apply hung) |
| 2 | 121s | 12/13/10/0 | `-auto-approve` injection |
| 3 | – | 14/11/10/0 | Positional output capture |
| 4 | – | 14/11/10/0 | (orphaned SSM param recurrence) |
| 5 | – | 15/10/10/0 | Pre-run AWS cleanup |
| 6 | – | 17/8/10/0 | `expectFailure` honored |
| 7 | – | 20/4/10/1 | Output capture isolation (no subshell poisoning) |
| 8 | – | 20/4/10/1 | Bash-block placeholder substitution |
| 9 | – | 14/11/10/0 | (regression — clone-redirect ate next line) |
| 10 | – | 14/11/10/0 | (regression — LAB_REPO_ROOT not in ctx.env) |
| 11 | – | 23/1/10/1 | Both regressions fixed; lab patches applied |
| 12 | – | 24/0/10/1 | Step 34 tolerant; pending step 20 cd in run 13 |
