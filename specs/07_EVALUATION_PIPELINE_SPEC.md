# Evaluation Pipeline Spec

## 1. Цель

Оценка должна сочетать объективные проверки, визуальное сравнение, code-health metrics и, опционально, внешнее жюри.

Не полагаться только на LLM judge или pixel diff.

## 2. Проверки после каждой версии

```text
v0:
- install check
- build check
- runtime smoke
- console error check
- e2e base tests
- value assertions
- visual snapshots
- code-health metrics

v1..vN:
- build check
- regression tests from previous versions
- new tests for current change
- value assertions
- visual snapshots if relevant
- code-health metrics
- git diff metrics
```

## 3. Build check

Команды:

```bash
pnpm install --frozen-lockfile=false
pnpm build
```

Если проект использует другой script, task config может задать:

```yaml
commands:
  install: pnpm install
  build: pnpm build
  dev: pnpm dev --host 127.0.0.1
```

Сохранять:

```text
- exit code;
- duration;
- stdout/stderr;
- first error excerpt;
- dependency install changes;
- package.json diff.
```

## 4. Runtime smoke check

```text
1. Start dev server.
2. Open root URL.
3. Wait for app stable.
4. Fail on uncaught exception.
5. Fail on critical console errors.
6. Capture screenshot.
```

MVP Playwright fixture:

```ts
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push(err.message));
```

## 5. E2E tests

Писать через semantic selectors:

```ts
await page.getByRole('textbox', { name: /new todo/i }).fill('Ship MVP');
await page.keyboard.press('Enter');
await expect(page.getByText('Ship MVP')).toBeVisible();
```

Избегать:

```text
- CSS class selectors;
- nth-child selectors;
- exact internal DOM structure;
- timing sleeps;
- random data.
```

## 6. Value assertions

Value checks проверяют конкретные числа/тексты/состояния:

```text
- counters;
- totals;
- filtered results;
- selected tab;
- card counts;
- table rows;
- validation messages;
- active route;
- localStorage persistence.
```

Формат результата:

```json
{
  "check": "todo_count_after_create",
  "expected": "1 item left",
  "actual": "1 item left",
  "passed": true
}
```

## 7. Visual checks

Playwright поддерживает screenshot comparisons через `expect(page).toHaveScreenshot()`. Для MVP использовать это как один слой visual score.

Не делать pixel diff главным score. Visual score должен учитывать:

```text
layout structure
component presence
spacing/alignment
typography hierarchy
color/style similarity
responsive behavior
polish
```

MVP visual score:

```text
visual_snapshot_pass = 1/0
visual_diff_ratio = from Playwright report, if available
manual_or_jury_visual_score = optional later
```

## 8. Accessibility smoke

MVP:

```text
- кнопки имеют видимый текст или aria-label;
- формы доступны через label/placeholder;
- keyboard basic flows work;
- focus visible for important actions;
- color contrast not scored unless tool added.
```

Можно добавить `@axe-core/playwright` позже.

## 9. Prompt adherence

Автоматический prompt adherence можно считать по checklists:

```text
- every acceptance criterion has pass/fail;
- every required component is present;
- forbidden feature/dependency not used;
- constraints respected.
```

LLM judge можно добавить позже, но только как supplementary metric.

## 10. Scoring formula MVP

### 10.1 Initial quality

```text
initial_quality =
  0.25 * build_runtime_score +
  0.35 * e2e_score +
  0.15 * value_score +
  0.15 * visual_score +
  0.10 * prompt_adherence_score
```

### 10.2 Version quality

```text
version_quality =
  0.20 * build_runtime_score +
  0.35 * regression_score +
  0.25 * new_feature_score +
  0.10 * value_score +
  0.10 * visual_score
```

### 10.3 Build/runtime score

```text
build_runtime_score =
  1.0 if install/build/runtime smoke pass
  0.5 if build passes but runtime has non-critical console errors
  0.0 if build fails or app cannot load
```

### 10.4 E2E score

```text
e2e_score = passed_tests / total_tests
```

### 10.5 Regression score

```text
regression_score = passed_old_tests / total_old_tests
```

## 11. Repair attempts

Если repair enabled:

```text
max_repair_attempts_per_version = 1
```

Repair prompt:

```text
The app currently fails these checks. Make the smallest fix needed. Do not add new scope. Preserve existing behavior.
```

Scoring penalty:

```text
repair_penalty = 0.05 per repair attempt
repair_tokens counted separately
```

## 12. Failure/death conditions

Trajectory becomes `dead` if:

```text
- generation fails with no files changed;
- build fails after allowed repair attempts;
- critical base tests fail for 2 consecutive versions;
- version score < 0.35 for 2 consecutive versions;
- app requires full rewrite for a small change, detected by rewrite_ratio threshold and test failure;
- workspace becomes unrecoverable.
```

## 13. Artifacts per version

```text
artifacts/<trajectory-id>/<version>/
  prompt.md
  opencode.stdout.log
  opencode.stderr.log
  opencode.events.jsonl
  git.diff
  build.log
  e2e-report/
  screenshots/
    desktop.png
    mobile.png
  metrics.json
  score.json
  status.json
```

## 14. Human-readable failure summary

После каждого failed version генерировать:

```markdown
# Failure Summary

Version: v3
Status: tests_failed

Failed checks:
- todo_count_after_bulk_delete
- localStorage_persistence

Likely issue:
- Bulk delete removed visible items but did not update persisted state.

Changed files:
- src/App.tsx
- src/components/TodoList.tsx

Repair attempted: yes/no
```
