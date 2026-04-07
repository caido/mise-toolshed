---
name: debug-workflow
description: >
  Analyze and explain AI-ops / gh-aw workflow runs using downloaded logs.
  Use this skill whenever the user asks to debug, inspect, or understand a
  GitHub Actions or gh-aw workflow run (errors, failures, agent behavior,
  missing outputs, or “what happened” questions). The skill will collect
  a workflow run ID, clarify what should be investigated, download logs and workflow artifacts
  via `mise get-logs <run-id>`, and read `.gh-run-logs/run-<id>/run.log` plus any downloaded
  artifact directories to answer the user’s specific question about the run.
---

# Debug Workflow

Guidance for debugging and explaining AI-ops / gh-aw workflow runs by downloading and inspecting their logs. Use this skill whenever the user wants to know what went wrong (or what happened) in a specific workflow run.

## When to apply

- The user mentions a **workflow run ID** or a **GitHub Actions run URL** and asks what happened, why it failed, or what issues the agents encountered.
- The user asks you to **“debug a workflow”**, **“inspect an AI-ops run”**, **“analyze logs”**, or similar.
- You see references to `.gh-run-logs/run-<id>/` or `mise get-logs` and the user wants interpretation rather than raw logs.

## Preconditions and tools

- You are running in an environment where:
  - `mise get-logs <run-id>` (or an equivalent helper) is available to download the combined workflow log and all uploaded artifacts into one directory per run.
  - You can run shell commands and **read files** from the local filesystem.
- **Do not** commit, push, or edit workflow/source files when using this skill. Your job is to **inspect and explain**, not to change the workflow.

## Interaction flow

Follow this sequence every time you use this skill. Do not skip steps unless the information is already known from earlier in the conversation.

1. **Collect the workflow run ID**
   - If the user already provided a run ID (e.g. `23057739659`) or a full run URL, reuse it.
   - If they only gave a URL, extract the numeric run ID from the URL.
   - If no run ID is available, ask the user for:
     - Either the **numeric run ID** (preferred), or
     - A **full GitHub Actions run URL** from which you can extract the ID.

2. **Clarify the investigation focus**
   - If the user has not already specified what to check, ask them to choose **one** of:
     - **(A) Find anything that went wrong in this run** — broad scan for errors, failures, timeouts, and suspicious warnings.
     - **(B) Explain why this run failed** — focus on the first failure cause and any cascading effects.
     - **(C) Summarize what the agents did in this run** — high-level timeline of major actions and outcomes.
     - **(D) Other (freeform)** — the user describes a custom question in their own words (e.g. “Why didn’t it create a PR?”).
   - If they pick **Other**, ask a short follow-up question so you have a precise target for your analysis.

3. **Download the logs**
   - Once you know the run ID, run the read-only command:
     - `mise get-logs <run-id>`
   - Note where outputs are written. In this repo everything for one run lives under **`.gh-run-logs/run-<run-id>/`**:
     - **`run.log`** — main combined workflow log.
     - **Artifact subdirectories** (e.g. `agent/`, `activation/`) — extracted when the run uploaded artifacts; one directory per artifact name, alongside `run.log`.
   - If `mise get-logs` fails, capture the error message and:
     - Tell the user you could not download the logs.
     - Explain what went wrong (e.g. permission, missing run, network).
     - Stop the workflow-debug process rather than guessing based on partial data.

4. **Identify and open relevant log files**
   - Prioritize reading:
     - `.gh-run-logs/run-<run-id>/run.log` as the primary source of truth.
     - Sibling directories under `.gh-run-logs/run-<run-id>/` when present (e.g. `agent/` for stdout, JSON exports, patches) for detail not fully present in `run.log`.
     - Any other files clearly associated with the run if needed (e.g. per-job logs).
   - Use file-read tools (not editors) to inspect the logs.
   - For **Claude Code / agent turns** (modes **(C)** or questions about what the agent said or which tools it ran): search `run.log` for `"type":"assistant"`, `"type":"user"`, `"type":"system"`, and `"type":"tool_result"`, and read files under `agent/` when the workflow uploaded them.

