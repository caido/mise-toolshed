---
name: best-practices-docs
description: "Use when writing or organizing docs, deciding whether content is a tutorial vs how-to vs reference vs explanation, structuring a doc site, or when the user mentions Diátaxis, documentation structure, or doc types."
---

# Documentation Best Practices (Diátaxis)

Conventions for technical documentation based on [Diátaxis](https://diataxis.fr/): four documentation types, how to choose them, and how to apply the framework when writing or reorganizing docs.

## Table of Contents

- [Overview](#overview)
- [The four types](#the-four-types)
- [The compass](#the-compass)
- [The map](#the-map)
- [Workflow](#workflow)
- [When to apply](#when-to-apply)
- [Language and style](#language-and-style)
- [References](#references)

## Overview

Diátaxis is a framework for technical documentation that matches four user needs to four forms of documentation. It addresses:

- **Content** — what to write
- **Style** — how to write it
- **Architecture** — how to organize it

Use Diátaxis as a **guide**, not a mandatory plan. Improve documentation in small steps; structure emerges from improving content, not from imposing a four-fold layout up front.

## The four types

| Type | Orientation | User question | Purpose | Form |
| ---- | ----------- | ------------- | ------- | ---- |
| **Tutorials** | Learning | "Can you teach me to…?" | Learning experience | A lesson |
| **How-to guides** | Goals | "How do I…?" | Achieve a goal | Series of steps |
| **Reference** | Information | "What is…?" (machinery) | Describe the system | Dry description |
| **Explanation** | Understanding | "Why…?" / "Can you tell me about…?" | Illuminate a topic | Discursive explanation |

### Tutorials

- **Orientation**: Learning. The user is studying; they learn by doing under guidance.
- **Purpose**: Provide a learning experience (a lesson), not to help them complete a one-off task.
- **Principles**: Focus on concrete steps and visible results early and often; minimise explanation (link out for depth); avoid options and alternatives; use "we" to affirm tutor–learner relationship; maintain a narrative of expected outcomes so the learner knows they are on track; aspire to perfect reliability—every step must produce the promised result.
- **Form**: A lesson. Not a recipe or a feature walkthrough; the value is what the learner gains, not the artifact they produce.
- **Analogy**: Teaching a child to cook—success is what the child learns and that they want to return, not the dish.

### How-to guides

- **Orientation**: Goals. The user wants to get something done.
- **Purpose**: Guide the user through a problem or toward a result; serve the application of existing skill.
- **Principles**: Address **user problems and tasks** (human need), not tool features or "what the machine can do"; allow real-world complexity (branching, judgement); omit the unnecessary; provide a logical sequence of actions; seek flow (pace and rhythm that match how the user thinks and works); use clear, goal-stating titles (e.g. "How to integrate monitoring").
- **Form**: A series of steps (actions and, where needed, thinking). Not a tutorial (no teaching) and not reference (no dry listing of options).
- **Analogy**: A recipe—it shows how to make the dish; it doesn’t teach you to cook, and you don’t want a history lesson in the middle of cooking.

### Reference

- **Orientation**: Information. The user needs to look something up.
- **Purpose**: Describe the machinery and how to operate it—succinctly, in order, with no ambiguity.
- **Principles**: Describe and only describe; no instruction or explanation in place of description (link to how-to and explanation instead); adopt standard patterns so users find things where they expect; respect the structure of the product (documentation mirrors the system); use examples to illustrate without teaching.
- **Form**: Austere, authoritative description. One consults reference; one doesn’t read it through.
- **Analogy**: Information on the back of a food packet—facts, standard layout, no recipes or opinion mixed in.

### Explanation

- **Orientation**: Understanding. The user wants to reflect and understand.
- **Purpose**: Deepen and broaden understanding; bring context, connections, and "why"; permit reflection.
- **Principles**: Make connections (to other topics, design decisions, history); provide context; talk *about* the subject (titles can often take "About …"); admit opinion and perspective and alternatives where it helps understanding; keep explanation bounded—don’t let instruction or reference creep in (link to those instead).
- **Form**: Discursive. The only kind of documentation it might make sense to read away from the product (e.g. for reflection).
- **Analogy**: A book like *On Food and Cooking*—context, history, science; no recipes, not reference; read when reflecting, not while doing.

## The compass

Use the compass to decide **what form a piece of content is** or **what form is needed** for a given user need. Ask two questions:

1. **Action or cognition?** — Does the content inform *action* (doing, steps) or *cognition* (facts, concepts)?
2. **Acquisition or application?** — Does it serve *acquisition* of skill (learning) or *application* of skill (getting work done)?

| Content informs… | Serves… | Document type |
| ---------------- | ------- | ------------- |
| Action | Acquisition of skill | **Tutorial** |
| Action | Application of skill | **How-to guide** |
| Cognition | Application of skill | **Reference** |
| Cognition | Acquisition of skill | **Explanation** |

- **Action**: practical steps, doing.
- **Cognition**: theoretical or propositional knowledge, thinking.
- **Acquisition**: study, learning.
- **Application**: work, achieving a goal.

Apply the compass to existing docs (is this in the right place?) or to new content (what form should this take?). When in doubt, ask whether the user needs to *do* something or to *know* something, and whether they are *learning* or *working*.

## The map

The four types sit in a two-dimensional relationship (learning vs goals, information vs understanding). Boundaries between them matter.

- **Tutorials** and **how-to guides** both guide action; tutorials serve learning, how-to guides serve getting a task done. Do not collapse them—mixing them makes it impossible to serve either need well.
- **Reference** and **explanation** both inform cognition; reference describes the machinery, explanation illuminates topics. Keep description out of explanation and discussion out of reference.
- When distinctions blur, style and content leak into the wrong places and structure becomes harder to maintain. Keep each type distinct in purpose and style.

## Workflow

Apply Diátaxis iteratively; do not front-load structure.

- **Use as a guide, not a plan.** Do not create empty sections for tutorials / how-to / reference / explanation with nothing in them. Improve content first; structure will emerge.
- **Work in small steps.** Pick one piece of documentation (e.g. a paragraph, a page). Assess it: What user need does it serve? How well does it serve that need? What single change would improve it? Make that change and publish or commit. Repeat.
- **Just do something.** If you don’t know where to start, pick anything—the file you’re in, a random page. Assess it against Diátaxis, decide one next action, do it, then repeat. Structure grows from many such steps.
- **Allow work to develop organically.** Good structure comes from well-formed content following the principles of each type, not from imposing a top-level layout first.

## When to apply

Use this skill when:

- Writing new documentation (choose and apply the appropriate type: tutorial, how-to, reference, or explanation).
- Reorganizing or refactoring existing docs (classify content, move or split by type).
- Deciding where a page belongs or which type it should be (use the compass).
- Reviewing docs for correct type and style (check language, purpose, and boundaries).
- The user mentions Diátaxis, documentation structure, doc types, or questions like "tutorial vs how-to" or "is this reference or explanation?"

## Language and style

- **Tutorials**: "We …", "In this tutorial we will …"; "First do x. Now do y."; minimal explanation; link out for depth; set expectations ("The output should look like …"); confirm results ("Notice that …", "You have built …").
- **How-to guides**: "This guide shows you how to …"; "If you want x, do y." / "To achieve w, do z."; conditional imperatives; link to reference for full options; avoid turning the guide into reference or explanation.
- **Reference**: State facts; list commands, options, operations, limits; "You must …" / "You must not …" / "Never …" for rules; standard patterns; no instruction or discursive explanation in place of description.
- **Explanation**: "The reason for x is …"; "W is better than Z because …"; weigh alternatives; discussion-like; "about" a topic; can admit opinion and perspective where it aids understanding.

## References

- [Diátaxis — Start here](https://diataxis.fr/start-here/)
- [Tutorials](https://diataxis.fr/tutorials/)
- [How-to guides](https://diataxis.fr/how-to-guides/)
- [Reference](https://diataxis.fr/reference/)
- [Explanation](https://diataxis.fr/explanation/)
- [The compass](https://diataxis.fr/compass/)
- [Diátaxis as a guide to work (workflow)](https://diataxis.fr/how-to-use-diataxis/)
- [The map](https://diataxis.fr/map/)
