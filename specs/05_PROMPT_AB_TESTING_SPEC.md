# Prompt A/B/n Testing Spec

## 1. Цель

Сравнивать разные формулировки промптов как experimental arms. Важно отличать:

```text
- wording sensitivity: та же информация, другая формулировка;
- information packaging: разные типы/объёмы информации;
- system instruction effect: разные системные директивы;
- edit prompt effect: разные формулировки доработки.
```

Эти эксперименты нельзя смешивать без маркировки, иначе будет непонятно, почему arm победил.

## 2. Experimental unit

```text
trajectory = task + model + system_prompt_arm + user_prompt_arm + asset_representation + edit_prompt_arm + run_seed
```

Полный результат trajectory:

```text
v0 score
v1 score
...
vN score
lifecycle score
total tokens
human/jury scores, если есть
```

## 3. Общие правила A/B

### 3.1 Менять один фактор за раз

Плохой тест:

```text
A: короткий prompt
B: длинный prompt + acceptance criteria + semantic UI + maintainability + tests
```

Хороший тест:

```text
A: structured prompt
B: structured prompt + acceptance criteria
```

### 3.2 Повторы обязательны

Минимум:

```text
2 runs на arm для smoke MVP
3 runs для первичного вывода
5–10 runs для финального сравнения кандидатов
```

### 3.3 Считать не только среднее

Сохранять:

```text
mean
median
std
min
max
win_rate_vs_baseline
worst_case_score
pass_rate
cost_per_successful_version
```

### 3.4 Случайный порядок запусков

Запуски arms нужно перемешивать, чтобы временные rate limits или деградация сервиса не попали в одну группу.

### 3.5 Blinding for jury

Для внешнего жюри всегда скрывать:

```text
model_id
prompt_arm_id
run_id semantics
token cost
automated score
```

## 4. User prompt arms

### U0 — brief

Проверяет способность модели достроить задачу.

```text
Build a TodoMVC-style task app in React and TypeScript.
```

### U1 — structured

Добавляет цель, экраны, фичи и constraints.

```text
Goal:
Build a task manager app.

Features:
- create tasks
- edit tasks
- complete/uncomplete tasks
- delete tasks
- filter all/active/completed
- persist in localStorage
```

### U2 — structured + acceptance criteria

Добавляет проверяемые критерии.

```text
Acceptance criteria:
- Pressing Enter creates a task.
- Whitespace-only task is ignored.
- Double click starts editing.
- Escape cancels editing.
- Counts update immediately.
```

### U3 — structured + semantic UI

Добавляет HTML-like layout tree.

```text
Use the following semantic UI representation as the layout target:
<screen>...</screen>
```

### U4 — structured + semantic UI + e2e scenarios

Добавляет user flows.

```text
User flow 1:
- type task
- press Enter
- expect visible task and updated counter
```

### U5 — U4 + maintainability addendum

Добавляет фокус на дальность доработки.

```text
Implement this as a small maintainable app.
Use a clear data model and reusable components.
Avoid hard-coded special cases and duplicated logic.
Keep changes localized and avoid overengineering.
```

## 5. System prompt arms

Системные промпты должны быть короткими. Они не должны описывать task scope, только инженерное поведение.

### S0 — minimal

```text
You are a coding agent. Build the requested app.
```

### S1 — strict requirements

```text
You are a coding agent. Follow explicit requirements exactly. Do not add unrelated features. Prefer the simplest implementation that satisfies the acceptance criteria.
```

### S2 — maintainable simple

```text
You are a senior frontend engineer. Build small production-quality apps that are easy to change. Prefer clear data models, reusable components, localized changes, and simple code. Avoid duplication, hard-coded special cases, and overengineering.
```

### S3 — visual fidelity

```text
You are a frontend implementation specialist. When given a visual or semantic UI reference, prioritize layout fidelity, component hierarchy, spacing, typography, responsive behavior, and visible UI states, while preserving functional correctness.
```

### S4 — test-passing

```text
You are a meticulous frontend engineer. Prioritize deterministic behavior, acceptance criteria, and browser-test pass rate. Keep the implementation simple and avoid unrelated changes.
```

## 6. Edit prompt arms

### E0 — direct

```text
Add the requested feature.
```

### E1 — preserve behavior

```text
Add the requested feature. Preserve all existing behavior and avoid regressions.
```

### E2 — smallest maintainable change

```text
Add the requested feature using the smallest maintainable change. Reuse existing structures where appropriate. Avoid duplicating logic. Do not rewrite unrelated parts of the app.
```

### E3 — test-aware

```text
Add the requested feature. Existing behavior must keep working. Update or add tests only where needed. Before finishing, check the implementation against the new and old acceptance criteria.
```

## 7. Asset representation arms

```text
R0: no visual/reference asset
R1: prose visual description
R2: semantic HTML-like UI tree
R3: accessibility-tree-like representation
R4: Figma-like component hierarchy
R5: screenshot/raw image, only for vision-capable models
R6: screenshot + semantic UI
```

Для первого честного сравнения выбранных OpenCode free models использовать `R2` как основной режим.

## 8. Рекомендуемые фазы эксперимента

### Phase 1 — user prompt search

```text
Fixed:
- task set
- models
- system prompt S2
- edit prompt E2

Compare:
- U1 vs U3 vs U5
```

### Phase 2 — system prompt search

```text
Fixed:
- best 2 user prompts from Phase 1
- edit prompt E2

Compare:
- S0 vs S1 vs S2 vs S3
```

### Phase 3 — edit prompt search

```text
Fixed:
- best initial prompt combo

Compare:
- E0 vs E1 vs E2 vs E3
```

### Phase 4 — asset representation search

```text
Fixed:
- best prompt combo

Compare:
- R1 vs R2 vs R4
```

## 9. Output analysis

Для каждого arm считать:

```text
initial_quality
lifecycle_quality
survived_steps
regression_rate
tokens_per_successful_change
repair_attempts
code_health_degradation
jury_visual_score
jury_maintainability_score
```

И строить выводы в формате:

```text
For Model M on Task Type T:
- Best quality arm: Ux/Sy/Ez/Rq
- Best cost-quality arm: ...
- Shortest sufficient prompt: ...
- Maintainability best: ...
- Overengineering risk: ...
```

## 10. Guardrails against false conclusions

Не делать вывод, если:

```text
- меньше 2 runs;
- один arm получил больше информации, но сравнивается как wording-only;
- task не прошёл baseline validation;
- внешний сервис был нестабилен;
- score основан только на visual similarity;
- jury видело model/prompt labels;
- future roadmap был раскрыт в одном arm и скрыт в другом без маркировки.
```
