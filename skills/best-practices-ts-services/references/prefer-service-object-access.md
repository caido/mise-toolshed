---
title: Prefer service object access
impact: HIGH
impactDescription: Destructuring services breaks Vue's reactivity system
tags: service, reactivity, pinia
---

## Prefer service object access

**Impact: HIGH (destructuring services breaks Vue's reactivity system)**

Never destructure services. Always keep the service object intact and access properties/methods through it. Services are Pinia stores that auto-unwrap refs and computed values. Destructuring or extracting properties to variables loses the reactive connection.

**Rules:**

- Always access service methods and properties through the service object.
- Never destructure service return values into separate variables.
- Never extract methods to standalone variables.
- In templates, always access through the service object.
- Composables must not be thin wrappers around services; use the service directly if no extra logic is needed.

**Incorrect (destructuring loses reactivity):**

```typescript
const { pauseTask, resumeTask, cancelTask } = useAutomateService();
await pauseTask(task);

const { tasks, setNotificationCount } = useAutomateService();
setNotificationCount(0);

const service = useAutomateService();
const sendMessage = service.sendMessage;
await sendMessage(message, { session });
```

**Correct (access through service object):**

```typescript
const automateService = useAutomateService();
const result = await automateService.pauseTask(task);
automateService.setNotificationCount(0);

const hasTasks = computed(() => automateService.tasks.length > 0);
```

**Incorrect (destructuring in template script):**

```vue
<script setup>
const { tasks } = useAutomateService();
</script>
<template>
  <Task v-for="task of tasks" :task="task" />
</template>
```

**Correct (service object in template):**

```vue
<script setup>
const automateService = useAutomateService();
</script>
<template>
  <div v-if="automateService.tasks.length > 0">
    <Task v-for="task of automateService.tasks" :task="task" />
  </div>
</template>
```

