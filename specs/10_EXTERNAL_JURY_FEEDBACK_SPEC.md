# External Jury Feedback Spec

## 1. Цель

Нужно уметь “снять ОС” — собрать внешнюю обратную связь и независимую оценку качества у людей, не участвующих в генерации.

Жюри нужно для двух вещей:

```text
1. Проверить, насколько автоматические метрики совпадают с человеческим восприятием качества.
2. Найти случаи, где автоматические проверки пропускают важные проблемы: плохой UX, визуальная неряшливость, неподдерживаемая архитектура, странные решения.
```

## 2. Что оценивает жюри

Разделить роли:

### 2.1 Product/UX judge

Оценивает:

```text
- приложение решает задачу;
- пользовательские сценарии понятны;
- нет очевидных UX-провалов;
- состояния пусто/ошибка/успех понятны;
- поведение похоже на reference/task intent.
```

### 2.2 Frontend/UI judge

Оценивает:

```text
- layout fidelity;
- визуальная аккуратность;
- responsive behavior;
- компонентная цельность;
- spacing/typography/style.
```

### 2.3 Engineering/Maintainability judge

Оценивает:

```text
- читаемость кода;
- простота изменений;
- отсутствие дублей;
- качество data model;
- размер компонентов;
- локальность изменений;
- следы мёртвого кода после deletion steps;
- риск будущей лапши.
```

### 2.4 QA judge

Оценивает:

```text
- соответствие acceptance criteria;
- регрессии;
- edge cases;
- стабильность;
- понятность тестов/селекторов.
```

Один человек может закрывать несколько ролей, но роль должна фиксироваться.

## 3. Blind review principle

Жюри не должно видеть:

```text
- model_id;
- prompt_arm_id;
- run_id semantic name;
- token usage;
- автоматический total score;
- порядок генерации;
- “этот вариант наш любимый”.
```

Показывать только anonymized label:

```text
Variant A
Variant B
Variant C
```

После сбора оценок можно раскрыть mapping.

## 4. Jury packet

Runner должен генерировать:

```text
runs/<matrix-id>/jury-packet/
  index.md
  manifest.json
  variants/
    variant_001/
      summary.md
      app-preview-instructions.md
      requirements.md
      screenshots/
        desktop.png
        mobile.png
      videos/
        smoke-flow.webm optional
      code-review/
        file-tree.md
        code-health-summary.md
        key-diffs.md
        source-snapshot.zip optional
      forms/
        review-form.md
```

## 5. Что включать в packet

### 5.1 Summary

```markdown
# Variant 001

Task: TodoMVC Lifecycle
Version: v4
Review type: app + code

What to review:
- Current app behavior after four changes.
- Whether previous behavior still works.
- Whether the code appears maintainable.

Do not infer model/vendor. This variant is anonymized.
```

### 5.2 Requirements

Дать жюри task requirements и evolution changes до текущей версии:

```text
v0 requirements
v1 change
v2 change
v3 change
v4 change
```

Не давать prompt text, если prompt может раскрыть arm.

### 5.3 Screenshots

```text
desktop actual
mobile actual
reference screenshot, если visual review включает comparison
optional diff image
```

Для blind pairwise можно показывать:

```text
reference vs variant A/B/C
```

### 5.4 App preview

MVP варианты:

```text
- локальная инструкция: pnpm install && pnpm dev;
- static build artifact, если возможно;
- Docker compose later;
- hosted temporary preview later.
```

### 5.5 Code review bundle

Для maintainability judge:

```text
- file tree;
- largest files table;
- duplication summary;
- dependency summary;
- key diffs by version;
- source snapshot zip optional;
- no model/prompt metadata.
```

## 6. Review modes

### 6.1 Absolute scoring

Каждый вариант оценивается отдельно по шкале 1–7.

Поля:

```text
visual_quality
functional_correctness
ux_completeness
maintainability
code_readability
change_safety
overall_quality
```

### 6.2 Pairwise comparison

Жюри выбирает лучший из двух:

```text
Variant A vs Variant B
Which app would you rather continue developing?
Which app better matches the task?
Which app has lower maintenance risk?
```

Pairwise часто надёжнее, чем абсолютные оценки.

### 6.3 Ranking

Для 3–5 вариантов:

```text
Rank variants from best to worst for maintainability.
```

### 6.4 Comment capture

Обязательные короткие комментарии:

