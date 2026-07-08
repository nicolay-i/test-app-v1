# Requirements Negotiation Benchmark

## 1. Назначение

Этот слой benchmark-а проверяет не только способность агента писать код, а способность работать с неполными, ошибочными, противоречивыми или устаревшими требованиями.

Основной вопрос:

```text
Может ли coding agent понять, что запрос на доработку нельзя безопасно реализовывать буквально?
```

В реальной разработке пользователь часто пишет неидеально:

```text
- просит добавить функционал, который уже есть;
- описывает симптом, но ошибается в причине;
- считает багом нормальное поведение;
- просит маленькое изменение, которое требует скрытых изменений в модели данных;
- забывает указать критичные детали;
- просит вернуть старое поведение, но оно уже было изменено в предыдущих шагах;
- использует неверное название экрана, сущности или компонента.
```

Плохой агент молча реализует буквальный текст и создаёт неправильную фичу. Хороший агент сначала проверяет текущее состояние, восстанавливает намерение и задаёт только те вопросы, без которых нельзя принять продуктовое решение.

## 2. Термины

```text
Ambiguity scenario
  Сценарий доработки, где исходный пользовательский запрос специально содержит неточность, пропуск, ошибку или скрытое влияние на систему.

Preflight
  Фаза до редактирования файлов, в которой агент обязан классифицировать запрос и решить, можно ли кодить сразу.

Clarification gate
  Правило, запрещающее агенту редактировать код до тех пор, пока supervisor не разрешит это после preflight-ответа.

Oracle user
  Скриптованный пользователь, который заранее знает intended behavior и отвечает на вопросы агента.

Intent recovery
  Способность агента восстановить реальное намерение задачи, а не следовать буквальному, но ошибочному тексту.
```

## 3. Где это стоит в общей архитектуре benchmark-а

Базовая траектория:

```text
v0 generation → evolution changes → maintainability metrics
```

Новая траектория:

```text
v0 generation
  → normal evolution change
  → ambiguity scenario preflight
  → clarification/oracle turn if needed
  → implementation
  → regression/e2e/code-health checks
  → next evolution step
```

Ambiguity scenarios должны вставляться как отдельные шаги lifecycle benchmark-а, потому что способность агента понимать требования ухудшается по мере роста кодовой базы.

## 4. Типы сценариев

### 4.1 Feature already exists

Запрос:

```text
Add search to the task list.
```

Текущее состояние:

```text
Search already exists.
```

Ожидаемое поведение агента:

```text
- проверить код и/или UI;
- обнаружить существующую фичу;
- не создавать дублирующий search input;
- уточнить, нужно ли расширить существующий поиск;
- при необходимости добавить недостающие тесты.
```

### 4.2 User misconception

Запрос:

```text
Fix the bug where completed tasks disappear from Active.
```

Текущее состояние:

```text
Active filter intentionally shows only incomplete tasks.
```

Ожидаемое поведение:

```text
- объяснить, что это не баг, а текущая семантика фильтра;
- спросить, нужно ли менять значение Active;
- не ломать фильтры молча.
```

### 4.3 Missing critical details

Запрос:

```text
Add labels to cards.
```

Не хватает решений:

```text
- одна метка или несколько;
- фиксированный список или пользовательские labels;
- нужны ли цвета;
- нужен ли фильтр;
- как мигрировать существующие карточки;
- как labels сохраняются.
```

### 4.4 Contradiction with current behavior

Запрос:

```text
Make every task require a due date.
```

Текущее поведение:

```text
Quick-add creates tasks with title only.
```

Ожидаемое поведение:

```text
- обнаружить конфликт с quick-add;
- спросить, можно ли менять быстрый сценарий;
- предложить default: due date optional, not required, unless confirmed.
```

### 4.5 Hidden cross-cutting change

Запрос:

```text
Add projects.
```

Неявное влияние:

```text
- task data model;
- create/edit form;
- sidebar/views;
- counters;
- filters;
- persistence;
- empty states;
- tests;
- possible migration for existing tasks.
```

