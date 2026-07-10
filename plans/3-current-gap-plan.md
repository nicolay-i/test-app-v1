# Plan 3 Current Gap Checklist

This file tracks the implementation state for `plans/3.md` against the current worktree.

## P0: Trustworthy Single Trajectory

- [x] `run-one` creates v0 artifacts with `prompt.md`, logs, metadata, diff, checks, metrics, score, failure summary, and report.
- [x] OpenCode prompts are saved to artifacts and passed by `--file`.
- [x] `run_type` is explicit for mock and real runs.
- [x] Mock results are marked `eligible_for_leaderboard: false`.
- [x] Invalid `--mock-opencode --run-type real` is rejected.
- [x] Failure summaries classify model, infra, OpenCode, harness, and unknown failures.
- [x] Visual smoke is separated from visual similarity.
- [x] Evaluator writes install/build/runtime/playwright logs and `check-results.json`.

## P1: Lifecycle Benchmark

- [x] TodoMVC has four evolution steps: due dates, search, tags, remove tags.
- [x] Each evolution step has a prompt and Playwright tests.
- [x] Evolution tests are cumulative.
- [x] Removed features can disable obsolete tests through `disabledTests`.
- [x] Edit prompts include the requested change, prior context, regressions, known failures, and constraints.
- [x] `run-one --versions 4 --run-type mock` can create v0..v4.
- [x] Each version has its own artifacts and git diff.
- [x] One repair attempt is recorded separately under `repair-1`.
- [x] Trajectory summaries include survived versions, first failure, repair counts, score trend, LOC growth, and diff totals.

## P1: Results and Review

- [x] Aggregation writes `trajectory-results.jsonl`, `version-results.jsonl`, `scores.csv`, and `leaderboard.md`.
- [x] Leaderboard excludes mock and infra-failed real trajectories from ranking.
- [x] Negotiation scenarios support preflight-only and full implementation modes.
- [x] Blind jury packet export/import exists.
- [x] Blind packet metadata hides model, prompt arm, provider, and run identifiers.

## P2: Matrix Execution

- [x] `run-matrix --dry-run` still prints the planned matrix.
- [x] `run-matrix` can execute bounded batches through the same `run-one` CLI path.
- [x] `run-matrix` supports `--run-type`, `--versions`, `--max-trajectories`, `--skip-install`, and resumable skip of existing summaries.
- [x] Failed trajectories do not stop the whole matrix.
- [x] Aggregation runs after matrix execution.

## Proof Gates

The benchmark should not be considered complete unless these commands pass in the current worktree:

```bash
./node_modules/.bin/tsc -b --pretty false
node --import tsx packages/runner/src/cli.ts validate-task tasks/todomvc
node --import tsx packages/runner/src/cli.ts run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U5-maintainable --edit E2-smallest-maintainable-change --versions 4 --run-type mock
node --import tsx packages/runner/src/cli.ts run-matrix --config configs/mvp.yaml --run-type mock --versions 0 --max-trajectories 1 --resume false
node --import tsx packages/runner/src/cli.ts aggregate --config configs/mvp.yaml
node --import tsx packages/runner/src/cli.ts negotiate-one --task todomvc --scenario 03-underspecified-tags --model deepseek-v4-flash-free --system S2-maintainable-simple --run-type mock --full --run 3
```

Real sanity remains intentionally small: one task, one model, two user prompt arms, one system prompt, one edit prompt, and v0..v3. A failed real trajectory is acceptable when artifacts, score, and failure classification are complete.

