# Lab Progress Tracking

Per-lab build status, stored **outside** the lab folders so paths can change without losing context.

## Why this lives here

Lab markdown lives on Google Drive and can move (renamed folders, re-org, archived versions). The lab-progress files stay in the testing framework, point back at the current lab location, and survive a move — you just update the `lab_instructions_path` field and the `where` script re-verifies.

## File layout

```
lab-progress/
├── README.md                       # this file
├── _template.status.md             # copy this for a new lab
└── <course>/
    └── lab<N>.status.md            # one per lab
```

## File format

Frontmatter (flat key/value, comma-separated lists) + markdown body with two checklist phases:

- **Phase A — Pre-test (scaffolding):** lab parsed, inputs identified, config + spec + registry entry created
- **Phase B — Testing:** dry run, full run, QA bot review, cleanup verified

## Commands

```bash
npm run where                              # list all labs and their progress
npm run where -- terraform 1               # detail view for one lab
npm run where -- terraform                 # all labs in a course
npm run where -- terraform 1 --accept      # capture current lab hash as the new baseline
npm run where -- --accept-all              # capture hashes for every lab (use sparingly)
```

The script:
1. Parses the frontmatter
2. Verifies every referenced path exists (lab markdown, starter code, test files)
3. **Hashes the lab markdown** (SHA-256) and compares to the stored hash → flags drift
4. Reports checklist progress for Phase A and Phase B
5. Tells you the next unchecked step

## Version drift detection

When you scaffold a test against a lab, the lab markdown's SHA-256 hash gets stored in the status file's `lab_instructions_hash` field. On every subsequent `npm run where` run, the current hash is recomputed and compared. If the lab content changes upstream, the lab appears with `⚠ LAB CONTENT DRIFT` and the detail view shows the stored vs current hash.

**Workflow when drift is reported:**
1. Read the lab markdown diff (whatever happened upstream — rewrite, fix, scope change)
2. Decide whether the existing test still covers the new content
3. Update the test if needed
4. Accept the new hash as the baseline: `npm run where -- <course> <N> --accept`

**When `lab_instructions_path` itself changes** (e.g., the lab moved to a different folder, or you're pointing at a different canonical version), the hash will not match either — review the new file's content, update the test, then `--accept`. This is the same flow as drift; the system doesn't distinguish "moved" from "rewritten."

## Reconnecting a moved lab

If the lab markdown moved, `npm run where` flags the broken path. Edit the status file's `lab_instructions_path` to the new location, run `npm run where` to see whether the new content matches the previously-tested version, and `--accept` once you've reconciled.
