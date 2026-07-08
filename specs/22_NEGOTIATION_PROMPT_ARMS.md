# Negotiation Prompt Arms

## 1. Назначение

Этот документ задаёт A/B/n варианты prompt formulation для проверки requirements negotiation.

Цель — понять, какие формулировки заставляют агента:

```text
- не кодить неправильный запрос молча;
- находить уже реализованный функционал;
- отличать баг от expected behavior;
- задавать точные вопросы;
- не превращаться в бюрократа;
- сохранять скорость и lifecycle cost.
```

## 2. Принцип A/B

Менять по одному фактору.

Плохой вариант:

```text
P0: Implement the change.
P1: Huge product-engineer prompt with many rules, output schema, maintainability constraints, testing policy, UX policy.
```

Хороший вариант:

```text
P0: Implement the requested change.
P1: Before implementing, ask clarification only if ambiguity affects user-visible behavior, data model, existing flows, or regression risk.
```

## 3. Negotiation prompt arms

### P0 — no gate baseline

```md
Implement the requested change. Preserve existing behavior unless the request explicitly says otherwise.
```

Ожидаемый профиль:

```text
+ быстрый;
+ мало уточнений;
- часто молча реализует неправильное;
- высокий silent_wrong_implementation_rate.
```

### P1 — soft clarify

```md
Implement the requested change. If anything is unclear, ask before implementing.
```

Проверяет, достаточно ли общей фразы.

Ожидаемый профиль:

```text
+ иногда спрашивает;
- вопросы часто общие;
- может спрашивать слишком много;
- не задаёт критерии, когда именно спрашивать.
```

### P2 — decision-critical gate

```md
Before implementing, inspect the current app and user request.
Ask clarification only when ambiguity affects user-visible behavior, data model, persistence, migration, existing flows, or regression risk.
If ambiguity is non-blocking, choose the simplest safe default, document the assumption, and proceed.
```

Это главный кандидат для MVP.

Ожидаемый профиль:

```text
+ хороший баланс;
+ меньше лишних вопросов;
+ меньше silent wrong implementation;
+ не должен сильно увеличивать токены.
```

### P3 — product engineer classification

```md
Before coding, classify the request as one of:
- already implemented
- safe to implement
- underspecified
- conflicting with current behavior
- requiring hidden scope expansion
- missing external reference

If the request is underspecified or conflicting, ask up to 3 targeted questions and include a recommended default.
```

Проверяет пользу явной классификации.

Ожидаемый профиль:

```text
+ хорошо на feature-already-exists/user-misconception;
+ хороший explainability;
- может быть дороже по токенам;
- может over-classify простые задачи.
```

### P4 — assumption-first

```md
Prefer implementation over clarification. Make reasonable assumptions, implement the change, and document those assumptions. Ask only if the request is impossible to implement safely.
```

Нужен как контраст.

Ожидаемый профиль:

```text
+ низкая latency;
+ мало turns;
- риск неправильного intent;
- может выигрывать на простых incomplete requests;
- должен проигрывать на blocking ambiguity.
```

### P5 — contract-first

```md
Do not edit code until you can state clear acceptance criteria for the requested change.
If acceptance criteria cannot be inferred safely from the request and current app behavior, ask targeted clarification questions.
After clarification, implement only the agreed behavior.
```

Ожидаемый профиль:

```text
+ высокая correctness;
+ хорошо для complex lifecycle steps;
- риск лишней бюрократии;
- выше question cost.
```

### P6 — existing-behavior-first

```md
Before implementing, first check whether the requested behavior already exists or whether the user is describing current expected behavior as a bug.
Do not duplicate existing UI or change established semantics without confirmation.
```

Проверяет точечно awareness.

Ожидаемый профиль:

```text
+ хорошо для feature-already-exists;
+ хорошо для mistaken bug reports;
- не обязательно помогает на hidden data-model ambiguity.
```

### P7 — hidden-impact-first

```md
Before implementing a change, identify the affected areas: data model, UI, persistence, tests, routing, existing flows, and migration.
If the request requires a product decision across those areas, ask for clarification before editing.
```

Проверяет detection of cross-cutting scope.

Ожидаемый профиль:

```text
+ хорошо для projects/labels/replacement changes;
- может быть многословным;
- может спрашивать там, где safe default нормален.
```

## 4. System vs edit prompt placement

Negotiation instruction можно положить в разные места:

```text
System prompt
  Постоянное поведение агента во всех задачах.

Edit prompt wrapper
  Включается только для evolution/ambiguity steps.

Scenario prompt
  Включается только в конкретном ambiguous request.
```

Рекомендация MVP:

```text
- держать system prompt фиксированным;
- тестировать negotiation prompt как edit wrapper;
- не вставлять hidden expected behavior в scenario prompt.
```

## 5. Матрица MVP

```text
Task: TodoMVC
Models: deepseek-v4-flash-free, mimo-v2.5-free, nemotron-3-ultra-free
Negotiation arms: P0, P2, P3, P5
Scenarios: 6 ambiguity scenarios
Runs: 2
Mode: preflight-only first
```

Количество:

```text
3 models × 4 arms × 6 scenarios × 2 runs = 144 preflight runs
```

Потом full negotiation только для лучших/худших:

```text
3 models × 2 arms × 3 scenarios × 2 runs = 36 full negotiation trajectories
```

## 6. Scoring expectations by arm

```text
P0 no gate
  Low question cost, high silent wrong rate.

P1 soft clarify
  Better than P0, but inconsistent.

P2 decision-critical gate
  Expected best quality/cost balance.

P3 classification
  Expected best explainability and awareness.

P4 assumption-first
  Expected best speed, weaker intent recovery.

P5 contract-first
  Expected high correctness, high false clarify rate.

P6 existing-behavior-first
  Expected strong for already_exists/misconception scenarios.

P7 hidden-impact-first
  Expected strong for data-model/cross-cutting scenarios.
```

## 7. Prompt arm metadata

```yaml
id: P2-decision-critical-gate
name: Decision-critical clarification gate
kind: negotiation-edit-wrapper
version: 1

hypothesis: >
  Explicitly limiting clarification to user-visible behavior, data model, persistence,
  migration, existing flows and regression risk will reduce both silent wrong implementation
  and unnecessary question rate.

promptFile: prompts/negotiation/P2-decision-critical-gate.md

expectedStrengths:
  - underspecified-feature
  - conflict-with-current-behavior
  - hidden-cross-cutting-change

expectedWeaknesses:
  - maybe slower than P0
  - may still miss feature-already-exists unless paired with existing behavior check

metricsOfInterest:
  - decision_accuracy
  - false_clarification_rate
  - silent_wrong_implementation_rate
  - tokens_before_first_action
  - question_precision
```

## 8. Avoiding contamination

Не раскрывать агенту:

```text
- scenario category;
- expectedDecision;
- requiredQuestions;
- oracle finalIntendedBehavior before he asks;
- prompt arm id;
- scoring weights.
```

Можно раскрывать:

```text
- текущий код;
- текущие public specs;
- пользовательский request;
- общие правила preflight protocol.
```

## 9. Report slices

Аналитика должна строить отчёты:

```text
By prompt arm:
  P0 vs P2 vs P3 vs P5.

By category:
  feature-already-exists, user-misconception, missing-critical-details, hidden-cross-cutting.

By model:
  Which model needs stronger negotiation prompt?

By cost:
  Does stronger gate pay for itself by reducing wrong implementations?

By lifecycle stage:
  Are agents worse at v6 than at v1?
```
