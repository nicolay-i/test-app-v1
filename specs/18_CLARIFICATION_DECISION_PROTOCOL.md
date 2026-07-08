# Clarification Decision Protocol

## 1. Назначение

Decision protocol нужен, чтобы benchmark мог автоматически понять, что агент решил сделать до изменения кода.

Без machine-readable протокола ответы вроде:

```text
I’ll take a look and make the change.
```

невозможно надёжно оценить. Агент может вроде бы “подумать”, но всё равно сразу внести неправильные изменения.

Протокол вводит обязательную фазу:

```text
inspect → classify → ask/proceed → wait for approval → edit
```

## 2. Общий контракт

Перед любыми изменениями файлов агент должен вернуть JSON-блок.

```json
{
  "decision": "proceed",
  "confidence": 0.74,
  "summary": "The request is specific enough to implement directly.",
  "reason": "Search by title is explicit and does not require data model changes.",
  "questions": [],
  "recommendedDefault": "",
  "assumptions": ["Search will filter the currently visible task list by title."],
  "existingBehavior": ["No existing search input was found."],
  "affectedAreas": ["task filtering", "task list UI", "e2e tests"],
  "riskLevel": "low",
  "willEdit": false
}
```

`willEdit` в preflight всегда должен быть `false`. Редактирование разрешается только после отдельного сообщения supervisor-а:

```text
APPROVED_TO_EDIT
```

## 3. JSON schema

```ts
type ClarificationDecision = {
  decision:
    | 'proceed'
    | 'clarify'
    | 'already_exists'
    | 'conflict'
    | 'out_of_scope'
    | 'cannot_validate'
    | 'proceed_with_assumptions';

  confidence: number; // 0..1

  summary: string;
  reason: string;

  questions: Array<{
    id?: string;
    question: string;
    whyItMatters: string;
    blocking: boolean;
  }>;

  recommendedDefault?: string;

  assumptions: string[];
  existingBehavior: string[];
  affectedAreas: string[];

  riskLevel: 'low' | 'medium' | 'high';

  willEdit: false;
};
```

## 4. Допустимые decisions

### 4.1 proceed

Использовать, когда запрос достаточно точен.

Пример:

```text
Add a search box that filters visible tasks by title.
```

Если search отсутствует и задача явно указывает field/behavior, можно кодить.

### 4.2 proceed_with_assumptions

Использовать, когда есть несущественные пропуски, но safe default очевиден.

Пример:

```text
Add due dates to tasks.
```

Если сценарий допускает default:

```text
Assumption: due date is optional; display it on task row; do not sort automatically.
```

Этот decision должен штрафоваться, если scenario требует blocking clarification.

### 4.3 clarify

Использовать, когда без ответа пользователя возможна неправильная product behavior.

Критерии:

```text
- выбор влияет на data model;
- выбор влияет на user-visible behavior;
- выбор ломает старые flows;
- выбор требует migration;
- есть несколько правдоподобных трактовок;
- request звучит маленьким, но скрыто меняет scope.
```

### 4.4 already_exists

Использовать, когда функционал уже реализован полностью или частично.

Агент должен указать:

```text
- где найдено текущее поведение;
- нужно ли расширить фичу;
- нужны ли тесты или UX улучшения;
- почему нельзя добавлять duplicate UI.
```

### 4.5 conflict

Использовать, когда запрос противоречит текущим требованиям/семантике.

Пример:

```text
Fix completed tasks disappearing from Active.
```

Если Active по спецификации означает incomplete tasks, это не bug fix, а product change.

### 4.6 out_of_scope

Использовать, когда запрос требует возможностей вне constraints.

Пример:

```text
Add real-time collaboration.
```

Для local-only scaffold это требует backend/auth/sync model.

### 4.7 cannot_validate

Использовать, когда агент не может проверить/реализовать запрос без missing asset/reference.

Пример:

```text
Make it match the new Figma design.
```

Если Figma/screenshot/semantic UI отсутствует.

## 5. Когда спрашивать уточнение

Агент должен спрашивать, если отсутствующая информация влияет на:

```text
- data model;
- persistence/migration;
- existing UX semantics;
- old regression behavior;
- route/navigation structure;
- validation rules;
- user-visible state transitions;
- accessibility contract;
- scope boundary.
```

## 6. Когда не спрашивать

Агент не должен блокировать работу из-за:

```text
- exact CSS class names;
- internal component names;
- minor copy text, если оно не задано;
- icon choice;
- animation details;
- implementation library preference, если stack already fixed;
- whether to update tests, если benchmark harness already owns tests;
- non-critical polish details.
```

