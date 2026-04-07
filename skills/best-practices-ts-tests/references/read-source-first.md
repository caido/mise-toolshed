---
title: Read source under test first
impact: HIGH
tags: testing, workflow
---

## Read the source under test first

Before writing or adding tests, read the source file (or files) under test to understand behavior. Then add test cases that assert distinct behaviors or scenarios.

**Rules:**

- Read the implementation before writing assertions.
- Base test cases on actual behavior (inputs, outputs, edge cases) observed in the source.
- Follow project and skill conventions (e.g. best-practices-ts-components, best-practices-ts-services, best-practices-ts-stores) when the target is a component, service, or store.

This reduces incorrect or redundant tests and keeps specs aligned with the code.