5. **Filter and analyze based on the investigation focus**
   - For **“Find anything that went wrong” (A)**:
     - Search case-insensitively for: `error`, `failed`, `failure`, `exception`, `timeout`, **`command not found`**, **`: not found`** (e.g. `mise: command not found`, `pnpm: command not found`).
     - Search for **tool result content** that indicates execution failures: lines containing `"type":"tool_result"` and `"content":"` with phrases like `command not found`, `: not found`, `Permission denied`, or non-zero exit codes. These often appear in long JSON lines and are easy to miss if you only grep for “error”.
     - Look at job-level and step-level summaries near the end of the log for non-success conclusions.
     - Note repeated warnings that may not fail the run but indicate problems (e.g. rate limits, missing tools).
   - For **“Explain why this run failed” (B)**:
     - Find the **first job or step** where the conclusion is failing.
     - Read **5–20 lines around** the failure to understand context (command, error message, exit code).
     - Check whether the failure is due to:
       - Safe-output / noop misuse (no safe-output tool called).
       - Agent failure or timeout.
       - Checkout or git push errors.
       - Tool / MCP misconfiguration (missing server, authentication).
       - Repo-memory or artifact size limits.
     - Focus on the **root cause** rather than listing every downstream error.
   - For **“Summarize what the agents did” (C)**:
     - Walk the log chronologically and note:
       - Which agents or jobs ran.
       - What high-level actions they took (e.g. added tests, created PRs, updated repo memory).
       - Whether each major step succeeded or failed.
     - Build a concise timeline rather than quoting the entire log.
   - For **“Other” (D)**:
     - Translate the user’s question into a concrete log search strategy.
     - Read relevant sections of the log and tie your findings directly back to their question.

6. **Cross-check safe-output and agent summaries**
   - Where present, look for **safe-output summaries** (e.g. noop messages, failure handlers, repo-memory status).
   - Use these sections to:
     - Confirm whether safe-output tools were called correctly.
     - See final agent conclusions (success vs failure).
     - Identify any non-critical issues (e.g. repo-memory patch size limits, skipped updates).

7. **Prepare the final answer**
   - Always answer in natural language, not just as a list of raw log lines.
   - Tie each conclusion back to **specific log evidence** (job name, step name, and a short excerpt).
   - If logs are noisy or ambiguous, say so and explain what you can and cannot infer confidently.

## Analysis patterns and common issues

When reading workflow logs, pay special attention to these patterns:

- **Missing safe-output tool call**
  - Symptom: the run completes agent steps but fails with messages about missing `noop` or other safe-output tools.
  - What to report:
    - That the agent did work but never called a safe-output tool.
    - Which job/step emitted the error.
    - That the fix is to ensure exactly one safe-output tool is called before completion.

- **Agent failure or timeout**
  - Symptom: sections mentioning “agent failure”, “timeout”, or similar, often with a stack trace or engine error.
  - What to report:
    - Which agent/workflow step failed.
    - Any clues about why (e.g. model error, tool error, network issue).
    - Whether the failure happened before any code changes or PR creation.

- **Checkout / git / push issues**
  - Symptom: errors while running `actions/checkout`, `git fetch`, `git push`, or branch-related scripts.
  - What to report:
    - Which repository/branch was affected.
    - Whether the problem was authentication, missing refs, or branch protections.
    - How this blocked the agent (e.g. could not create/update a PR).

- **MCP / tool configuration problems**
  - Symptom: errors mentioning MCP servers, missing tools, or tool configuration failures.
  - What to report:
    - Which tool or MCP server name appears in the error.
    - Whether it is missing, misconfigured, or failing at runtime.
    - How that impacted the workflow (e.g. agent could not read GitHub issues).

