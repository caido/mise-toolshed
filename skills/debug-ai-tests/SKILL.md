---
name: debug-ai-tests
description: >
  Debug failing AI eval tests by triangulating test output, `.reports` FS snapshots,
  and `.reports` trace logs, then comparing the AI’s output against the intended
  documentation (skills, prompts, repo docs). Use when a user asks “why did this
  AI test fail?”, “are the assertions correct?”, “did the agent follow the skill?”,
  or when investigating `packages/evals/.reports/{fs,trace}/...` artifacts.
---

# Debug AI Tests

Guidance for debugging failing AI eval tests by inspecting:

- The **test failure output** (what assertion failed and what it expected)
- The **FS snapshot** in `.reports/fs/...` (what files existed at the end)
- The **trace** in `.reports/trace/...` (what the AI did, in what order)
- The **intended documentation** (skills, prompts, project docs) the AI was supposed to follow

Your goal is to answer:

- **Why did the test fail?**
- **Do the assertions match the intended documentation?**
- **Did the AI follow the documentation (or not)?**

## When to apply

Use this skill when:

- A user is debugging an eval test failure under `packages/evals/tests/**`
- The test run produced `.reports` artifacts and the user wants interpretation
- The user is unsure whether the **test** is wrong or the **AI output** is wrong

## Inputs you should collect (minimum)

- **The failing test name / file path**
  - Example: `packages/evals/tests/skills/<skill>/update.spec.ts`
- **The failure output**
  - The exact assertion message and the file+line that failed
- **Whether `.reports` already contains artifacts for the failing run**
  - If not, you need to run the test

## Step-by-step debugging workflow

### 1) Read the failing assertions first

- Open the failing spec file and find the exact assertion(s) that failed.
- Extract:
  - **What the test expects** (patterns, file paths, invariants)
  - **What file globs it checks** (these often hide subtle mismatches)
  - Any “shape” assumptions (e.g., “must have `src/services/index.ts`”)

### 2) If needed, run the test to generate `.reports`

Only run the test if:

- The user has not provided the test output, or
- `.reports` artifacts for the failing run are missing/stale

Prefer running a single file:

```bash
pnpm vitest 'path/to/failing.spec.ts'
```

### 3) Inspect the `.reports/fs` snapshot (ground truth)

The FS report is the end-of-test workspace state. Use it to answer:

- **Does the file the test expects actually exist?**
- **What exact code shape did the AI produce?**
- **Did the AI create/rename/move files compared to the test’s assumptions?**

Common gotchas:

- The test expects a root barrel (e.g. `src/services/index.ts`) but the scenario only includes domain indexes (e.g. `src/services/<domain>/index.ts`).
- The test expects a specific import form (default vs named), but the output uses a different valid form.

### 4) Inspect the `.reports/trace` log (behavior + intent)

The trace explains what happened and why the AI made changes. Use it to check:

- **Did the AI invoke the intended skill(s)?**
- **What files did it read / glob / edit (and in what order)?**
- **Was the AI blocked** (missing file, wrong path, tool error)?
- **Did the AI misunderstand the request** (prompt ambiguity)?

When reading trace, prioritize:

- `ToolUse` entries (especially `Read`, `Glob`, `Grep`, `Edit`/writes)
- `ToolResult` errors (missing file, wrong cwd, parse errors)
- The final assistant summary vs what actually changed in FS

### 5) Load the “intended documentation” and extract requirements

Read the documentation the AI was supposed to follow, such as:

- Skill docs: `.cursor/skills/<name>/SKILL.md` and relevant `references/*.md`
- Repo docs: `docs/**`, `README.md`, conventions referenced by the test
- The test prompt string (often embedded in the spec)

Convert the documentation into a small list of **verifiable requirements**.

Examples of verifiable requirements:

- “Service index must be a thin assembly layer returning spreads”
- “Must use `defineService` utility from `@/services/utils`”
- “Must export a public API type”

### 6) Reconcile: assertions vs FS vs docs vs trace

Use this comparison checklist:

- **Assertion → FS**: Did the asserted file/pattern actually occur?
- **Assertion → Docs**: Is the asserted rule actually required by the docs?
- **Docs → FS**: Does the output satisfy the docs’ requirements?
- **Docs → Trace**: Did the AI attempt to follow the docs but fail due to context/tooling?

## Decide the conclusion (required)

You must end with exactly one of these conclusions:

### A) The test assertions are wrong

Choose this when:

- The FS output matches the documentation, but the test is checking the wrong thing
- The test over-specifies an implementation detail not mandated by docs
- The test patterns are too narrow (e.g., only default import patterns)

What to propose:

- The minimal assertion change(s) needed to align with docs and valid output shapes

### B) The test assertions are correct, and the AI output is invalid

Choose this when:

- The documentation clearly requires a behavior/shape the output does not meet
- The FS output violates one or more doc requirements
- The trace shows the AI ignored or misapplied the docs/skill guidance

What to propose:

- Why the AI likely failed (prompt ambiguity, missing context, weak instruction)
- Whether to fix via **prompt changes**, **skill changes**, or **scenario fixtures**

## Required output format

Unless the user asks for a different format, respond with:

1. **Summary**
   - 2–4 bullets: what failed + the decision (A vs B)
2. **Evidence**
   - Quote the relevant assertion(s)
   - Cite the FS snapshot location(s) and the specific code/file facts
   - Cite the trace entries that matter (skill invoked, tool errors, edits)
   - Cite the doc requirement(s) from skill/docs
3. **Conclusion**
   - State **A** or **B** explicitly
4. **Next action**
   - The smallest fix that resolves the mismatch (assertion change OR prompt/skill improvement)

