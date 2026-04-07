---
title: Mutation validation
impact: MEDIUM
tags: testing, workflow, validation
---

## Mutation validation (optional workflow)

After adding tests, you can validate that they actually assert behavior by mutating the **source code under test** (not the spec) so that at least one of the new tests would fail. Then revert the mutations so tests pass again. Mutations must never be committed or included in a PR.

**Steps:**

1. Add the test cases to the spec; run tests (baseline should pass).
2. Apply one or more small mutations to the source (e.g. change a condition, remove a branch, break a return value) so at least one new test would fail.
3. Run the test command; the run must fail. Confirm failures are due to the mutations.
4. Revert all mutations to the source, leaving only the new or updated spec.
5. Run the test command again; the run must pass.

Use repository tooling (e.g. `mise test:file <path>`) to run tests. Do not commit mutation changes.
