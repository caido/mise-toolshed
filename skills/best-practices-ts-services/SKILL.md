---
name: best-practices-ts-services
description: Service layer conventions for Vue/TS apps. Use when writing or reviewing services, service tests, event buses, repository mocking, and whether components should use stores vs services.
---

# Service Best Practices

Conventions for the service layer (`@/services`): architecture, file layout, patterns, event buses, testing, and repository mocking. Ensures services follow the layered architecture and tests verify behavior through state.

## Table of Contents

- [When to Apply](#when-to-apply)
- [References](#references)

## When to Apply

- Writing or editing service code (index.ts, useInitialize.ts, events.ts, feature composables)
- Defining or updating a service's public API
- Adding event bus definitions, emissions, or handlers
- Writing or reviewing service tests (index.spec.ts)
- Creating or updating test kits for repository mocking
- Deciding whether a component should use a store or a service (components must use services)

## References

- [require-service-responsibilities](references/require-service-responsibilities.md) – Services must handle business logic, state coordination, event handling, initialization, and error handling.
- [require-components-use-services-only](references/require-components-use-services-only.md) – Components must use services only; never import stores or repositories directly.
- [require-service-domain-files](references/require-service-domain-files.md) – Each service domain must have: main composable, feature composables, useInitialize.ts, events.ts.
- [require-main-service-public-api](references/require-main-service-public-api.md) – The main service composable must be the public interface returning data, actions, and computed.
- [require-public-api-type](references/require-public-api-type.md) – Explicit service type with all signatures; callback return type `(): Service =>`; export service type only when needed; export feature message types when referenced.
- [require-initialize-teardown](references/require-initialize-teardown.md) – Services needing setup/cleanup must expose initialize and teardown.
- [require-event-emit-subscribe](references/require-event-emit-subscribe.md) – Services needing cross-component communication must use emit/subscribe.
- [require-service-uses-repository](references/require-service-uses-repository.md) – Data access must go through services; services use repositories and apply business logic.
- [require-service-utils](references/require-service-utils.md) – Use the project's service creation utility (e.g. defineService) for consistent service creation.
- [prefer-single-service-method](references/prefer-single-service-method.md) – One intention-revealing method per workflow; components must not orchestrate multiple service calls.
- [require-domain-specific-state](references/require-domain-specific-state.md) – No cross-domain services; embed functionality in each domain; state only in stores.
- [prefer-service-object-access](references/prefer-service-object-access.md) – Never destructure services; keep the service object intact for reactivity.
- [require-thin-return](references/require-thin-return.md) – Service indexes should assemble the public API via a thin `defineService` callback with spread.
- [require-event-bus-definition](references/require-event-bus-definition.md) – Event buses must be defined in events.ts with keys format services.{name}.{event} (kebab-case).
- [require-event-bus-top-level-emission](references/require-event-bus-top-level-emission.md) – Event buses used for emission must be declared at composable top level, never inside functions.
- [require-event-bus-before-handling](references/require-event-bus-before-handling.md) – When handling events, declare each event bus right before its usage.
- [require-index-spec-only](references/require-index-spec-only.md) – All service tests in index.spec.ts only; no tests for private files; test private behavior through the public API.
- [require-one-describe-per-function](references/require-one-describe-per-function.md) – One describe block per service function or computed.
- [require-service-api-only](references/require-service-api-only.md) – Test via service API only; never access or mock stores directly in tests.
- [require-test-kits](references/require-test-kits.md) – Mock repositories via test kits; stores remain real; use factories for data; never use vi.mocked() on repositories.
- [no-store-internal-tests](references/no-store-internal-tests.md) – Do not test store implementation details or internal mechanics in service tests.
- [no-delegation-tests](references/no-delegation-tests.md) – Do not test simple delegation functions or API-only functions without custom logic.
- [prefer-state-verification](references/prefer-state-verification.md) – Assert service state with toMatchObject; test state changes, transitions, errors; never assert repository calls.

## Structure

- `SKILL.md` – This file; entry point for the skill. Include a Table of Contents and a References section (link to each reference + one-line description).
- `references/` – One small reference file per rule; filenames follow naming-convention (kebab-case).
