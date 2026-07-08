# Lifecycle Evolution Benchmark

## 1. Цель

Проверять, как далеко можно дорабатывать приложение, не получая архитектурную деградацию, регрессии и резкий рост токен-расхода.

Основной вопрос:

```text
Какой prompt создаёт приложение, которое выдерживает N последовательных изменений?
```

## 2. Trajectory

Одна trajectory:

```text
v0 generated app
v1 change added
v2 change added
v3 change added
...
vN final version
```

После каждой версии:

```text
- build;
- old regression tests;
- new tests;
- screenshots;
- code-health metrics;
- token/cost metrics;
- git diff metrics.
```

## 3. Change types

Evolution roadmap должен включать разные типы изменений:

### 3.1 Additive

```text
Добавить новую фичу без замены старой.
```

Пример:

```text
Add due dates to tasks.
```

### 3.2 Cross-cutting

```text
Изменение затрагивает несколько частей UI/state.
```

Пример:

```text
Add search that works within all filters/views.
```

### 3.3 Replacement

```text
Заменить старую концепцию новой.
```

Пример:

```text
Replace priority with multiple labels.
```

### 3.4 Deletion/cleanup

```text
Удалить фичу и все следы.
```

Пример:

```text
Remove projects and clean related state/components/tests.
```

### 3.5 UI restructure

```text
Поменять layout без поломки логики.
```

Пример:

```text
Replace footer filters with sidebar views.
```

### 3.6 Data model change

```text
Изменить структуру данных.
```

Пример:

```text
Change fixed kanban columns to user-created columns.
```

## 4. Hidden vs disclosed roadmap

### 4.1 Hidden roadmap mode

Initial prompt говорит только:

```text
Build a maintainable app. Keep the implementation simple and easy to change.
```

Будущие изменения не раскрываются.

Это проверяет настоящую обобщённую поддерживаемость.

### 4.2 Disclosed roadmap mode

Initial prompt содержит:

```text
This app is expected to evolve with labels, custom views, bulk actions, and layout changes.
```

Это проверяет, помогает ли знание roadmap.

### 4.3 Правило

Не сравнивать hidden и disclosed как равные arms без маркировки. Это разные экспериментальные условия.

## 5. Death conditions

Trajectory считается неподдерживаемой/dead, если:

```text
- build не проходит после allowed repair attempts;
- critical regression tests не проходят 2 версии подряд;
- app cannot load;
- version score < 0.35 for 2 consecutive versions;
- token cost for small change grows > 4x baseline and tests still fail;
- small change causes rewrite_ratio > 0.50 and regression failures;
- generated code deletes major required functionality unrelated to change;
- workspace becomes unusable.
```

## 6. Repair policy

MVP:

```text
max_repair_attempts_per_version = 1
```

Repair не должен менять scope:

```text
Fix the failing build/tests using the smallest change. Do not add new features. Preserve current scope.
```

Считать:

```text
repair_attempts
repair_tokens
repair_changed_files
repair_success
```

## 7. Score по trajectory

```text
lifecycle_quality =
  0.20 * initial_quality +
  0.25 * average_version_quality +
  0.20 * survival_score +
  0.15 * maintainability_score +
  0.10 * regression_resistance +
  0.10 * external_jury_score_optional
```

Если jury score отсутствует, его вес перераспределить:

```text
+0.05 to average_version_quality
+0.05 to maintainability_score
```

## 8. Lifecycle cost

```text
lifecycle_tokens =
  sum(initial_generation_tokens) +
  sum(edit_tokens) +
  sum(repair_tokens)
```

```text
cost_per_passing_version = lifecycle_tokens / max(passing_versions, 1)
```

```text
lifecycle_efficiency = lifecycle_quality / max(lifecycle_tokens / 1000000, 0.001)
```

## 9. TodoMVC roadmap

```text
v0 — TodoMVC base
- create/edit/delete/toggle
- all/active/completed filters
- clear completed
- localStorage

v1 — Add due dates
- optional due date on task
- overdue visual state
- today/overdue counts

v2 — Add search
- search by text
- works inside active/completed filters
- clear search restores view

v3 — Add projects
- assign task to project
- project filter
- default Inbox project

v4 — Replace footer filters with sidebar views
- sidebar: Inbox, Today, Upcoming, Completed
- remove old footer filter UI
- preserve behavior through new views

v5 — Add bulk actions
- select multiple tasks
- bulk complete
- bulk delete

v6 — Remove projects and clean up
- remove project UI/state/types
- all tasks return to Inbox-like flat list
- no unused project code remains
```

## 10. Dashboard roadmap

```text
v0 — Dashboard base
- sidebar
- header
- metric cards
- chart placeholder
- recent activity table

v1 — Date range filter
- selected range changes displayed period label
- values update from deterministic mock data

v2 — Table search
- search by customer/order text
- empty state

v3 — Status filter
- filter table by status
- counts update

v4 — Detail drawer
- click row opens drawer
- drawer shows order details
- close via button/Escape

v5 — Change chart layout
- chart moves into two-column analytics section
- mobile layout still clean

v6 — Remove one metric card
- remove Churn card
- grid remains balanced
- no dead config remains
```

## 11. Conduit Lite roadmap

```text
v0 — Blog/feed base
- homepage
- article cards
- tag list
- article page

v1 — Author pages
- click author
- show author bio and articles

v2 — Tag filtering
- click tag
- feed filters by tag
- selected tag visible

v3 — Favorites
- favorite/unfavorite article
- count updates

v4 — Search
- search by title/description
- works with selected tag

v5 — Editor picks
- replace featured article with editor picks section
- remove old featured logic

v6 — Draft/published status
- drafts hidden from public feed
- author page can show drafts toggle
```

## 12. Boardly Kanban roadmap

```text
v0 — Board base
- Todo/In Progress/Done columns
- create/edit/delete/move cards
- card counts
- localStorage

v1 — Add priority
- low/medium/high badge

v2 — Replace priority with labels
- remove priority
- multiple labels per card

v3 — Filter by label
- board filters cards by selected label

v4 — Custom columns
- create/rename/delete columns
- move cards across dynamic columns

v5 — Archive
- archive/unarchive cards
- archive view

v6 — Card detail modal
- title/description/labels editable in modal

v7 — Comments
- add/delete comments

v8 — Remove comments and clean up
- no comments UI/state/types remain

v9 — Bulk archive
- select multiple cards
- archive selected
```

## 13. Expected blast radius

Каждый step должен иметь expected blast radius:

```yaml
expectedBlastRadius:
  size: small
  maxChangedFiles: 5
  maxRewriteRatio: 0.20
  notes: Search should reuse existing task filtering logic.
```

Типовые пороги:

```text
small:
  maxChangedFiles: 5
  maxRewriteRatio: 0.20

medium:
  maxChangedFiles: 10
  maxRewriteRatio: 0.35

large:
  maxChangedFiles: 18
  maxRewriteRatio: 0.55

refactor:
  no strict rewrite threshold, but regression tests must pass
```

## 14. Lifecycle report

Каждая trajectory должна дать:

```text
- score by version;
- status by version;
- token usage by version;
- regression failures by version;
- changed files by version;
- largest file LOC curve;
- duplication ratio curve;
- first failure reason;
- representative diffs;
- jury score, если есть.
```
