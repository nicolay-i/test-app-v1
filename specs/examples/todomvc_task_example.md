# Example Task — TodoMVC Lifecycle

This is a compact example of how the TodoMVC task could be represented.

## task.yaml excerpt

```yaml
id: todomvc
name: TodoMVC Lifecycle
version: 0.1.0
kind: crud_stateful
scaffold: vite-react-ts

source:
  name: TodoMVC
  url: https://github.com/tastejs/todomvc
  spec: https://github.com/tastejs/todomvc/blob/master/app-spec.md
  license: repo license, verify before distribution

reference:
  spec: reference/spec.md
  acceptanceCriteria: reference/acceptance-criteria.md
  semanticUi: reference/semantic-ui.xml
  expectedValues: reference/expected-values.json
  screenshots:
    desktop: reference/screenshots/desktop.png
    mobile: reference/screenshots/mobile.png

constraints:
  framework: react
  language: typescript
  persistence: localStorage
  backend: none

checks:
  install: true
  build: true
  runtimeSmoke: true
  e2e:
    - tests/base/e2e.spec.ts
  values:
    - tests/base/values.spec.ts
  visual:
    - tests/base/visual.spec.ts
  codeHealth: true

evolution:
  - id: 01-add-due-dates
    prompt: evolution/01-add-due-dates.md
    tests:
      - tests/evolution/01-add-due-dates.spec.ts
    expectedBlastRadius:
      size: small
      maxChangedFiles: 5
      maxRewriteRatio: 0.2

  - id: 02-add-search
    prompt: evolution/02-add-search.md
    tests:
      - tests/evolution/02-add-search.spec.ts
    expectedBlastRadius:
      size: small
      maxChangedFiles: 5
      maxRewriteRatio: 0.2
```

## semantic-ui.xml excerpt

```xml
<screen name="TodoMVC" viewport="1440x900">
  <layout type="centered" width="550">
    <title level="1" visual="large faded red">todos</title>
    <input role="new-todo" placeholder="What needs to be done?" autofocus="true" />
    <section name="todo-list">
      <todo-item state="active" title="Ship benchmark MVP" />
      <todo-item state="completed" title="Read TodoMVC spec" />
    </section>
    <footer visibleWhen="todos.length > 0">
      <counter>1 item left</counter>
      <filters active="All">
        <filter route="#/">All</filter>
        <filter route="#/active">Active</filter>
        <filter route="#/completed">Completed</filter>
      </filters>
      <button visibleWhen="completed.length > 0">Clear completed</button>
    </footer>
  </layout>
</screen>
```

## Evolution 02 prompt excerpt

```markdown
# Add search

Add a search input above the todo list.

Acceptance criteria:
- Search filters todos by case-insensitive substring.
- Search applies within the current view: All, Active, or Completed.
- Clearing search restores the current view.
- Creating, editing, completing, deleting, and clearing completed todos still work.
- localStorage persistence still works.

Expected blast radius: small.
Do not rewrite the whole app.
```
