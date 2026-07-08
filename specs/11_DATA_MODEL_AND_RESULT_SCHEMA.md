# Data Model and Result Schema

## 1. Storage principle

MVP хранит данные в файловой системе:

```text
results.jsonl
scores.csv
events.jsonl
metrics.json per version
score.json per version
```

Позже можно импортировать в SQLite/DuckDB/Postgres.

## 2. Entity overview

```text
Task
Model
PromptArm
AssetRepresentation
MatrixRun
Trajectory
VersionRun
CheckResult
MetricSnapshot
JurySession
JuryReview
```

## 3. Matrix config schema

```yaml
id: ape_mvp_001
seed: 42
createdAt: 2026-07-08

models:
  - id: deepseek-v4-flash-free
    providerModel: opencode/deepseek-v4-flash-free
  - id: mimo-v2.5-free
    providerModel: opencode/mimo-v2.5-free
  - id: nemotron-3-ultra-free
    providerModel: opencode/nemotron-3-ultra-free

tasks:
  - todomvc
  - dashboard-lite

systemPromptArms:
  - S2-maintainable-simple

userPromptArms:
  - U1-structured
  - U3-semantic-ui
  - U5-maintainable

editPromptArms:
  - E2-smallest-maintainable-change

runsPerCell: 2
maxVersions: 5
maxRepairAttempts: 1
concurrency: 2
```

## 4. Trajectory id

Stable id format:

```text
<task_id>__<model_id>__<system_id>__<user_id>__<edit_id>__r<run_number>
```

Example:

```text
todomvc__deepseek-v4-flash-free__S2__U5__E2__r1
```

For jury, never expose this id. Use anonymized `variant_id`.

## 5. VersionRun JSON

```json
{
  "matrix_id": "ape_mvp_001",
  "trajectory_id": "todomvc__deepseek__S2__U5__E2__r1",
  "task_id": "todomvc",
  "model_id": "deepseek-v4-flash-free",
  "provider_model": "opencode/deepseek-v4-flash-free",
  "system_prompt_arm_id": "S2-maintainable-simple",
  "user_prompt_arm_id": "U5-maintainable",
  "edit_prompt_arm_id": "E2-smallest-maintainable-change",
  "run_number": 1,
  "version_id": "v3",
  "evolution_step_id": "03-add-projects",
  "status": "passed",
  "started_at": "2026-07-08T12:00:00.000Z",
  "finished_at": "2026-07-08T12:07:12.000Z",
  "duration_ms": 432000,
  "workspace_path": "runs/ape_mvp_001/workspaces/...",
  "artifacts_path": "runs/ape_mvp_001/artifacts/.../v3"
}
```

## 6. CheckResult schema

```json
{
  "version_id": "v3",
  "checks": {
    "install": {
      "status": "passed",
      "duration_ms": 32000,
      "log_path": "install.log"
    },
    "build": {
      "status": "passed",
      "duration_ms": 11000,
      "log_path": "build.log"
    },
    "e2e": {
      "status": "failed",
      "passed": 18,
      "failed": 2,
      "total": 20,
      "report_path": "e2e-report/index.html",
      "failures": [
        {
          "test": "bulk delete preserves completed count",
          "message": "Expected 2 items left, got 3 items left"
        }
      ]
    },
    "visual": {
      "status": "passed",
      "screenshots": {
        "desktop": "screenshots/desktop.png",
        "mobile": "screenshots/mobile.png"
      }
    }
  }
}
```

## 7. MetricSnapshot schema

```json
{
  "version_id": "v3",
  "git": {
    "changed_files": 5,
    "added_lines": 120,
    "deleted_lines": 24,
    "rewrite_ratio": 0.1
  },
  "code_health": {
    "loc_total": 1430,
    "file_count": 18,
    "largest_file": {
      "path": "src/App.tsx",
      "loc": 420
    },
    "duplication_ratio": 0.04,
    "duplicated_lines": 57,
    "complexity_violations": 1,
    "dependency_cycles": 0,
    "unused_exports": 2,
    "runtime_dependency_count": 4,
    "dev_dependency_count": 9
  },
  "usage": {
    "input_tokens": 21000,
    "output_tokens": 9200,
    "cached_read_tokens": 0,
    "cached_write_tokens": 0,
    "total_tokens": 30200,
    "repair_tokens": 0,
    "usage_status": "observed"
  }
}
```

## 8. Score schema

```json
{
  "version_id": "v3",
  "scores": {
    "build_runtime_score": 1.0,
    "e2e_score": 0.9,
    "value_score": 0.85,
    "visual_score": 0.8,
    "prompt_adherence_score": 0.9,
    "version_quality": 0.88,
    "maintainability_score": 0.76,
    "overengineering_penalty": 0.03
  },
  "status": "passed",
  "notes": [
    "Search test passed but duplicated filtering logic increased."
  ]
}
```

## 9. Trajectory summary schema

```json
{
  "trajectory_id": "todomvc__deepseek__S2__U5__E2__r1",
  "task_id": "todomvc",
  "model_id": "deepseek-v4-flash-free",
  "prompt_combo": {
    "system": "S2-maintainable-simple",
    "user": "U5-maintainable",
    "edit": "E2-smallest-maintainable-change"
  },
  "versions_planned": 7,
  "versions_attempted": 7,
  "versions_passed": 6,
  "first_failure_version": "v6",
  "initial_quality": 0.84,
  "average_version_quality": 0.78,
  "survival_score": 0.86,
  "maintainability_score_final": 0.74,
  "lifecycle_quality": 0.79,
  "total_tokens": 182000,
  "cost_per_passing_version_tokens": 30333,
  "repair_attempts": 1,
  "status": "completed_with_failure"
}
```

## 10. JuryReview schema

```json
{
  "jury_session_id": "jury_ape_mvp_001",
  "variant_id": "variant_014",
  "trajectory_id_hidden": "encrypted-or-private-mapping",
  "judge_id": "anon_judge_002",
  "judge_role": ["frontend", "engineering"],
  "scores": {
    "functional_correctness": 6,
    "visual_quality": 5,
    "ux_completeness": 5,
    "maintainability": 4,
    "code_readability": 4,
    "change_safety": 3,
    "overall_quality": 5
  },
  "pairwise": [
    {
      "against_variant_id": "variant_015",
      "winner": "variant_014",
      "dimension": "maintainability"
    }
  ],
  "comments": {
    "positive": "Core flows are implemented clearly.",
    "concern": "Filtering logic is duplicated across components.",
    "expected_failure_point": "Custom views would likely be difficult."
  },
  "confidence": 4,
  "time_spent_minutes": 12,
  "created_at": "2026-07-08T12:00:00.000Z"
}
```

## 11. JSONL event schema

Every event:

```json
{
  "ts": "2026-07-08T12:00:00.000Z",
  "level": "info",
  "matrix_id": "ape_mvp_001",
  "trajectory_id": "...",
  "version_id": "v2",
  "phase": "opencode_run",
  "event": "started",
  "data": {}
}
```

## 12. CSV outputs

### scores.csv columns

```text
matrix_id,trajectory_id,task_id,model_id,system_prompt,user_prompt,edit_prompt,run_number,version_id,status,initial_quality,version_quality,maintainability_score,total_tokens,repair_attempts,passed_tests,total_tests,changed_files,added_lines,deleted_lines,duplication_ratio,largest_file_loc
```

### leaderboard.csv columns

```text
group_by,arm_id,task_id,model_id,mean_lifecycle_quality,median_lifecycle_quality,std_lifecycle_quality,mean_tokens,cost_per_passing_version,win_rate_vs_baseline,survival_rate,first_failure_median
```
