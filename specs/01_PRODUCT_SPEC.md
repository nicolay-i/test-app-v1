# Product Spec

## 1. Название

Рабочее название:

```text
App Prompt Evolution Benchmark
```

Коротко:

```text
APE Benchmark
```

## 2. Проблема

Обычная оценка coding models проверяет, может ли модель сгенерировать рабочий `v0`. Это недостаточно для реальной разработки. Важнее понять:

```text
- какой промпт даёт хороший старт;
- какой промпт создаёт кодовую базу, которую можно менять;
- как быстро код превращается в лапшу;
- сколько токенов стоят последующие изменения;
- когда модель начинает чинить одно и ломать другое.
```

Проект должен измерять качество не одной генерации, а полного жизненного цикла приложения.

## 3. Целевая гипотеза

Для каждой модели существует не один универсальный лучший промпт, а профиль:

```text
model × task_type × prompt_formulation × asset_representation × edit_style
```

Этот профиль определяет:

```text
- лучший initial prompt для v0;
- лучший prompt для доработок;
- минимальный достаточный уровень детализации;
- формулировки, которые снижают деградацию кода;
- формулировки, которые создают overengineering;
- cost/quality frontier.
```

## 4. Пользователи системы

### 4.1 Исследователь / benchmark author

Хочет сравнить модели и промпты на повторяемых задачах.

Нужны:

```text
- матрицы экспериментов;
- автоматические метрики;
- воспроизводимые артефакты;
- отчёты;
- экспорт для внешнего жюри.
```

### 4.2 Prompt engineer

Хочет найти формулировку, которая даёт стабильный код на дистанции.

Нужны:

```text
- сравнение prompt arms;
- анализ sensitivity to wording;
- влияние acceptance criteria / semantic UI / maintainability instructions;
- токен-расход и стоимость.
```

### 4.3 Engineering lead

Хочет понять, можно ли использовать конкретную модель в продуктовой генерации.

Нужны:

```text
- survival score;
- regression rate;
- maintainability score;
- code-health degradation;
- examples of failures.
```

### 4.4 Внешний эксперт / жюри

Хочет оценить качество без знания модели и промпта.

Нужны:

```text
- анонимизированный review packet;
- чеклист;
- форма оценки;
- возможность сравнить варианты pairwise;
- возможность оставить комментарии.
```

## 5. Scope MVP

### Входит

```text
- Node.js/TypeScript runner.
- OpenCode integration через opencode run.
- Vite React TypeScript scaffold.
- Task registry.
- Prompt compiler.
- Playwright checks.
- Visual snapshot checks.
- Value assertions.
- Code-health metrics.
- Git diff metrics.
- Lifecycle/evolution runner.
- External jury packet export.
- JSON/CSV result export.
- Markdown report generation.
```

### Не входит в MVP

```text
- Полноценный web UI для управления benchmark-ом.
- Сложная статистика Bayesian testing.
- Автоматический импорт из Figma API.
- Поддержка backend/fullstack beyond mock/localStorage apps.
- Полноценный secure sandbox с контейнерами на каждый run.
```

## 6. Non-goals

Система не должна пытаться:

```text
- объявить одну модель лучшей во всех задачах;
- копировать коммерческие продукты 1:1;
- оценивать только visual similarity;
- полагаться только на LLM judge;
- оценивать качество без сохранённых артефактов.
```

## 7. Ключевые outputs

### 7.1 Prompt leaderboard

```text
Prompt arm → mean score → variance → win rate → cost
```

### 7.2 Model prompt profile

```text
Model X:
- best initial prompt type
- best edit prompt type
- needs semantic UI: yes/no
- sensitive to acceptance criteria: high/medium/low
- maintainability risk: high/medium/low
- average tokens per successful change
```

### 7.3 Lifecycle report

```text
- survived_versions
- first_failure_version
- regression_rate_by_version
- token_growth_curve
- duplication_growth_curve
- largest_file_growth_curve
- change_blast_radius
```

### 7.4 Jury validation report

```text
- human visual score
- human UX score
- human maintainability score
- pairwise preference
- agreement with automated metrics
- disagreement cases for calibration
```

## 8. Definition of Done for MVP

MVP считается готовым, если можно выполнить:

```bash
pnpm bench run-matrix --config configs/mvp.yaml
pnpm bench report --run runs/<matrix-id>
pnpm bench jury export --run runs/<matrix-id> --sample balanced
```

И получить:

```text
- runs/<matrix-id>/results.jsonl
- runs/<matrix-id>/scores.csv
- runs/<matrix-id>/report.md
- runs/<matrix-id>/jury-packet/
```

## 9. Принципиальные решения

### 9.1 Reference apps должны быть заморожены

Не сравнивать с live Todoist/Trello/Medium. Использовать open/permissive sources как основу, затем фиксировать:

```text
- screenshots;
- semantic UI tree;
- expected values;
- e2e traces;
- mock data;
- acceptance criteria.
```

### 9.2 Text-only режим по умолчанию

Для первого сравнения deepseek/mimo/nemotron все получают одинаковое текстовое представление. Даже если модель умеет работать с картинками, raw screenshots включаются отдельным режимом.

### 9.3 Внешнее жюри оценивает вслепую

Жюри не должно видеть:

```text
- model_id;
- prompt_arm_id;
- token usage;
- автоматический final score;
- порядок генерации.
```

После сбора оценок можно раскрыть метаданные и сравнить human ranking с automated ranking.
