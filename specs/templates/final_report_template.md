# Benchmark Report Template

# <Matrix ID> Benchmark Report

Date:
Run config:
Tasks:
Models:
Prompt arms:
Runs per cell:
Versions:

## Executive summary

```text
Top finding 1:
Top finding 2:
Top finding 3:
```

## Matrix size

```text
Total trajectories:
Total agent steps:
Completed trajectories:
Dead trajectories:
Total tokens observed:
```

## Leaderboard

| Rank | Model | Prompt combo | Task | Lifecycle quality | Tokens / successful version | Survival | Notes |
|---:|---|---|---|---:|---:|---:|---|

## Prompt arm comparison

| Prompt arm | Initial quality | Lifecycle quality | Survival | Regression rate | Token cost | Maintainability |
|---|---:|---:|---:|---:|---:|---:|

## Model comparison

| Model | Initial quality | Lifecycle quality | Failure version median | Token cost | Notes |
|---|---:|---:|---:|---:|---|

## Lifecycle curves

```text
Include links to CSV or charts:
- score by version
- tokens by version
- largest file LOC by version
- duplication by version
- regression failures by version
```

## Failure analysis

```text
Most common failures:
Most expensive changes:
Most regression-prone changes:
Where code became hard to maintain:
```

## External jury validation

```text
Jury sample size:
Judge roles:
Automated/human agreement:
Disagreement cases:
```

## Recommendations

```text
Best prompt for v0:
Best prompt for lifecycle:
Best edit prompt:
Prompt components to keep:
Prompt components to avoid:
```

## Limitations

```text
- sample size;
- free model availability;
- task scope;
- metric limitations;
- jury limitations.
```
