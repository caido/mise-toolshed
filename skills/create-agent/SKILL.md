---
name: create-agent
description: "Explains the canonical agent file structure and best practices for creating or updating agents (e.g. in agents/*.md). Use when the user wants to create a new agent, restructure an existing agent, align an agent with project conventions, or asks about agent structure, how to write an agent, or agent file format."
---

# Create Agent

Guidance for creating and structuring agent files so they are consistent and easy to maintain. Agents are markdown files in `agents/` (e.g. `agents/test-auditor.md`, `agents/test-engineer.md`) that define a role, inputs, and a task for an AI to follow. Workflows can reference them via `./agents/<name>.md`.

## When to apply

- Creating a new agent from scratch
- Updating an existing agent's structure to match project conventions
- When the user asks how agents should be structured, what sections to include, or what the agent file format is

## Canonical structure

Follow this order. No extra top-level sections (e.g. no separate "Output" or "Constraints"); fold those into **Your task** steps.

**Frontmatter (YAML)**  
`name`, `description`, `skills` (list).

**Body (markdown)**  
1. Single H1 title (e.g. `# Test Auditor`)  
2. One intro paragraph: "You are an agent that ..."  
3. `## Inputs`  
4. Line: "You will receive:"  
5. Bullet list: each item is **Bold label** — Description  
6. `## Your task`  
7. Numbered list: each step is `N. **Label** —` then description; sub-bullets allowed

### Minimal template

```markdown
---
name: my-agent
description: "One sentence what it does. When to use it. Inputs: list inputs briefly."
skills:
  - some-skill
---

# My Agent

You are an agent that ...

## Inputs

You will receive:

- **Input one** — Description.
- **Optional input** — Description (optional).

## Your task

1. **Step one** — Do the main work. Reference **skill-name** for details.
2. **Step two** — Edge case or follow-up (sub-bullets if needed).
3. **Output** — How to deliver the result (e.g. emit summary, open PR).
```

## Frontmatter rules

- **name** — Kebab-case; must match the filename without `.md` (e.g. `test-engineer` → `test-engineer.md`).
- **description** — Third person. State what the agent does and when to use it. End with **Inputs:** and a short list of inputs (e.g. "Inputs: file or folder to audit; optional list of test cases."). Max 1024 chars. This is used for discovery and triggering.
- **skills** — YAML list of skill names from `skills/` (e.g. `best-practices-ts-tests`). The agent delegates detailed conventions to these skills; do not inline long convention text in the agent file.

## Body rules

- **Title** — One H1 only; matches the agent role (e.g. Test Auditor, Test Engineer).
- **Intro** — One paragraph. Start with "You are an agent that ..." and state the agent's purpose in one or two sentences.
- **## Inputs** — Section heading, then the line "You will receive:", then a bullet list. Each bullet: **Bold label** — Description. Mark optional inputs explicitly (e.g. "An optional list of ...").
- **## Your task** — Section heading, then a numbered list. Each step: `N. **Label** —` plus description. Use sub-bullets for branching (e.g. "If green: do A; if red: do B").
- **No other top-level sections** — Put "Output" or "Constraints" as the last step(s) under Your task, not as separate sections.

## Best practices

- **Keep agents short** — Delegate detailed rules to skills; reference them by name (e.g. **best-practices-ts-tests**).
- **One sentence per input** — Each input bullet is one clear sentence; optional inputs get "optional" or "when provided" in the description.
- **Order task steps** — First step is usually the main work (e.g. "Write tests", "Inspect"); then edge cases or variants (e.g. red vs green); then tooling or output (e.g. "Run validation tools", "Emit the summary").
- **Bold labels** — Use **Bold label** for every input and every task step so the structure is scannable.

## References

- [agents/test-auditor.md](agents/test-auditor.md) — Canonical example: single input, four task steps, output as last step.
- [agents/test-engineer.md](agents/test-engineer.md) — Canonical example: multiple inputs (including optional), task with sub-bullets for green/red, validation tools step.

Workflows (e.g. `.github/workflows/proxy-frontend-add-tests.md`) reference agents by path: `./agents/test-auditor.md`, `./agents/test-engineer.md`. The workflow prompt instructs the AI to read and follow those agent files in sequence when applicable.
