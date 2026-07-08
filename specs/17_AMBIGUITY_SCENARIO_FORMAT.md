# Ambiguity Scenario Format

## 1. Назначение

Ambiguity scenario описывает пользовательский запрос на доработку, который нельзя оценивать как обычную implementation task. В таком сценарии правильное поведение агента может быть:

```text
- спросить уточнение;
- обнаружить, что фича уже есть;
- объяснить конфликт с текущим поведением;
- предложить безопасный default;
- отказаться от реализации до получения missing asset/reference;
- реализовать сразу, если неопределённость не блокирующая.
```

## 2. Рекомендуемая структура директорий

```text
tasks/todomvc/
  ambiguity/
    01-search-already-exists/
      request.md
      expected.yaml
      oracle.yaml
      tests-after-oracle.spec.ts
      jury-context.md

    02-mistaken-active-filter-bug/
      request.md
      expected.yaml
      oracle.yaml
      tests-after-oracle.spec.ts
      jury-context.md

    03-projects-underdescribed/
      request.md
      expected.yaml
      oracle.yaml
      tests-after-oracle.spec.ts
      jury-context.md
```

Можно хранить сценарии и плоско:

```text
tasks/todomvc/scenarios/ambiguous/01-search-already-exists.md
tasks/todomvc/scenarios/ambiguous/01-search-already-exists.expected.yaml
```

Но директория на сценарий удобнее, потому что рядом можно держать tests, oracle и jury context.

## 3. request.md

Файл содержит ровно то, что “пользователь” отправляет агенту.

Пример:

```md
# User request

The task list needs search. Add a search input so users can find tasks by title.
```

В request.md не должно быть скрытых подсказок вроде:

```text
Note: search already exists.
```

Иначе scenario перестаёт проверять awareness.

## 4. expected.yaml

Полная схема:

```yaml
id: search-already-exists
name: Search already exists
kind: ambiguity
category:
  - feature-already-exists
  - duplicate-risk

taskId: todomvc
startVersion: v2

requestFile: request.md

expectedDecision:
  primary: already_exists
  acceptable:
    - clarify
    - proceed
  unacceptable:
    - out_of_scope
    - cannot_validate

blockingClarification: false

expectedAgentFindings:
  required:
    - id: current-search-exists
      description: Agent detects that the app already has a search input or search behavior.
      matchHints:
        - search already exists
        - existing search
        - already implemented
    - id: avoid-duplicate-ui
      description: Agent should not add a second duplicate search input.
      matchHints:
        - do not duplicate
        - reuse existing search
  optional:
    - id: verify-title-only
      description: Agent checks whether existing search matches titles only or more fields.

requiredQuestions: []

prohibitedQuestions:
  - topic: tech stack
    reason: Stack is already fixed by the scaffold.
  - topic: exact styling
    reason: Not decision-critical for this request.

recommendedDefault:
  required: false
  expected: Reuse existing search and add missing tests if coverage is absent.

expectedAffectedAreas:
  required:
    - e2e tests
  optional:
    - search component
    - filter logic

prohibitedBehavior:
  - id: duplicate-search-input
    description: Adds a second search field instead of reusing existing feature.
  - id: unrelated-redesign
    description: Redesigns the task list without request.

oracle:
  file: oracle.yaml

postClarification:
  required: false
  tests:
    - tests-after-oracle.spec.ts

scoring:
  weights:
    decisionAccuracy: 0.3
    findingRecall: 0.2
    questionPrecision: 0.15
    existingBehaviorAwareness: 0.2
    hiddenImpactDetection: 0.05
    recommendedDefaultQuality: 0.1
  penalties:
    unnecessaryQuestion: 0.05
    duplicateFeatureImplementation: 0.5
    silentWrongImplementation: 1.0
```

## 5. Поля expected.yaml

### 5.1 id/name/kind/category

```yaml
id: labels-underspecified
name: Labels are underspecified
kind: ambiguity
category:
  - underspecified-feature
  - data-model-impact
  - cross-cutting-ui-change
```

`category` используется для групповых отчётов:

```text
Which prompts handle feature-already-exists best?
Which prompts handle user misconceptions best?
Which prompts over-clarify simple requests?
```

### 5.2 startVersion

Версия приложения, на которой запускается сценарий.

```yaml
startVersion: v4
```

Это важно: один и тот же request может быть ambiguous на `v0`, но clear на `v5`, или наоборот.

### 5.3 expectedDecision

```yaml
expectedDecision:
  primary: clarify
  acceptable:
    - proceed_with_assumptions
  unacceptable:
    - already_exists
    - out_of_scope
```

`primary` — лучший expected response.

`acceptable` — допустимое поведение, если оно не ведёт к неправильной реализации.

Например, для `Add due dates` можно разрешить:

```text
clarify
```

или:

```text
proceed_with_assumptions
```

если prompt arm явно разрешает safe defaults и агент задокументировал их.

### 5.4 blockingClarification

```yaml
blockingClarification: true
```

Если `true`, реализация без уточнения считается ошибкой.

Если `false`, агент может реализовать с safe assumptions.

### 5.5 expectedAgentFindings

Факты, которые агент должен заметить до реализации.

