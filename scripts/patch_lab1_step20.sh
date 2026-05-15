#!/bin/bash
# Patch step 20 to explicitly cd into lab1/state-infra/ before terraform plan.
# After step 17's `cd ~/Advanced_Terraform/lab1/networking`, CWD sits in
# networking/ but step 20 ("Deploy the Application") is supposed to run in
# state-infra/ — the prose makes that clear but no command does the cd, so
# the walkthrough re-applies networking and step 21's terraform output
# returns networking's outputs instead of the app's.
set -euo pipefail
cd /home/ec2-user/Advanced_Terraform

python3 <<'PY'
import pathlib
p = pathlib.Path('labs/lab1.md')
s = p.read_text()
orig = s

# Anchor the terraform plan that opens step 20. Inject a cd line above it.
old = """20. **Deploy the Application**

    ```bash
    terraform plan
    ```"""

new = """20. **Deploy the Application**

    Return to the application directory (state-infra) before deploying — Part D's app config lives there, alongside the bootstrap config from Step 12:

    ```bash
    cd ~/Advanced_Terraform/lab1/state-infra
    terraform plan
    ```"""

if old in s:
    s = s.replace(old, new)
    print("OK: step 20 cd injected")
else:
    print("WARN: step 20 anchor not found")

if s != orig:
    p.write_text(s)
PY

git add labs/lab1.md
git -c user.email="walkthrough-bot@example.com" -c user.name="walkthrough-bot" commit -m "lab1 step 20: cd into state-infra/ before deploying the app

Step 17 has the student cd into lab1/networking/ to apply the networking
state. Step 20 ('Deploy the Application') is supposed to run in
lab1/state-infra/ — the application is co-located with the bootstrap
config there, gated by the state_bucket_name tfvars value set in Step 19.

The lab assumed the student would cd back manually, but it never said so
explicitly. Add an explicit cd at the top of Step 20's bash block. With
this in place, Step 21's terraform output returns the app outputs
(app_config_ssm_parameter, networking_vpc_id) instead of networking's
outputs, matching the Expected: block." || true

echo DONE
