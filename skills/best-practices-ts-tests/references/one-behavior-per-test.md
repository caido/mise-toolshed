---
title: One behavior per test
impact: MEDIUM
tags: testing, structure
---

## One distinct behavior per test case

Each test case should assert a single, meaningful scenario (one behavior or one edge case). Add exactly the number of test cases requested (e.g. "add exactly three test cases").

**Rules:**

- One distinct behavior or scenario per test.
- When the task specifies a count (e.g. three test cases), add exactly that many.
- Avoid tests that assert multiple unrelated behaviors in one `it` block.

This keeps tests readable, makes failures easy to locate, and ensures coverage is explicit.
