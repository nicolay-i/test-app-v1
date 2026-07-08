# Code Health and Maintainability Metrics

## 1. Зачем это нужно

Качество `v0` не показывает, насколько приложение можно поддерживать. Нужно измерять, как кодовая база деградирует при последовательных изменениях.

Основные симптомы деградации:

```text
- лапша в одном большом компоненте;
- дубли логики и UI;
- hard-coded branches;
- inconsistent state;
- изменение маленькой фичи требует правок в 10 местах;
- рост токенов на каждую следующую доработку;
- регрессии старого поведения;
- мёртвый код после удаления фич.
```

## 2. Метрики MVP

### 2.1 LOC total

```text
Общее количество строк в src/**/*.{ts,tsx,js,jsx,css}
```

Использование:

```text
- следить за раздуванием;
- нормализовать diff size;
- считать growth rate.
```

### 2.2 Largest file LOC

```text
Размер самого большого source-файла.
```

Сигнал:

```text
App.tsx вырос до 800+ строк → высокая вероятность лапши.
```

### 2.3 File count

```text
Количество source-файлов.
```

Не всегда меньше лучше. Использовать вместе с overengineering penalty.

### 2.4 Changed files per step

```text
changed_files_count(version_k)
```

Сравнивать с expected blast radius:

```text
small change → 1–4 файла ожидаемо
medium change → 3–8 файлов ожидаемо
large/refactor → 8+ может быть нормально
```

### 2.5 Changed lines per step

```text
added_lines
deleted_lines
modified_lines
```

### 2.6 Rewrite ratio

```text
rewrite_ratio = changed_lines / max(total_loc_before_change, 1)
```

Высокий rewrite_ratio для small change — плохой сигнал.

### 2.7 Duplication ratio

Использовать jscpd или аналог.

jscpd — copy/paste detector for programming source code. Он подходит для поиска дублированных блоков в TS/JS/CSS.

MVP fields:

```json
{
  "duplicatedLines": 120,
  "totalLines": 1800,
  "duplicationRatio": 0.066,
  "clonesCount": 8
}
```

### 2.8 Complexity violations

ESLint rule `complexity` считает cyclomatic complexity и может ругаться при превышении порога.

MVP:

```text
threshold = 12 for functions/components
```

Сохранять:

```text
- count of violations;
- max complexity;
- files with violations.
```

### 2.9 Dependency cycles

Использовать dependency-cruiser или аналог.

Сохранять:

```text
- cycles_count;
- rule_violations_count;
- forbidden_dependency_count;
```

### 2.10 Unused exports/dead code

Использовать ts-prune или TypeScript/linter equivalent.

Особенно важно после deletion steps:

```text
- priority удалили, но PriorityBadge/priority utils остались;
- projects удалили, но types/selectors/components остались.
```

### 2.11 Dependency count

Сохранять изменения `package.json`:

```text
- added runtime dependencies;
- added dev dependencies;
- suspicious heavy dependencies;
- dependency churn.
```

Правило:

```text
Лишняя зависимость для простой фичи = overengineering/dependency penalty.
```

## 3. Derived maintainability metrics

### 3.1 Code entropy score

```text
code_entropy_score = weighted average of normalized:
- duplication growth
- largest file growth
- complexity violations
- dependency cycles
- dead code count
- dependency count growth
```

Чем выше — тем хуже.

### 3.2 Change locality score

```text
expected = blast_radius_threshold_for_step
actual = changed_files_count

if actual <= expected.max_files:
  score = 1.0
else:
  score = max(0, 1 - (actual - expected.max_files) / expected.max_files)
```

### 3.3 Regression resistance

```text
regression_resistance = passed_old_tests / total_old_tests
```

### 3.4 Maintenance cost growth

```text
token_growth_k = tokens_k / median(tokens_1..tokens_3)
```

Плохой сигнал:

```text
token_growth_k > 3.0 for small/medium changes
```

### 3.5 Cost per successful change

```text
cost_per_successful_change = total_tokens_until_version / successful_versions_count
```

### 3.6 Survival score

```text
survival_score = successful_versions / planned_versions
```

### 3.7 Overengineering penalty

Считать отдельно, чтобы архитектурные промпты не побеждали за счёт ненужного boilerplate.

Сигналы:

```text
- слишком много файлов для маленькой задачи;
- абстракции без повторного использования;
- generic managers/services для простого localStorage app;
- state library без необходимости;
- dependency injection setup для маленького UI;
- чрезмерный folder nesting;
- много типов, которые не улучшают safety.
```

MVP proxy:

```text
overengineering_penalty =
  extra_file_count_penalty +
  dependency_penalty +
  abstraction_keyword_penalty +
  low_functionality_high_loc_penalty
```

## 4. Maintainability Score

```text
maintainability_score =
  0.25 * survival_score +
  0.20 * regression_resistance +
  0.15 * change_locality_score +
  0.15 * duplication_control_score +
  0.10 * complexity_control_score +
  0.10 * token_growth_control_score +
  0.05 * dead_code_cleanup_score -
  overengineering_penalty
```

## 5. Метрики по версиям

Каждая версия должна сохранять:

```json
{
  "version": "v3",
  "locTotal": 1430,
  "largestFile": {
    "path": "src/App.tsx",
    "loc": 420
  },
  "fileCount": 18,
  "changedFiles": 5,
  "addedLines": 120,
  "deletedLines": 24,
  "rewriteRatio": 0.10,
  "duplicationRatio": 0.04,
  "complexityViolations": 1,
  "dependencyCycles": 0,
  "unusedExports": 2,
  "runtimeDependencies": 6,
  "tokensThisStep": 31200,
  "repairTokensThisStep": 0
}
```

## 6. Red flags

Runner/report должен подсвечивать:

```text
- App.tsx или один компонент > 500 LOC;
- duplication ratio вырос в 2 раза;
- small change touched > 8 files;
- dependency cycles > 0;
- old tests fail after unrelated change;
- deletion step leaves many unused exports;
- token cost per change grows > 3x;
- package.json changed without task need;
- massive rewrite after small prompt.
```

## 7. Что не стоит делать в MVP

```text
- Не пытаться автоматически понять всю архитектуру идеально.
- Не делать LLM architecture judge главным score.
- Не считать большой diff всегда плохим: у refactor steps expected blast radius выше.
- Не штрафовать за декомпозицию, если она действительно помогает.
```

## 8. Report examples

```text
Prompt U5 vs U1 on TodoMVC:
- U5 had lower initial visual polish by 3 points.
- U5 survived all 6 evolution steps.
- U1 failed at v4 after replacing filters with views.
- U1 duplication ratio grew from 2% to 13%.
- U5 token cost per successful version was 38% lower.
```
