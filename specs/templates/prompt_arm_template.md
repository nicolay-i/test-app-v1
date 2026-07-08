# User Prompt Arm Template

```yaml
id: Ux-name
kind: user_prompt
experimentType: wording | information_packaging | maintainability | visual_reference
baseArm: <optional baseline arm id>
variablesChanged:
  - <one main changed variable>
intendedUse:
  - initial_generation
```

## Prompt body

```markdown
Build the application described below.

## Product goal

{{TASK_GOAL}}

## Requirements

{{TASK_REQUIREMENTS}}

## Acceptance criteria

{{ACCEPTANCE_CRITERIA}}

## Semantic UI reference

{{SEMANTIC_UI_OPTIONAL}}

## Constraints

- Use React and TypeScript.
- Keep the app runnable with `pnpm dev` and buildable with `pnpm build`.
- Do not use external backend services.
- Do not add unrelated features.

## Maintainability guidance optional

{{MAINTAINABILITY_ADDENDUM_OPTIONAL}}
```

## Notes

```text
Expected effect:
Risk:
Comparison target:
```
