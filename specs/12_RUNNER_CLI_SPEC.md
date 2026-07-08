# Runner CLI Spec

## 1. CLI name

```bash
pnpm bench <command>
```

Package entry:

```json
{
  "scripts": {
    "bench": "tsx packages/runner/src/cli.ts"
  }
}
```

## 2. Commands

### 2.1 init

```bash
pnpm bench init
```

Creates:

```text
configs/mvp.yaml
tasks/_example
runs/.gitkeep
```

### 2.2 validate-task

```bash
pnpm bench validate-task tasks/todomvc
```

Checks:

```text
- task.yaml schema;
- paths;
- tests;
- scoring weights;
- source notes;
- no secret-looking strings;
- evolution steps.
```

### 2.3 preflight

```bash
pnpm bench preflight --config configs/mvp.yaml
```

Checks:

```text
- node/pnpm/git/opencode available;
- models available;
- Playwright available;
- scaffold builds;
- task validation passes.
```

### 2.4 run-one

```bash
pnpm bench run-one \
  --task todomvc \
  --model opencode/deepseek-v4-flash-free \
  --system S2-maintainable-simple \
  --user U5-maintainable \
  --edit E2-smallest-maintainable-change \
  --versions 6
```

Useful for debugging.

### 2.5 run-matrix

```bash
pnpm bench run-matrix --config configs/mvp.yaml
```

Main command.

Options:

```text
--dry-run
--resume <matrix-id>
--concurrency <n>
--max-versions <n>
--only-task <task-id>
--only-model <model-id>
--only-user-prompt <arm-id>
--no-repair
```

### 2.6 eval

```bash
pnpm bench eval --workspace runs/<id>/workspaces/<trajectory> --task todomvc --version v3
```

Runs evaluation without generation.

### 2.7 metrics

```bash
pnpm bench metrics --workspace runs/<id>/workspaces/<trajectory> --version v3
```

Computes code-health and diff metrics.

### 2.8 report

```bash
pnpm bench report --run runs/<matrix-id>
```

Generates:

```text
report.md
leaderboard.csv
leaderboard.md
trajectory summaries
```

### 2.9 jury export

```bash
pnpm bench jury export \
  --run runs/<matrix-id> \
  --sample balanced \
  --mode blind \
  --out runs/<matrix-id>/jury-packet
```

### 2.10 jury import

```bash
pnpm bench jury import \
  --run runs/<matrix-id> \
  --input jury-results.csv
```

### 2.11 jury report

```bash
pnpm bench jury report --run runs/<matrix-id>
```

## 3. Config file

```yaml
id: ape_mvp_001
seed: 42
outputDir: runs

opencode:
  autoApprove: true
  format: json
  attachUrl: null
  timeoutMs: 900000

scaffold:
  id: vite-react-ts
  path: scaffolds/vite-react-ts

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

prompts:
  system:
    - S2-maintainable-simple
  user:
    - U1-structured
    - U3-semantic-ui
    - U5-maintainable
  edit:
    - E2-smallest-maintainable-change

runsPerCell: 2
maxVersions: 5
maxRepairAttempts: 1
concurrency: 2
randomizeOrder: true
```

## 4. Implementation modules

```text
packages/runner/src/cli.ts
packages/runner/src/config.ts
packages/runner/src/matrix.ts
packages/runner/src/workspace.ts
packages/runner/src/trajectory.ts
packages/opencode-adapter/src/runOpencode.ts
packages/prompt-compiler/src/compilePrompt.ts
packages/evaluator/src/evaluate.ts
packages/metrics/src/collectMetrics.ts
packages/jury/src/exportJuryPacket.ts
packages/reporter/src/report.ts
```

## 5. Workspace command policy

Generated apps must expose:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test:e2e": "playwright test"
  }
}
```

Runner should not assume exact implementation, but scaffold should provide these scripts.

## 6. Resume behavior

`--resume` should:

```text
- read events/results;
- skip passed versions;
- retry failed infrastructure steps if configured;
- not overwrite existing artifacts unless --force;
- append events.
```

## 7. Exit codes

```text
0 = command completed, even if some trajectories failed but report generated
1 = invalid config/task
2 = preflight failed
3 = infrastructure failure
4 = internal runner error
```

Do not exit non-zero just because a model produced a bad app. That is a benchmark result, not runner failure.

## 8. Logging

Console should show compact progress:

```text
[1/36] todomvc deepseek U1 r1 v0 generating...
[1/36] todomvc deepseek U1 r1 v0 build passed e2e 18/20 score 0.82
```

Detailed logs go to files.

## 9. Artifact retention

Config:

```yaml
artifacts:
  keepWorkspaces: true
  keepNodeModules: false
  keepPlaywrightReports: true
  keepRawOpencodeEvents: true
  compressAfterRun: false
```

For long runs, remove:

```text
node_modules
dist
.cache
playwright browser downloads
```

But never remove:

```text
prompts
opencode events
git diffs
score files
screenshots
source snapshots if needed for jury
```
