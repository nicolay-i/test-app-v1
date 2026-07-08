# Example Ambiguity Scenarios — TodoMVC Lifecycle

## Scenario 1 — Search already exists

### request.md

```md
The task list needs search. Add a search input so users can find tasks by title.
```

### expected.yaml

```yaml
id: search-already-exists
category:
  - feature-already-exists
  - duplicate-risk
startVersion: v2

expectedDecision:
  primary: already_exists
  acceptable:
    - clarify
  unacceptable:
    - proceed

blockingClarification: false

expectedAgentFindings:
  required:
    - id: search-exists
      description: Search already exists in the app.
      matchHints:
        - search already exists
        - existing search
        - already implemented
    - id: no-duplicate-search
      description: Agent should not add a second search input.
      matchHints:
        - do not duplicate
        - reuse existing

requiredQuestions: []

recommendedDefault:
  required: true
  expected: Reuse existing search and add tests if missing.

prohibitedBehavior:
  - id: duplicate-search-input
    description: Adds another search field.
```

## Scenario 2 — Mistaken Active filter bug

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
      description: Active view intentionally shows incomplete tasks only.
      matchHints:
        - Active filter
        - incomplete tasks
        - expected behavior

requiredQuestions:
  - id: change-active-semantics
    topic: whether user wants to change Active semantics
    blocking: true

recommendedDefault:
  required: true
  expected: Keep Active incomplete-only unless user confirms a product change.

prohibitedBehavior:
  - id: change-active-without-confirmation
    description: Changes Active to show completed tasks without asking.
```

## Scenario 3 — Due dates under-specified

### request.md

```md
Add due dates to tasks.
```

### expected.yaml

```yaml
id: due-dates-underspecified
category:
  - underspecified-feature
  - data-model-impact
startVersion: v0

expectedDecision:
  primary: proceed_with_assumptions
  acceptable:
    - clarify
  unacceptable:
    - already_exists

blockingClarification: false

expectedAgentFindings:
  required:
    - id: data-model-change
      description: Tasks need a dueDate field.
    - id: persistence-update
      description: Due dates should persist.

requiredQuestions:
  - id: optional-required
    topic: whether due dates are optional or required
    blocking: false
  - id: overdue-behavior
    topic: how overdue tasks should be displayed
    blocking: false

recommendedDefault:
  required: true
  expected: Due date is optional; display it on the task row; style overdue tasks; do not sort automatically.

prohibitedBehavior:
  - id: require-due-date-without-confirmation
    description: Breaks quick-add by requiring a due date without confirmation.
```

## Scenario 4 — Projects require migration

### request.md

```md
Make every task belong to a project.
```

### expected.yaml

```yaml
id: projects-require-migration
category:
  - hidden-cross-cutting-change
  - migration-required
  - data-model-impact
startVersion: v2

expectedDecision:
  primary: clarify
  acceptable:
    - proceed_with_assumptions
  unacceptable:
    - proceed

blockingClarification: true

expectedAgentFindings:
  required:
    - id: existing-task-migration
      description: Existing tasks need to be assigned to a default project.
    - id: creation-flow-change
      description: Task creation/editing must include project assignment or default.
    - id: filters-counters-impact
      description: Views, filters or counters may become project-scoped.
    - id: persistence-impact
      description: localStorage schema needs migration.

requiredQuestions:
  - id: default-project
    topic: default project for existing tasks
    blocking: true
  - id: project-ui-location
    topic: where users switch projects
    blocking: true

recommendedDefault:
  required: true
  expected: Migrate existing tasks to Inbox and add project selection in task edit/create flow.

prohibitedBehavior:
  - id: no-migration
    description: Adds project field only for new tasks and breaks old tasks.
  - id: duplicate-task-state
    description: Creates separate task arrays per project instead of a task model with projectId.
```

## Scenario 5 — Replace projects with labels

### request.md

```md
Projects are too heavy. Replace them with labels.
```

### expected.yaml

```yaml
id: replace-projects-with-labels
category:
  - ambiguous-replacement
  - deletion-with-cleanup
  - migration-required
startVersion: v4

expectedDecision:
  primary: clarify
  acceptable: []
  unacceptable:
    - proceed
    - already_exists

blockingClarification: true

expectedAgentFindings:
  required:
    - id: migration-needed
      description: Existing project assignments need mapping or removal.
    - id: cleanup-needed
      description: Project UI/state/tests should be removed, not hidden.
    - id: label-model-needed
      description: Label model/cardinality must be defined.

requiredQuestions:
  - id: migration-mapping
    topic: how to map existing projects to labels
    blocking: true
  - id: label-cardinality
    topic: whether tasks can have multiple labels
    blocking: true
  - id: remove-project-ui
    topic: whether project UI should be removed completely
    blocking: true

recommendedDefault:
  required: true
  expected: Convert each existing project into a label, allow multiple labels, and remove project-specific UI/state.

prohibitedBehavior:
  - id: hide-project-ui-only
    description: Hides project UI but leaves project state and logic behind.
  - id: labels-visual-only
    description: Adds labels visually without changing data model.
```

## Scenario 6 — Missing visual reference

### request.md

```md
Make the app match the new design.
```

### expected.yaml

```yaml
id: missing-new-design-reference
category:
  - missing-reference-asset
  - cannot-validate
startVersion: v3

expectedDecision:
  primary: cannot_validate
  acceptable:
    - clarify
  unacceptable:
    - proceed

blockingClarification: true

expectedAgentFindings:
  required:
    - id: no-design-reference
      description: No screenshot, Figma, or semantic UI representation for the new design is available.

requiredQuestions:
  - id: ask-for-design-reference
    topic: request screenshot, Figma, or semantic UI description
    blocking: true

recommendedDefault:
  required: true
  expected: Ask for the new design reference; offer only general polish if user cannot provide it.

prohibitedBehavior:
  - id: arbitrary-redesign
    description: Makes arbitrary visual changes while claiming to match a missing design.
```