Агент должен явно увидеть blast radius.

### 4.6 Ambiguous replacement

Запрос:

```text
Replace priority with severity tags.
```

Ожидается:

```text
- спросить про mapping старых priority values;
- уточнить, полностью ли удалять priority UI/state/tests;
- уточнить, severity single или multi-value;
- не оставлять dead code после замены.
```

### 4.7 Deletion with cleanup

Запрос:

```text
Remove comments.
```

Ожидается:

```text
- удалить UI;
- удалить state/types/helpers;
- обновить persistence migration;
- удалить или обновить тесты;
- не оставлять скрытый мёртвый функционал.
```

### 4.8 Missing reference asset

Запрос:

```text
Make the dashboard match the new design.
```

При этом в task bundle нет нового screenshot/Figma/semantic UI.

Ожидается:

```text
- запросить дизайн-референс;
- не делать произвольный redesign;
- если разрешено, предложить только general polish без claims о match.
```

### 4.9 Confusing naming

Запрос:

```text
Move task status into the project list.
```

В приложении нет сущности `project list`, есть sidebar projects и main task list.

Ожидается:

```text
- спросить, что именно пользователь называет project list;
- не переносить состояние в случайное место.
```

### 4.10 Scope explosion

Запрос:

```text
Add sharing.
```

В frontend-only/localStorage приложении sharing требует:

```text
- users;
- permissions;
- invites;
- backend or mock contract;
- persistence model;
- access states.
```

Ожидается:

```text
- выявить, что это не маленькая локальная фича;
- спросить scope;
- предложить MVP default, например local-only mock sharing.
```

## 5. Режимы запуска

### 5.1 Preflight-only mode

Агент не редактирует файлы. Он анализирует текущий код, требования и возвращает decision block.

Использование:

```text
- дешёвый массовый A/B тест формулировок;
- проверка, какие system/user prompt arms лучше включают product judgment;
- сбор decision accuracy без стоимости полной реализации.
```

Выход:

```json
{
  "decision": "clarify",
  "confidence": 0.82,
  "reason": "Labels affect data model, forms, display, filtering and persistence, but the request does not define cardinality or filtering.",
  "questions": [
    "Should cards support one label or multiple labels?",
    "Should labels be predefined or user-created?",
    "Should users be able to filter by label?"
  ],
  "recommendedDefault": "Use multiple labels from a fixed predefined set and allow filtering by one label at a time.",
  "affectedAreas": ["card model", "create/edit form", "card UI", "filter controls", "localStorage", "tests"],
  "willEdit": false
}
```

### 5.2 Full negotiation mode

Полный цикл:

```text
1. Supervisor передаёт агенту ambiguous request.
2. Агент возвращает decision block.
3. Harness оценивает decision.
4. Если decision = clarify, oracle user отвечает на вопросы.
5. Supervisor отправляет oracle answer агенту.
6. Агент реализует изменение.
7. Запускаются regression + new feature tests.
8. Сохраняются diff/code-health/token metrics.
```

Этот режим дороже, но он ближе к реальной разработке.

## 6. Решения агента

Разрешённые decision values:

```text
proceed
  Запрос достаточно понятен. Можно кодить сразу.

clarify
  Без ответа пользователя есть риск неверного user-visible behavior, data model decision или regression.

already_exists
  Функционал уже есть полностью или частично. Нужно не дублировать, а проверить/расширить.

conflict
  Запрос противоречит текущей семантике, прошлым acceptance criteria или существующему UX.

out_of_scope
  Запрос требует capabilities, которых нет в scaffold/task constraints, например backend/auth/external service.

cannot_validate
  Агент не может определить intended behavior из доступного контекста и должен запросить missing asset/reference/details.
```

## 7. Что считается хорошим поведением

Хороший агент:

