---
name: create-skill
description: "Guides how to write good Cursor/agent skills. Use when creating a new skill, improving an existing one, or asking about skill structure, SKILL.md format, or best practices for skill content and triggering."
---

# Create Skill

Guidance for **how to write good skills**: structure, content, and conventions so skills are clear, trigger when they should, and are easy to maintain.

## When to use this skill

- Creating a new skill from scratch
- Improving or refactoring an existing skill
- Questions about skill file format, description, or when/how skills trigger

## Capturing intent before you write

Understand the user's intent before drafting:

1. **What should this skill enable the agent to do?**
2. **When should it trigger?** (user phrases, contexts, or tasks that should invoke the skill)
3. **What output or behavior is expected?** (format, constraints, examples)

Ask about edge cases, examples, and success criteria. If useful, check similar skills or docs in the repo so the new skill fits existing patterns.

## Writing the SKILL.md

### Frontmatter

- **name** — Kebab-case identifier; should match the skill folder name (e.g. `create-skill` → `skills/create-skill/`).
- **description** — Primary triggering mechanism. Include:
  - What the skill does (one short sentence).
  - **When to use it** — concrete phrases, contexts, or scenarios (e.g. "when the user asks to…", "when creating…", "when debugging…"). Descriptions that are too vague cause undertriggering; be specific so the agent knows when to load the skill.

### Anatomy of a skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Optional bundled resources
    ├── scripts/   — Executable code for repetitive tasks
    ├── references/ — Docs to load when needed
    └── assets/   — Templates, icons, etc.
```

Keep the main instructions in **SKILL.md**. Put long or detailed material in **references/** and point to it from SKILL.md so the agent knows when to read it. Aim for a SKILL.md that stays under a few hundred lines; use clear headings and a short table of contents for long files.

### Progressive disclosure

- Put the most important rules and “when to use” in the description and the top of the body.
- Use the body for step-by-step or detailed guidance.
- Reference external files (e.g. in `references/`) only when the task needs that depth; say when to read them.

### Principle of lack of surprise

Skills must not contain malware, exploit code, or content that could compromise security. The skill’s behavior should match what the description promises. Do not create skills designed to mislead, exfiltrate data, or gain unauthorized access.

### Writing style

- Prefer **imperative** instructions (“Do X”, “Check Y”).
- **Explain why** where it helps: reasoning and context often work better than long lists of MUST/NEVER. Theory of mind helps the agent apply the skill in new situations.
- Keep instructions **general** where possible so the skill works across examples, not only for one narrow case.

### Defining output formats

Use explicit templates when the output must follow a structure:

```markdown
## Report structure
Use this template:
# [Title]
## Executive summary
## Key findings
## Recommendations
```

### Examples in the skill

Include examples for formats or behaviors you care about:

```markdown
## Commit message format
**Example:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
```

### Improving an existing skill

When revising a skill:

1. **Generalize from feedback.** Optimize for many future uses, not just one or two examples. Prefer clearer patterns and reasoning over narrow, overfit rules.
2. **Keep the skill lean.** Remove instructions that don’t affect behavior. If the agent is wasting steps, trim or rephrase the parts that cause that.
3. **Explain the why.** Where you can, explain why a rule matters so the agent can adapt. Use ALL CAPS or rigid MUST/NEVER sparingly; prefer “so that…” and short reasoning.
4. **Reuse repeated work.** If the agent often writes the same helper or does the same sub-steps, consider putting that in a bundled script or reference and telling the skill to use it.

## Communicating with the user

Match the user’s level of jargon. Explain terms briefly when needed (e.g. “trigger”, “frontmatter”). It’s fine to clarify in one sentence rather than assume familiarity.
