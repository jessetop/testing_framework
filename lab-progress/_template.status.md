---
course: <course-id>
lab_number: <N>
lab_name: <Lab Name>
lab_instructions_path: <absolute path to the lab markdown>
lab_starter_paths: <comma-separated absolute paths to any starter code folders, or leave blank>
test_config_path: courses/<course>/tests/lab<N>.config.ts
test_spec_path: courses/<course>/tests/lab<N>-<slug>.spec.ts
registered_in_registry: false
last_updated: <YYYY-MM-DD>
lab_instructions_hash:           # filled by: npm run where -- <course> <N> --accept
lab_instructions_hashed_at:      # filled by: npm run where -- <course> <N> --accept
---

# <Course> Lab <N> — <Lab Name>

## Phase A — Pre-test (scaffolding)

- [ ] Lab markdown read & step inventory extracted
- [ ] Manual inputs identified (env vars defined)
- [ ] AWS / external prerequisites identified
- [ ] Tool selection per step (CLI / Playwright / Nova Act)
- [ ] Cleanup logic defined (resource tags / teardown order)
- [ ] `lab<N>.config.ts` created
- [ ] `lab<N>-*.spec.ts` skeleton created
- [ ] Registered in `lab-registry.ts`

## Phase B — Testing

- [ ] Dry run passes (skeleton compiles, registry validates inputs)
- [ ] First full run completed (any outcome)
- [ ] All test steps pass
- [ ] QA bot review run (Stage 8.5)
- [ ] Cleanup verified (0 resources left)
- [ ] Last green run recorded in `last_green_run` field

## Notes / blockers

(empty)