- **Repo-memory and artifact size limits**
  - Symptom: messages about patch size, memory size, or artifact upload failures.
  - What to report:
    - That the main workflow may have succeeded but repo-memory updates were limited or skipped.
    - Whether these are non-critical (e.g. “run succeeded but memory not updated”).

- **Command / tool not found in agent environment**
  - Symptom: In the **Execute Claude Code CLI** (or similar agent) step, tool results contain `command not found`, `: not found`, or similar (e.g. `mise: command not found`, `pnpm: command not found`, `vue-tsc: not found`). These appear inside `"type":"tool_result"` and `"content":"..."` on often long JSON lines.
  - Why it matters: The agent’s Bash runs inside a container or sandbox where PATH or installed tools (mise, pnpm, etc.) may differ from the main job. The run can still succeed if the agent retries with other commands (e.g. `npm exec`), but the intended tooling is missing in that environment.
  - What to report:
    - That the agent ran a command (e.g. `mise`, `pnpm`) that was not available in its execution environment.
    - The job/step name and a short excerpt (e.g. `mise: command not found` in a tool_result).
    - Suggest ensuring PATH or the full path to the tool (e.g. `/home/runner/.local/share/mise/bin/mise`) is available in the agent’s environment, or that the workflow instructs the agent to use the correct command/path for that environment.

## Required output format

Unless the user explicitly requests a different format, structure your answer like this:

1. **Summary**
   - 2–4 short bullet points that answer the user’s question directly.
2. **Key details**
   - A short list of key issues or observations. For each item:
     - Name the **job/step** (if available).
     - Provide a brief description of what happened.
     - Include a short log excerpt or paraphrase (no long raw dumps).
3. **Root cause and next steps**
   - If the run failed or behaved unexpectedly:
     - State the most likely **root cause** in one or two sentences.
     - Suggest concrete next steps (e.g. adjust workflow config, ensure a safe-output tool is called, fix a failing test, update a secret).
   - If the run succeeded:
     - Confirm that there were **no critical errors**.
     - Optionally mention any warnings or non-blocking issues you found.

## Examples

### Example 1 — Broad scan for issues

- **User prompt**: “Debug workflow run 23057739659 — what issues did the agents hit?”
- **Your behavior**:
  1. Confirm the run ID `23057739659`.
  2. Ask which investigation mode to use. If the user does not specify, default to **(A) Find anything that went wrong**.
  3. Run `mise get-logs 23057739659` and open `.gh-run-logs/run-23057739659/run.log` (and sibling artifact dirs if needed).
  4. Scan the log (and agent artifact files when relevant) for errors, failures, `command not found` / `: not found`, tool-result execution failures, and suspicious warnings, including safe-output summaries.
  5. Answer with a **Summary**, **Key details**, and **Root cause and next steps** as described above.

### Example 2 — Explain a failed run

- **User prompt**: “Here’s a GitHub Actions run URL, can you explain why it failed?”
- **Your behavior**:
  1. Extract the run ID from the URL (ask the user if you cannot).
  2. Ask the user to confirm that they want mode **(B) Explain why this run failed**.
  3. Run `mise get-logs <run-id>` and open `.gh-run-logs/run-<run-id>/run.log`.
  4. Find the first failing job/step and read the surrounding lines.
  5. Explain, in your own words, what failed and why, quoting only the most important log messages.

### Example 3 — Summarize agent behavior

- **User prompt**: “Download logs for this run and tell me what the agents did.”
- **Your behavior**:
  1. Confirm or ask for the run ID.
  2. Ask whether they want a behavior summary (mode **(C)**) or a full issue scan; follow their choice.
  3. Run `mise get-logs <run-id>` and open `.gh-run-logs/run-<run-id>/run.log` plus `agent/` (or other artifact dirs) when present.
  4. Trace assistant/user/system and `tool_result` lines in the log (and any agent-side logs) to summarize what the agents did.
  5. Build a concise timeline of key actions (e.g. checkout, analysis, edits, tests, PR creation, repo-memory updates).
  6. Present the timeline in the required output format, making clear where things succeeded or failed.
