#!/bin/bash
# Patch step 34 to make workspace deletes tolerant — the prod workspace can
# disappear from the S3 backend's view after step 32's destroy removes its
# last state entry. Failing the whole cleanup on a missing workspace is
# not the right teaching point.
set -euo pipefail
cd /home/ec2-user/Advanced_Terraform

python3 <<'PY'
import re, pathlib
p = pathlib.Path('labs/lab1.md')
s = p.read_text()
orig = s

# Replace the four workspace cleanup lines with tolerant variants. The
# anchor is the bash block that starts with `cd ~/Advanced_Terraform/lab1/state-infra`
# under step 34.
old = """    cd ~/Advanced_Terraform/lab1/state-infra
    terraform workspace select default
    terraform workspace delete dev
    terraform workspace delete staging
    terraform workspace delete prod"""
new = """    cd ~/Advanced_Terraform/lab1/state-infra
    terraform workspace select default
    # Some workspaces may already be gone after destroy if their state file
    # was the only env:/<ws>/ object — that's fine.
    terraform workspace delete dev     2>/dev/null || echo "(dev not present)"
    terraform workspace delete staging 2>/dev/null || echo "(staging not present)"
    terraform workspace delete prod    2>/dev/null || echo "(prod not present)"
"""

if old in s:
    s = s.replace(old, new)
    print("OK: step 34 patched")
else:
    print("WARN: step 34 anchor not found — no change")

if s != orig:
    p.write_text(s)
PY

echo
echo "=== git status ==="
git status --short

git add labs/lab1.md
git -c user.email="walkthrough-bot@example.com" -c user.name="walkthrough-bot" commit -m "lab1 step 34: make workspace deletes tolerant of missing workspaces

When the s3 backend stores per-workspace state at env:/<ws>/KEY and the
last resource in a workspace is destroyed, the empty state file can be
removed from the bucket. terraform workspace list then drops that
workspace, and a subsequent 'terraform workspace delete <ws>' exits
non-zero with 'Workspace doesn't exist'.

For cleanup purposes that's not actually a failure — the goal is 'leave
behind no extra workspace metadata' and a missing workspace already
satisfies it. Wrap each delete in 2>/dev/null || echo so the cleanup
proceeds in either state." || true

echo DONE
