# Benchmark Task Format

## 1. Цель task format

Task должен быть самодостаточным benchmark fixture. Он не должен зависеть от live приложения, текущего состояния сайта, авторизации или внешних данных.

Каждый task содержит:

```text
- продуктовую задачу;
- reference assets;
- expected values;
- acceptance criteria;
- тесты;
- scoring weights;
- evolution roadmap;
- source/license metadata;
- prompt arms relevant to this task.
```

## 2. Структура директории task

```text
tasks/<task_id>/
  task.yaml

  reference/
    spec.md
    acceptance-criteria.md
    semantic-ui.xml
    expected-values.json
    style-tokens.json
    mock-data.json
    screenshots/
      desktop.png
      tablet.png
      mobile.png
    source-notes.md

  prompts/
    user/
      U0-brief.md
      U1-structured.md
      U2-acceptance.md
      U3-semantic-ui.md
      U4-semantic-ui-plus-e2e.md
      U5-maintainable.md

  tests/
    base/
      build-notes.md
      smoke.spec.ts
      e2e.spec.ts
      values.spec.ts
      visual.spec.ts
    evolution/
      01-add-due-dates.spec.ts
      02-add-search.spec.ts

  evolution/
    01-add-due-dates.md
    02-add-search.md
    03-add-projects.md

  scoring/
    weights.yaml
```

## 3. task.yaml schema

```yaml
id: todomvc
name: TodoMVC Lifecycle
version: 0.1.0
kind: crud_stateful
scaffold: vite-react-ts
license_status: permissive_reference

source:
  name: TodoMVC
  url: https://github.com/tastejs/todomvc
  license: MIT or repo-stated license
  notes: Reference behavior derived from app-spec.md. Do not copy implementation code into generated apps unless explicitly allowed.

reference:
  spec: reference/spec.md
  acceptanceCriteria: reference/acceptance-criteria.md
  semanticUi: reference/semantic-ui.xml
  expectedValues: reference/expected-values.json
  styleTokens: reference/style-tokens.json
  mockData: reference/mock-data.json
  screenshots:
    desktop: reference/screenshots/desktop.png
    mobile: reference/screenshots/mobile.png

constraints:
  framework: react
  language: typescript
  styling: css_or_tailwind
  persistence: localStorage
  backend: none
  allowedPackageManagers:
    - pnpm
  forbidden:
    - external backend services
    - auth providers
    - paid APIs
    - copying brand logos

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

promptArms:
  user:
    - U1-structured
    - U3-semantic-ui
    - U5-maintainable

scoring:
  weights: scoring/weights.yaml

evolution:
  - id: 01-add-due-dates
    name: Add due dates
    prompt: evolution/01-add-due-dates.md
    tests:
      - tests/evolution/01-add-due-dates.spec.ts
    expectedBlastRadius: small

  - id: 02-add-search
    name: Add search
    prompt: evolution/02-add-search.md
    tests:
      - tests/evolution/02-add-search.spec.ts
    expectedBlastRadius: small
```

## 4. Reference bundle

### 4.1 spec.md

Человекочитаемое описание продукта:

```text
- цель;
- пользовательские сценарии;
- экраны;
- состояния;
- данные;
- ограничения;
- responsive behavior.
```

### 4.2 acceptance-criteria.md

Проверяемые критерии:

```text
- User can create a task by typing text and pressing Enter.
- Empty task is not created.
- Completed task count updates immediately.
- Active filter shows only active tasks.
```

### 4.3 semantic-ui.xml

HTML-like representation для text-only моделей:

```xml
<screen name="TodoMVC" viewport="1440x900">
  <main width="550" align="center">
    <title level="1">todos</title>
    <input role="new-todo" placeholder="What needs to be done?" autofocus="true" />
    <section name="todo-list">
      <todo-item state="active" title="Buy milk" />
      <todo-item state="completed" title="Read article" />
    </section>
    <footer>
      <counter>1 item left</counter>
      <filters active="All">
        <filter>All</filter>
        <filter>Active</filter>
        <filter>Completed</filter>
      </filters>
      <button>Clear completed</button>
    </footer>
  </main>
</screen>
```

### 4.4 expected-values.json

Машиночитаемые значения:

```json
{
  "initial": {
    "visibleTitle": "todos",
    "filters": ["All", "Active", "Completed"]
  },
  "afterCreateTask": {
    "taskText": "Ship benchmark MVP",
    "itemsLeft": "1 item left"
  }
}
```

### 4.5 screenshots

Использовать для:

```text
- visual snapshot baseline;
- external jury packet;
- human calibration;
- optional VLM judge.
```

Для text-only models screenshots не обязательно отдавать в prompt.

## 5. Evolution step format

Каждый evolution step должен описывать:

```text
- requested change;
- new acceptance criteria;
- old behavior that must remain;
- expected blast radius;
- forbidden shortcuts;
- tests to pass;
- whether roadmap was disclosed or hidden.
```

Пример:

```markdown
# Evolution 02 — Add search

Add a search input above the task list.

Acceptance criteria:
- Search filters tasks by case-insensitive substring.
- Search applies within the currently selected view.
- Creating, editing, completing and deleting tasks still work.
- Clearing search restores the current view.

Preserve:
- All existing TodoMVC behavior.
- localStorage persistence.

Expected blast radius: small.
Do not rewrite the whole app.
```

## 6. Task types

Рекомендуемые типы:

```text
crud_stateful
content_routing
visual_dashboard
kanban_workflow
form_settings
commerce_cart
```

MVP:

```text
crud_stateful: TodoMVC
content_routing: Conduit Lite
visual_dashboard: Dashboard Lite
kanban_workflow: Boardly Kanban, optional
```

## 7. Validation rules

`pnpm bench validate-task tasks/todomvc` должен проверять:

```text
- task.yaml валиден;
- все пути существуют;
- source/license metadata заполнены;
- evolution ids уникальны;
- tests существуют;
- scoring weights суммируются корректно;
- screenshots есть, если visual checks включены;
- prompt arms существуют;
- нет абсолютных локальных путей;
- нет секретов.
```
