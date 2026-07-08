# Negotiation Scoring and External Jury Review

## 1. Назначение

Автоматические метрики хорошо проверяют build/tests/diff/code-health, но качество вопросов агента лучше валидировать внешним жюри.

Этот документ описывает, как оценивать:

```text
- понял ли агент проблему;
- нужно ли было спрашивать;
- были ли вопросы точными;
- не было ли лишней бюрократии;
- правильно ли агент реализовал после ответа oracle;
- какой prompt arm ведёт себя более “как сильный product engineer”.
```

## 2. Автоматический scoring

Автоматическая часть:

```text
preflight_score
implementation_score_after_oracle
regression_score
code_health_delta
question_cost
protocol_violations
```

Пример `scores.json`:

```json
{
  "scenarioId": "labels-underspecified",
  "preflight": {
    "decisionAccuracy": 1.0,
    "requiredTopicRecall": 0.75,
    "questionPrecision": 0.9,
    "existingBehaviorAwareness": 0.7,
    "hiddenImpactDetection": 0.8,
    "recommendedDefaultQuality": 0.85,
    "unnecessaryQuestionPenalty": 0.0,
    "protocolViolation": false,
    "score": 0.83
  },
  "implementation": {
    "newFeaturePassRate": 0.92,
    "regressionPassRate": 1.0,
    "intentMatch": 0.9,
    "maintainabilityImpact": 0.78,
    "tokenEfficiency": 0.71,
    "score": 0.87
  },
  "overallNegotiatedChangeScore": 0.86
}
```

## 3. Jury review modes

### 3.1 Absolute review

Жюри оценивает один вариант по шкалам 1–5.

Плюсы:

```text
- просто агрегировать;
- хорошо для калибровки.
```

Минусы:

```text
- разные reviewers используют шкалы по-разному;
- трудно различить близкие варианты.
```

### 3.2 Pairwise review

Жюри сравнивает два варианта:

```text
Which agent response was better?
```

Плюсы:

```text
- проще принимать решение;
- хорошо для A/B;
- меньше variance.
```

Рекомендация: для основных A/B выводов использовать pairwise review.

### 3.3 Gold review

Жюри видит intended behavior и оценивает соответствие.

Использовать для калибровки автоматического scoring.

### 3.4 Blind review

Жюри не видит:

```text
- model id;
- prompt arm id;
- expected decision;
- auto score;
- имя агента.
```

Использовать для финального сравнения prompt arms.

## 4. Jury packet для ambiguity scenario

```text
jury-packet/
  README.md
  current_app_summary.md
  user_request.md
  agent_preflight_response.md
  agent_questions.md
  oracle_answer.md
  final_behavior_summary.md
  diff_summary.md
  screenshots/
    before.png
    after.png
  test_summary.md
  code_health_summary.md
  review_form.md
```

## 5. Что показывать жюри

Показывать:

```text
- краткое описание текущего приложения;
- пользовательский запрос;
- ответ агента до реализации;
- вопросы агента;
- ответ oracle user;
- что агент изменил;
- прошли ли тесты;
- screenshots до/после;
- краткий code-health summary.
```

Не показывать в blind mode:

```text
- model name;
- prompt arm;
- system prompt;
- expected.yaml;
- internal score;
- порядок вариантов, если он может подсказать winner.
```

## 6. Review form

```md
# Ambiguity Scenario Review Form

Variant: {{ANON_VARIANT_ID}}
Scenario: {{SCENARIO_NAME}}

## 1. Decision quality

Did the agent choose the right high-level action?

- 5: clearly right
- 4: mostly right
- 3: acceptable but imperfect
- 2: likely wrong
- 1: clearly wrong

Score: ___

## 2. Need for clarification

Did the agent correctly decide whether clarification was needed?

Score 1–5: ___

## 3. Question quality

Were the questions specific, decision-critical, and not excessive?

Score 1–5: ___

## 4. Existing behavior awareness

Did the agent understand what was already implemented and how the current app behaves?

Score 1–5: ___

## 5. Hidden impact awareness

Did the agent identify affected areas such as data model, persistence, tests, migration, old flows?

Score 1–5: ___

## 6. Post-clarification implementation

After the oracle answer, did the final implementation match the intended behavior?

Score 1–5: ___

## 7. Product-engineer preference

Would you trust this agent to handle unclear product requests in a real codebase?

- yes
- weak yes
- unsure
- weak no
- no

Answer: ___

## 8. Notes

Free-form comments:

```
...
```
```

## 7. Pairwise form

```md
# Pairwise Ambiguity Review

Scenario: {{SCENARIO_NAME}}

You are comparing two anonymized agents handling the same unclear request.

## Which response handled the product ambiguity better?

- Variant A much better
- Variant A slightly better
- Tie
- Variant B slightly better
- Variant B much better

Choice: ___

## Why?

Consider:
- Did the agent ask only necessary questions?
- Did it detect existing behavior or contradiction?
- Did it avoid silent wrong implementation?
- Did it provide a useful default?
- Did it preserve old behavior after implementation?

Notes:

```
...
```
```

## 8. Aggregation

Absolute review:

```text
jury_score = average(normalized_dimension_scores)
```

Pairwise review:

```text
win_rate = wins / comparisons
bradley_terry_score optional later
```

Recommended report fields:

```text
- auto_negotiation_score
- jury_negotiation_score
- auto_jury_delta
- pairwise_win_rate
- false_clarification_rate
- silent_wrong_implementation_rate
```

## 9. Auto-vs-jury calibration

After collecting jury data:

```text
1. Compare auto score and jury score.
2. Find scenarios where auto score overestimates.
3. Adjust weights or requiredTopics.
4. Mark scenario configs that are too vague.
```

Common mismatch:

```text
Auto score likes many questions.
Jury penalizes because questions are excessive.
```

Fix:

```text
Increase unnecessaryQuestionPenalty and questionPrecision weight.
```

## 10. Reviewer roles

Useful reviewer types:

```text
Product reviewer
  Evaluates whether clarification/product behavior was appropriate.

Frontend reviewer
  Evaluates implementation impact and UI/UX result.

Engineering reviewer
  Evaluates maintainability and code-level consequences.

QA reviewer
  Evaluates regression risk and testability.
```

For MVP:

```text
1 product-minded engineer + 1 frontend engineer
```

is enough to calibrate.

## 11. Review sampling

Не нужно отправлять жюри все артефакты.

Рекомендация:

```text
- all variants for 2–3 key ambiguity scenarios;
- top 2 and bottom 2 prompt arms by auto score;
- cases where auto score and tests disagree;
- cases with protocol violations;
- cases where agent asked many questions.
```

## 12. Report table

```text
| Prompt Arm | Auto Score | Jury Score | Pairwise Win Rate | Silent Wrong Rate | False Clarify Rate | Notes |
|------------|-----------:|-----------:|------------------:|------------------:|-------------------:|-------|
| P0 no gate | 0.42 | 0.35 | 18% | 44% | 3% | Codes too early |
| P2 decision gate | 0.79 | 0.82 | 71% | 9% | 12% | Best balance |
| P5 contract-first | 0.76 | 0.68 | 58% | 4% | 31% | Too many questions |
```
