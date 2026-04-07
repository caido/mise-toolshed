---
title: Green vs red tests
impact: MEDIUM
tags: testing, tdd
---

## Test type: green or red

Specify in the prompt or task which outcome the tests should have:

- **Green** — Tests are written so they **pass**. They assert the current, correct behavior of the code under test. Use when adding or extending tests for existing, correct behavior.
- **Red** — Tests are written so they **fail**. Use to document a bug, validate that a fix is needed, or to drive TDD (write a failing test first, then implement to make it pass). The caller should state that tests should fail or that they are writing a failing test first.

Indicate the desired type explicitly (e.g. "write tests that pass" or "add a failing test for the bug in …").
