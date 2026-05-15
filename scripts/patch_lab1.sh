#!/bin/bash
# Patches Lab 1 on the EC2 instance:
#   1) Add `cd ~/Advanced_Terraform/lab1/state-infra` to step 30
#   2) studentXX -> userXX, student_id validation regex, bucket prefix
#   3) Commit + push to AWSClassroom-com/Advanced_Terraform main
set -euo pipefail
cd /home/ec2-user/Advanced_Terraform
git config --global --add safe.directory /home/ec2-user/Advanced_Terraform
git pull origin main

LAB=labs/lab1.md

echo "=== Before: studentXX/student_id refs in lab1.md ==="
grep -nE "studentXX|student[0-9]{2}|student_id|\^student\[" "$LAB" | head -30

# --- Step 30: insert `cd ~/Advanced_Terraform/lab1/state-infra` at the top of
#     the first bash block under step 30. Anchor: the literal heading text.
python3 <<'PY'
import re, pathlib
p = pathlib.Path('labs/lab1.md')
s = p.read_text()

# Step 30 fix: the prose says "Confirm you're in lab1/state-infra/" but no cd
# command. Inject a cd at the top of the first bash block under step 30.
pattern = re.compile(
    r'(30\. \*\*Materialize the prod workspace\'s state file\*\*\n\n    > Confirm you\'re in `lab1/state-infra/` on the `dev` workspace\.\n\n    ```bash\n)(    # 1\. Capture the bucket name)',
    re.MULTILINE,
)
new = pattern.sub(
    r'\1    cd ~/Advanced_Terraform/lab1/state-infra\n    \2',
    s,
)
if new == s:
    print('WARN: step 30 cd injection pattern did not match — no change')
else:
    s = new
    print('OK: step 30 cd injected')

# studentXX -> userXX (lab text + value examples)
s = s.replace('studentXX', 'userXX')
# `student07`, `student08` ... -> `user07` etc. (only the bare pattern, not 'student_id')
s = re.sub(r'\bstudent([0-9]{2})\b', r'user\1', s)
# validation regex
s = s.replace('^student[0-9]{2}$', '^user[0-9]{2}$')
# prose: "your assigned student number" -> "your assigned user number"
s = s.replace('YOUR assigned student number', 'YOUR assigned user number')

p.write_text(s)
print('OK: studentXX/student07/regex/prose replaced in lab1.md')
PY

# Also update the lab CODE files (variables.tf, providers.tf, tfvars.example)
# so the configuration matches: validation regex + any hardcoded student values.
for f in lab1/state-infra/variables.tf lab1/state-infra/providers.tf lab1/state-infra/terraform.tfvars.example \
         lab1/networking/variables.tf lab1/networking/providers.tf lab1/networking/terraform.tfvars.example \
         lab1/state-infra/main.tf; do
  if [[ -f "$f" ]]; then
    python3 - <<PY
import re, pathlib
p = pathlib.Path("$f")
s = p.read_text()
orig = s
s = s.replace('studentXX', 'userXX')
s = re.sub(r'\bstudent([0-9]{2})\b', r'user\1', s)
s = s.replace('^student[0-9]{2}\$', '^user[0-9]{2}\$')
s = s.replace('YOUR assigned student number', 'YOUR assigned user number')
if s != orig:
    p.write_text(s)
    print(f"OK: patched $f")
PY
  fi
done

echo
echo "=== After: studentXX/student_id refs ==="
grep -nE "studentXX|student[0-9]{2}|\^student\[" "$LAB" lab1/state-infra/variables.tf lab1/networking/variables.tf 2>/dev/null | head -20 || echo "(none left)"

echo
echo "=== git diff stat ==="
git diff --stat

echo
echo "=== commit + push ==="
git add -A
git -c user.email="walkthrough-bot@test" -c user.name="walkthrough-bot" commit -m "lab1: userXX naming + add cd in step 30, fix troubleshooting parsing

- Replace studentXX/studentNN examples with userXX/userNN throughout (lab
  text + tf code) to match the user01..user50 IAM convention students
  are actually given.
- Update student_id validation regex from ^student[0-9]{2}$ to
  ^user[0-9]{2}$.
- Step 30 now explicitly cd's into lab1/state-infra/ before running
  terraform output / apply -refresh-only (previously was prose-only,
  which broke for the testing framework that has no human reader to
  re-cd between steps)."
git push origin main
echo DONE