```text
- сначала смотрит текущую реализацию;
- отличает баг от expected behavior;
- не дублирует существующую фичу;
- видит скрытый blast radius;
- задаёт 1–3 decision-critical вопроса;
- предлагает recommended default;
- не блокирует работу из-за несущественных деталей;
- после уточнения реализует именно уточнённую задачу;
- сохраняет regression behavior;
- не оставляет dead code после replacement/deletion changes.
```

Плохой агент:

```text
- молча кодит буквальный запрос;
- задаёт длинный список общих вопросов;
- просит уже известные детали;
- добавляет второй дублирующий UI;
- меняет старую семантику без согласования;
- забывает миграцию данных;
- реализует только визуальную оболочку без data model;
- не обновляет тесты/состояния/empty states.
```

## 8. Метрики

### 8.1 Decision accuracy

```text
1.0 = decision совпадает с expectedDecision
0.5 = decision допустим, но менее предпочтителен
0.0 = decision неправильный
```

Пример:

```text
expected: already_exists
agent: clarify with correct observation that feature exists but needs scope for extension
score: 0.5–0.8 depending on scenario config
```

### 8.2 Clarification recall

Доля обязательных decision-critical topics, которые агент поднял.

```text
requiredTopicsCovered / requiredTopicsTotal
```

### 8.3 Clarification precision

Доля заданных вопросов, которые реально нужны.

```text
relevantQuestions / totalQuestions
```

### 8.4 Existing behavior awareness

Понял ли агент текущее состояние приложения.

```text
- feature exists;
- behavior intentional;
- component renamed;
- current data model already supports part of request.
```

### 8.5 Hidden impact detection

Понял ли агент, какие области нужно менять.

```text
matchedAffectedAreas / expectedAffectedAreas
```

### 8.6 Silent wrong implementation rate

Критическая метрика:

```text
сколько раз агент молча реализовал неправильную трактовку, хотя должен был уточнить
```

### 8.7 False clarification rate

```text
сколько раз агент спрашивал там, где запрос был достаточно понятен
```

### 8.8 Question cost

```text
number_of_questions
clarification_turns
tokens_before_first_action
unnecessary_question_count
```

### 8.9 Post-clarification implementation score

После oracle answer:

```text
- new feature tests pass;
- old regression tests pass;
- implementation matches clarified intent;
- maintainability metrics do not degrade sharply.
```

## 9. Scoring

Preflight score:

```text
clarification_score =
  30% decision_accuracy
+ 20% required_topic_recall
+ 15% question_precision
+ 15% existing_behavior_awareness
+ 10% hidden_impact_detection
+ 10% recommended_default_quality
- unnecessary_question_penalty
```

Full negotiated change score:

```text
negotiated_change_score =
  25% clarification_score
+ 30% feature_correctness_after_oracle
+ 20% regression_resistance
+ 15% maintainability_impact
+ 10% token_time_efficiency
```

Lifecycle score with negotiation:

```text
lifecycle_score =
  20% initial_quality
+ 25% evolution_success
+ 20% maintainability_health
+ 15% intent_recovery_score
+ 10% regression_resistance
+ 10% lifecycle_token_efficiency
```

## 10. A/B testing guidance

Тестировать нужно не “умность агента вообще”, а вклад конкретной формулировки.

Плохой A/B:

```text
A: implement the change
B: длинный 600-word product-engineer prompt с 12 новыми правилами
```

Хороший A/B:

```text
A: Implement the requested change.
B: Before implementing, ask clarification only if ambiguity affects user-visible behavior, data model, or existing flows.
```

Рекомендуемые prompt arms описаны в `22_NEGOTIATION_PROMPT_ARMS.md`.

## 11. Acceptance criteria для реализации слоя

Минимальный implementation должен уметь:

```text
- хранить ambiguity scenarios рядом с обычными evolution steps;
- запускать preflight-only режим;
- парсить machine-readable decision block;
- сравнивать decision с expected behavior;
- симулировать oracle user response;
- запускать full negotiation mode;
- включать clarification metrics в общий report;
- экспортировать blind packet для внешнего жюри.
```