```text
- strongest positive signal;
- most concerning issue;
- what would break first if requirements change;
- would you accept this codebase as a prototype? yes/no/why.
```

## 7. Jury form schema

```json
{
  "jury_session_id": "jury_2026_07_mvp_001",
  "judge_id": "anon_judge_003",
  "judge_role": ["frontend", "engineering"],
  "variant_id": "variant_001",
  "task_id": "todomvc",
  "version_id": "v4",
  "scores": {
    "functional_correctness": 6,
    "visual_quality": 5,
    "ux_completeness": 5,
    "maintainability": 4,
    "code_readability": 4,
    "change_safety": 3,
    "overall_quality": 5
  },
  "binary": {
    "would_continue_development": true,
    "needs_rewrite_soon": false
  },
  "comments": {
    "positive": "UI is clean and core flows work.",
    "concern": "Task filtering and search logic are duplicated.",
    "expected_failure_point": "Adding custom views would probably touch many files."
  },
  "confidence": 4,
  "time_spent_minutes": 12,
  "created_at": "2026-07-08T12:00:00.000Z"
}
```

## 8. Scoring scales

Использовать 1–7, не 1–10:

```text
1 = unusable / very poor
2 = poor
3 = below acceptable
4 = acceptable prototype
5 = good
6 = very good
7 = excellent
```

Для maintainability:

```text
1 = needs rewrite now
2 = very hard to change safely
3 = noticeable spaghetti/duplication
4 = acceptable but fragile
5 = mostly clean, some issues
6 = easy to change
7 = very clean and robust for task size
```

## 9. Sampling strategy

Не давать жюри все 100+ trajectories. Выбирать sample:

```text
- best automated score per prompt arm;
- median run per prompt arm;
- worst passing run per prompt arm;
- disagreement candidates;
- high visual / low code-health cases;
- low visual / high maintainability cases.
```

MVP sample:

```text
3 tasks × 3 prompt arms × 2 variants = 18 review items
```

Если мало людей:

```text
- 6–9 variants total;
- focus on pairwise comparisons.
```

## 10. Randomization and bias control

Runner should:

```text
- randomize variant order per judge;
- avoid showing same prompt/model cluster consecutively;
- use neutral labels;
- keep reference requirements identical;
- hide automated score;
- hide token cost;
- hide run status unless reviewing failure cases intentionally.
```

## 11. Aggregation

### 11.1 Absolute score

```text
human_score = average normalized score across relevant dimensions
```

Role-specific:

```text
product_human_score
ui_human_score
engineering_human_score
qa_human_score
```

### 11.2 Pairwise win rate

```text
pairwise_win_rate = wins / comparisons
```

### 11.3 Agreement with automated metrics

Compute:

```text
- Spearman rank correlation, optional;
- pairwise agreement rate;
- disagreement table.
```

MVP can output simple:

```text
same_top_variant: yes/no
same_bottom_variant: yes/no
pairwise_agreement_percent
```

## 12. Disagreement analysis

Important cases:

```text
- automated high, human low:
  tests too shallow, code ugly, UX poor, visual off.

- automated low, human high:
  tests too strict, visual pixel diff unfair, implementation acceptable.

- code-health high, engineering judge low:
  metrics missing architectural coupling.

- engineering judge high, token cost high:
  maybe overengineering.
```

## 13. CLI for jury packets

```bash
pnpm bench jury export \
  --run runs/<matrix-id> \
  --sample balanced \
  --versions final,v0 \
  --mode blind \
  --out runs/<matrix-id>/jury-packet
```

```bash
pnpm bench jury import \
  --run runs/<matrix-id> \
  --input jury-results.csv
```

```bash
pnpm bench jury report \
  --run runs/<matrix-id>
```

## 14. Human review ethics/privacy

Для внешнего жюри:

```text
- не включать данные, отправленные free models, если они sensitive;
- не включать секреты/environment;
- не публиковать raw model outputs, если provider terms restrict;
- если source snapshot содержит зависимости, не включать node_modules;
- явно указать, что review packet anonymized but may contain generated code.
```

## 15. Minimal MVP implementation

Первый вариант может быть полностью static:

```text
- generate jury-packet as folder of markdown/html/images;
- use Google Form/Typeform/custom CSV manually;
- import CSV later;
- no need to build web app for jury.
```

Форма из `templates/external_jury_form_template.md` достаточна для первой итерации.
