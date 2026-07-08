# Evolution Step Template

```yaml
id: 01-change-name
name: <Human name>
type: additive | cross_cutting | replacement | deletion | ui_restructure | data_model_change
expectedBlastRadius:
  size: small | medium | large | refactor
  maxChangedFiles: 5
  maxRewriteRatio: 0.2
hiddenRoadmap: true
```

## Change request

Describe exactly what to add/change/remove.

## New acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Existing behavior to preserve

- [ ] Existing behavior 1
- [ ] Existing behavior 2

## Explicit removals

Use this for deletion/replacement steps.

```text
Remove old UI/state/types/helpers related to <feature>.
Do not leave dead code.
```

## Forbidden shortcuts

```text
- Do not hard-code only the test data.
- Do not replace the whole app for a small change.
- Do not remove existing required features.
```

## Test notes

```text
Regression tests:
New tests:
Visual impact:
```
