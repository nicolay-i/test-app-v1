# App Prompt Evolution Benchmark

Implementation workspace for the benchmark described in `specs/`.

## Commands

```bash
pnpm install
pnpm bench init
pnpm bench preflight --config configs/mvp.yaml
pnpm bench validate-task tasks/todomvc

pnpm bench run-one \
  --task todomvc \
  --model deepseek-v4-flash-free \
  --system S2-maintainable-simple \
  --user U5-maintainable \
  --edit E2-smallest-maintainable-change \
  --versions 4 \
  --run-type mock

pnpm bench run-matrix --config configs/mvp.yaml --dry-run
pnpm bench run-matrix --config configs/mvp.yaml --run-type mock --versions 2 --max-trajectories 2
pnpm bench aggregate --config configs/mvp.yaml --execution <execution-id>

pnpm bench negotiate-one \
  --task todomvc \
  --scenario 03-underspecified-tags \
  --model deepseek-v4-flash-free \
  --system S2-maintainable-simple \
  --run-type mock \
  --full

pnpm bench export-jury-packet --trajectory <trajectory-id> --blind --out jury-packets/<packet-id>
pnpm bench import-jury-review --trajectory <trajectory-id> --review jury-packets/<packet-id>/review-form.md --reviewer reviewer-1
```

## Current Scope

The runner supports a TodoMVC lifecycle trajectory: v0 generation, v1..v4 evolution prompts, cumulative regression tests, one repair attempt, per-version artifacts, trajectory summaries, aggregation, negotiation scenarios, and blind jury packet export/import.

`--run-type mock` uses a deterministic local generator and is excluded from the leaderboard. `--run-type real` invokes OpenCode and is eligible for leaderboard aggregation unless the trajectory is classified as an infra failure.

Every `run-one` and `run-matrix` is fresh by default. Resume requires `--resume <execution-id>` and rejects changed run type, source/config/task/prompt/scaffold hashes, versions, mock profile, or trajectory definition. `--fresh` and `--force-new-execution` are explicit fresh-mode aliases and cannot be combined with resume.

`run-matrix` is intended for small controlled batches first. Use `--max-trajectories` and `--versions` before increasing matrix size.

`pnpm proof:mock` is the credential-free CI gate. It covers parser fixtures, mock lifecycle and terminal-failure paths, repair, artifact verification, leaderboard exclusion, and strict resume rejection.