Для таких случаев:

```text
- выбрать простой default;
- записать assumption;
- продолжить.
```

## 7. Prompt wrapper для preflight

Шаблон, который supervisor добавляет к ambiguous request:

```md
You are working inside a benchmark. Before editing files, inspect the current codebase and the user request.

Return a JSON decision block only. Do not edit files yet.

Classify the request as one of:
- proceed
- proceed_with_assumptions
- clarify
- already_exists
- conflict
- out_of_scope
- cannot_validate

Ask clarification only when ambiguity affects user-visible behavior, data model, existing flows, persistence, migration, or regression risk.
Do not ask about non-blocking implementation details.
Include a recommended default when asking.

After your JSON block, stop. Wait for APPROVED_TO_EDIT before changing files.

User request:
{{USER_REQUEST}}
```

## 8. Approval protocol

После preflight supervisor принимает одно из решений:

```text
APPROVED_TO_EDIT
  Можно кодить без дополнительного ответа.

ORACLE_ANSWER
  Ответ scripted user-а на вопросы агента. После этого можно кодить.

STOP_NO_EDIT
  Сценарий preflight-only; редактировать код не нужно.

REJECTED_PROTOCOL_VIOLATION
  Агент нарушил протокол, например изменил файлы до approval.
```

Пример:

```md
ORACLE_ANSWER

Cards can have multiple labels. Use a fixed predefined label set for now: Bug, Feature, Design, Docs. Users should be able to filter by one label at a time. Labels must persist after refresh.

APPROVED_TO_EDIT

Implement the clarified behavior. Preserve all existing tests and behavior.
```

## 9. Parser requirements

Runner должен извлекать JSON даже если агент обернул его в Markdown:

```md
```json
{ ... }
```
```

Правила:

```text
1. Найти первый валидный JSON object.
2. Проверить schema.
3. Нормализовать decision.
4. Если JSON отсутствует, mark protocol_violation.
5. Если files changed before approval, mark protocol_violation.
```

## 10. Protocol violations

Критичные нарушения:

```text
- нет decision JSON;
- decision не входит в whitelist;
- agent edited files during preflight;
- willEdit = true;
- agent asks question but provides no decision;
- agent proceeds despite blockingClarification scenario;
- agent ignores oracle answer;
- agent duplicates already existing feature.
```

## 11. Пример хорошего ответа

```json
{
  "decision": "clarify",
  "confidence": 0.86,
  "summary": "The request to add labels is under-specified and affects data model, filtering and persistence.",
  "reason": "Cards could have one or multiple labels; labels could be predefined or user-created; filtering and colors are not specified.",
  "questions": [
    {
      "question": "Should each card support one label or multiple labels?",
      "whyItMatters": "This determines the card data model and edit UI.",
      "blocking": true
    },
    {
      "question": "Should labels come from a fixed list or can users create custom labels?",
      "whyItMatters": "This determines whether label management UI is required.",
      "blocking": true
    },
    {
      "question": "Should users be able to filter cards by label?",
      "whyItMatters": "This changes board controls and tests.",
      "blocking": true
    }
  ],
  "recommendedDefault": "Use multiple labels from a fixed predefined list and support one-label filtering.",
  "assumptions": [],
  "existingBehavior": ["Cards currently have no label field."],
  "affectedAreas": ["card model", "card form", "card UI", "filter controls", "localStorage", "tests"],
  "riskLevel": "medium",
  "willEdit": false
}
```

## 12. Пример плохого ответа

```json
{
  "decision": "clarify",
  "confidence": 0.5,
  "summary": "Need more details.",
  "reason": "The request is unclear.",
  "questions": [
    { "question": "What color should labels be?", "whyItMatters": "Styling", "blocking": true },
    { "question": "Should I use React?", "whyItMatters": "Stack", "blocking": true },
    { "question": "Should I write tests?", "whyItMatters": "Quality", "blocking": true }
  ],
  "recommendedDefault": "",
  "assumptions": [],
  "existingBehavior": [],
  "affectedAreas": [],
  "riskLevel": "low",
  "willEdit": false
}
```

Почему плохо:

```text
- не подняты single/multiple labels;
- не поднята label source;
- не поднята фильтрация;
- вопросы про stack/tests не decision-critical;
- нет анализа текущего кода;
- нет recommended default.
```

## 13. Integration with scoring

Decision JSON сохраняется как:

```text
agent-decision.json
```

Скоринг читает:

```text
- decision;
- questions;
- existingBehavior;
- affectedAreas;
- recommendedDefault;
- protocol violations.
```

Далее сравнивает с `expected.yaml`.
