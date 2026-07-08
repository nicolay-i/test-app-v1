# Example Jury Packet

## index.md

```markdown
# Jury Review Packet — Session jury_ape_mvp_001

You will review anonymized generated applications.
Do not infer the model or prompt.
Use the requirements and artifacts provided for each variant.

Variants:
- Variant 001 — TodoMVC v4
- Variant 002 — TodoMVC v4
- Variant 003 — Dashboard v3

Submit reviews using the attached form template.
```

## variant_001/summary.md

```markdown
# Variant 001

Task: TodoMVC Lifecycle
Version under review: v4
Review type: app + code

This variant has undergone:
- v0 TodoMVC base
- v1 due dates
- v2 search
- v3 projects
- v4 sidebar views replacing footer filters

Please review:
- Does the app satisfy the visible requirements?
- Are previous flows still working?
- Is the codebase safe to continue changing?
```

## variant_001/code-review/code-health-summary.md

```markdown
# Code Health Summary

Total LOC: 1480
Largest file: src/App.tsx, 520 LOC
Changed files in latest step: 9
Duplication ratio: 7.2%
Complexity violations: 2
Dependency cycles: 0
Unused exports: 4

Notes:
- Search and sidebar filtering appear to have separate filtering branches.
- Projects were added in v3 and views in v4 touched several unrelated files.
```

## private-mapping.json

Do not send this to judges.

```json
{
  "variant_001": {
    "trajectory_id": "todomvc__deepseek-v4-flash-free__S2__U5__E2__r1",
    "model_id": "deepseek-v4-flash-free",
    "prompt_arm": "U5-maintainable"
  }
}
```
