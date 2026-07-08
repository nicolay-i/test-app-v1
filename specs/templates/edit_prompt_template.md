# Edit Prompt Template

```yaml
id: Ex-name
kind: edit_prompt
experimentType: edit_instruction_effect
baseArm: <optional baseline>
variablesChanged:
  - preserve_behavior | smallest_change | tests | refactor_awareness
```

## Prompt body

```markdown
Implement the following change in the existing application.

## Change request

{{EVOLUTION_STEP}}

## Preserve

- Preserve all existing behavior unless the change explicitly replaces it.
- Keep old regression tests passing.
- Do not rewrite unrelated parts of the app.

## Engineering guidance

- Make the smallest maintainable change.
- Reuse existing data structures and components where appropriate.
- Avoid duplicating logic.
- Remove obsolete code if the change replaces or deletes a feature.

## Done when

{{NEW_ACCEPTANCE_CRITERIA}}
```
