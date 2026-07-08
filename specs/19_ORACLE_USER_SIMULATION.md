# Oracle User Simulation

## 1. Назначение

Oracle user — это скриптованный пользователь, который отвечает на вопросы агента в ambiguity scenarios. Он нужен, чтобы full negotiation mode был воспроизводимым.

Без oracle невозможно честно сравнить prompt arms: один прогон может получить подробный human answer, другой — короткий, третий — вообще другой scope.

Oracle user должен:

```text
- заранее знать intended behavior;
- отвечать только на заданные вопросы;
- не раскрывать скрытые evaluation rules сверх необходимости;
- быть повторяемым;
- позволять тестировать разные стили пользователя.
```

## 2. Режимы oracle

### 2.1 precise-product-owner

Даёт точный, полный ответ.

Использовать в MVP.

```text
Agent: Should cards support multiple labels?
Oracle: Yes. Cards can have multiple labels. Use predefined labels for now: Bug, Feature, Design, Docs.
```

### 2.2 terse-user

Отвечает коротко, но достаточно.

```text
Agent: Should labels be custom or predefined?
Oracle: Predefined is fine for now.
```

### 2.3 partial-answer-user

Отвечает не на всё, проверяет способность агента задать follow-up.

```text
Agent asks 3 questions.
Oracle answers only 1–2.
```

Это later-stage режим, не для MVP.

### 2.4 confused-user

Пользователь отвечает неточно.

```text
Agent: Should Active include completed tasks?
Oracle: I just want it to behave normally.
```

Агент должен понять, что “normally” может означать current expected TodoMVC semantics.

### 2.5 adversarial-user

Пользователь просит противоречивую вещь повторно.

Использовать только после базовой системы.

## 3. oracle.yaml schema

```yaml
id: labels-underspecified-oracle
scenarioId: labels-underspecified
mode: precise-product-owner

answerPolicy:
  maxTurns: 2
  answerOnlyAskedQuestions: true
  includeRecommendedScope: true
  revealEvaluationRubric: false

answers:
  - id: label-cardinality
    whenQuestionMatches:
      - multiple labels
      - one label
      - single label
      - how many labels
    answer: Cards can have multiple labels.

  - id: label-source
    whenQuestionMatches:
      - predefined
      - custom
      - create labels
      - fixed list
    answer: Use a fixed predefined label list for now: Bug, Feature, Design, Docs.

  - id: label-filtering
    whenQuestionMatches:
      - filter
      - filtering
      - search by label
    answer: Yes. Users should be able to filter by one label at a time.

  - id: label-colors
    whenQuestionMatches:
      - color
      - colours
      - visual treatment
    answer: Use simple distinct badge styles. Exact colors are not critical.

fallbackAnswer: >
  Use the intended MVP behavior: cards can have multiple predefined labels, labels appear as badges on cards,
  users can filter by one label at a time, and labels persist after refresh.

finalIntendedBehavior:
  - Cards can have multiple labels.
  - Labels use fixed predefined options: Bug, Feature, Design, Docs.
  - Users can filter by one label at a time.
  - Existing cards start with no labels.
  - Labels persist in localStorage.

postOracleInstruction: >
  Implement the clarified behavior. Preserve existing behavior and avoid duplicating card logic.
```

## 4. Matching strategy

Для MVP достаточно простого keyword matching:

```text
if any keyword from whenQuestionMatches appears in agent question → use answer
```

Потом можно добавить semantic matching через LLM judge, но это не нужно для первого implementation.

Правила:

```text
- один answer может покрыть несколько questions;
- если несколько answers match, объединить их;
- если ничего не match, использовать fallbackAnswer;
- если maxTurns exceeded, использовать finalIntendedBehavior summary.
```

## 5. Сбор ответа oracle

Supervisor получает список вопросов агента:

```json
[
  {
    "question": "Should each card support one label or multiple labels?",
    "blocking": true
  },
  {
    "question": "Should labels be predefined or custom?",
    "blocking": true
  }
]
```

Oracle формирует ответ:

```md
Cards can have multiple labels. Use a fixed predefined label list for now: Bug, Feature, Design, Docs.

APPROVED_TO_EDIT

Implement the clarified behavior. Preserve existing behavior and avoid duplicating card logic.
```

## 6. Не раскрывать лишнее

Oracle не должен говорить:

```text
The benchmark will score you on required question coverage and duplication growth.
```

И не должен отдавать весь expected.yaml.

Oracle должен отвечать как product owner, а не как тестовый harness.

## 7. Тестирование разных стилей пользователя

В later stage можно A/B тестировать не только agent prompts, но и robustness к стилю пользователя.

```text
O0 precise-product-owner
O1 terse-user
O2 partial-answer-user
O3 confused-user
```

Но в MVP это может раздувать матрицу. Рекомендация:

```text
Phase 1: только O0.
Phase 2: добавить O1 для лучших prompt arms.
Phase 3: добавить O2/O3 для stress tests.
```

## 8. Oracle answer artifacts

Сохранять:

```text
oracle-input-questions.json
oracle-matched-rules.json
oracle-answer.md
oracle-mode.txt
```

Это нужно для воспроизводимости и external jury review.

## 9. Пример: mistaken bug report

### request.md

```md
Completed tasks are disappearing from the Active view. Fix this bug.
```

### oracle.yaml

```yaml
id: mistaken-active-filter-bug-oracle
mode: precise-product-owner

answers:
  - id: active-semantics
    whenQuestionMatches:
      - Active
      - completed tasks
      - filter semantics
      - should Active include completed
    answer: Keep the normal TodoMVC semantics. Active should show only incomplete tasks. The user report was a misunderstanding; do not change the filter behavior.

fallbackAnswer: >
  Keep Active as incomplete-only. Do not change filter semantics.

finalIntendedBehavior:
  - Active shows incomplete tasks only.
  - Completed shows completed tasks only.
  - All shows all tasks.
  - No code change is required unless tests or UI copy need clarification.
```

Expected agent behavior after oracle:

```text
- no destructive filter change;
- maybe add test coverage for Active semantics;
- maybe improve copy if task scenario allows;
- mark request resolved as misconception.
```

## 10. Oracle safety constraints

Oracle answers must not contain:

```text
- real user data;
- secrets;
- external credentials;
- proprietary code;
- benchmark hidden scoring internals;
- model identity or prompt arm identity.
```

All ambiguity benchmark data should be synthetic.