```yaml
expectedAgentFindings:
  required:
    - id: active-filter-semantics
      description: Active means incomplete tasks, so completed tasks disappearing is expected.
      matchHints:
        - Active filter
        - incomplete tasks
        - expected behavior
```

`matchHints` используются для простого автоматического matching, но окончательную оценку может дать LLM/jury.

### 5.6 requiredQuestions

```yaml
requiredQuestions:
  - id: label-cardinality
    topic: single vs multiple labels
    blocking: true
    acceptablePhrases:
      - one or multiple labels
      - multiple labels per card
      - only one label
  - id: label-source
    topic: predefined vs user-created labels
    blocking: true
```

Важный принцип: requiredQuestions должны быть только decision-critical.

Не добавлять туда:

```text
- цвет кнопки;
- название компонента;
- нужна ли анимация;
- точные CSS classes.
```

если это не влияет на целевое поведение.

### 5.7 prohibitedQuestions

Штраф за лишнюю бюрократию.

```yaml
prohibitedQuestions:
  - topic: technology stack
    reason: The scaffold already fixes React + TypeScript.
  - topic: whether to write tests
    reason: Benchmark harness owns tests.
```

### 5.8 recommendedDefault

```yaml
recommendedDefault:
  required: true
  expected: Use multiple predefined labels and one-label filtering.
```

Хороший агент не просто спрашивает, а помогает выбрать default.

### 5.9 expectedAffectedAreas

```yaml
expectedAffectedAreas:
  required:
    - data model
    - create/edit form
    - card display
    - persistence
    - tests
  optional:
    - filter sidebar
    - empty states
```

Это проверяет ability to detect blast radius.

### 5.10 prohibitedBehavior

```yaml
prohibitedBehavior:
  - id: visual-only-labels
    description: Adds label badges visually but does not persist labels in card data.
  - id: hardcoded-per-column-labels
    description: Duplicates label handling separately for each column.
```

Это используется после реализации.

## 6. oracle.yaml

Пример:

```yaml
id: labels-underspecified-oracle
mode: precise-product-owner

answers:
  - whenQuestionMatches:
      - single
      - multiple
      - one label
    answer: Cards can have multiple labels.

  - whenQuestionMatches:
      - predefined
      - custom
      - create labels
    answer: Use a fixed predefined label list for now: Bug, Feature, Design, Docs.

  - whenQuestionMatches:
      - filter
      - filtering
    answer: Yes, users should be able to filter by one label at a time.

fallbackAnswer: >
  Implement the intended benchmark behavior: multiple predefined labels, label badges on cards,
  one-label filtering, and localStorage persistence. Do not add custom label management yet.

finalIntendedBehavior:
  - Cards can have multiple labels.
  - Labels come from fixed predefined options: Bug, Feature, Design, Docs.
  - Users can filter cards by one label at a time.
  - Labels persist after refresh.
  - Existing cards start with no labels.
```

## 7. jury-context.md

Контекст для внешнего жюри.

```md
# Jury context

The app currently has TodoMVC behavior plus due dates and search.
The user asks: "Make every task belong to a project."

Known intended behavior:
- Existing tasks should be migrated into a default Inbox project.
- New tasks require project assignment, defaulting to Inbox.
- Project filtering appears in the sidebar.

Please evaluate whether the agent detected that this request requires migration and changes across task creation, filtering, counters and persistence.
```

Этот файл не передаётся агенту под тестом. Он используется только в external review packet.

## 8. Preflight output artifact

Для каждого scenario runner сохраняет:

```text
runs/<run-id>/versions/v4/ambiguity/labels-underspecified/
  prompt.md
  agent-preflight-raw.txt
  agent-decision.json
  oracle-answer.md
  agent-implementation-raw.txt
  diff.patch
  scores.json
  jury-packet/
```

## 9. Пример полного сценария: mistaken bug report

### request.md

```md
Completed tasks are disappearing from the Active view. Fix this bug.
```

### expected.yaml

```yaml
id: mistaken-active-filter-bug
category:
  - user-misconception
  - conflict-with-current-behavior
startVersion: v0

expectedDecision:
  primary: conflict
  acceptable:
    - clarify
  unacceptable:
    - proceed

blockingClarification: true

expectedAgentFindings:
  required:
    - id: active-means-incomplete
      description: Active view intentionally hides completed tasks.
      matchHints:
        - Active shows incomplete
        - Active filter
        - expected behavior

requiredQuestions:
  - id: change-filter-semantics
    topic: whether Active should include completed tasks despite current semantics
    blocking: true

recommendedDefault:
  required: true
  expected: Keep Active semantics unchanged unless user confirms a product change.

prohibitedBehavior:
  - id: change-active-semantics-without-confirmation
    description: Changes Active to show completed tasks without asking.
```

## 10. Minimal validation rules

Runner должен валидировать:

```text
- request.md exists;
- expected.yaml exists;
- expectedDecision.primary is valid;
- category is non-empty;
- if blockingClarification = true, requiredQuestions or expectedAgentFindings must be non-empty;
- prohibitedBehavior ids are unique;
- oracle file exists when fullNegotiation = true.
```
