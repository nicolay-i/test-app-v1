# Implementation Backlog

## Epic 1 — Repository and CLI foundation

### BENCH-001 Create pnpm monorepo

Acceptance:

```text
- packages directory exists;
- TypeScript builds;
- pnpm bench command works;
- lint/format scripts exist.
```

### BENCH-002 Config loader

Acceptance:

```text
- reads YAML config;
- validates required fields;
- resolves relative paths;
- prints dry-run matrix size.
```

### BENCH-003 Event logger

Acceptance:

```text
- writes JSONL events;
- includes timestamp/matrix/trajectory/version/phase/status;
- safe append on resume.
```

## Epic 2 — Task registry

### BENCH-010 Task schema

Acceptance:

```text
- task.yaml parsed;
- required paths validated;
- evolution steps loaded;
- scoring weights loaded.
```

### BENCH-011 TodoMVC task

Acceptance:

```text
- TodoMVC spec included/linked;
- acceptance criteria written;
- semantic UI tree created;
- base tests pass against a known-good local implementation or scaffold placeholder where applicable.
```

## Epic 3 — Prompt compiler

### BENCH-020 Compile v0 prompt

Acceptance:

```text
- system + user + task spec + assets combined;
- compiled prompt saved to artifact path;
- prompt includes constraints and deliverables.
```

### BENCH-021 Compile edit prompt

Acceptance:

```text
- includes change request;
- includes preserve behavior instruction;
- includes current version summary;
- does not reveal future roadmap unless configured.
```

### BENCH-022 Compile repair prompt

Acceptance:

```text
- includes failing logs excerpt;
- asks for smallest fix;
- marks repair tokens separately.
```

## Epic 4 — OpenCode adapter

### BENCH-030 Preflight OpenCode

Acceptance:

```text
- opencode command exists;
- opencode models --refresh runs;
- configured models available or clear error shown.
```

### BENCH-031 Run OpenCode

Acceptance:

```text
- opencode run invoked with --model/--dir/--format json/--auto;
- stdout/stderr saved;
- exit code captured;
- duration captured.
```

### BENCH-032 Parse usage/events

Acceptance:

```text
- raw events saved;
- session id extracted if available;
- token usage extracted if available;
- usage_status set to observed/unavailable.
```

## Epic 5 — Workspace and git tracking

### BENCH-040 Create workspace

Acceptance:

```text
- copies scaffold;
- git init;
- initial commit;
- trajectory metadata saved.
```

### BENCH-041 Capture diff

Acceptance:

```text
- git diff saved per version;
- changed files/lines counted;
- commit created after version step.
```

## Epic 6 — Evaluation

### BENCH-050 Build evaluator

Acceptance:

```text
- pnpm install/build run;
- logs saved;
- pass/fail recorded.
```

### BENCH-051 Runtime smoke evaluator

Acceptance:

```text
- dev server starts;
- page opens;
- console/page errors captured;
- screenshot captured.
```

### BENCH-052 Playwright e2e evaluator

Acceptance:

```text
- runs base and evolution tests;
- parses pass/fail count;
- report stored.
```

### BENCH-053 Visual evaluator

Acceptance:

```text
- captures desktop/mobile screenshot;
- optional toHaveScreenshot baseline;
- result stored.
```

## Epic 7 — Metrics

### BENCH-060 LOC/largest file metrics

Acceptance:

```text
- counts source LOC;
- finds largest file;
- saves metrics.json.
```

### BENCH-061 Diff metrics

Acceptance:

```text
- changed files;
- added/deleted lines;
- rewrite ratio.
```

### BENCH-062 jscpd integration

Acceptance:

```text
- runs jscpd;
- parses duplication ratio;
- tolerates tool failure without killing trajectory.
```

### BENCH-063 ESLint complexity integration

Acceptance:

```text
- complexity threshold configured;
- violations counted;
- files reported.
```

## Epic 8 — Lifecycle runner

### BENCH-070 v0 trajectory run

Acceptance:

```text
- generate v0;
- evaluate;
- score;
- artifacts saved.
```

### BENCH-071 evolution sequence

Acceptance:

```text
- applies v1..vN in same workspace;
- regression tests accumulate;
- death conditions respected.
```

### BENCH-072 repair attempt

Acceptance:

```text
- one repair attempt on build/critical test fail;
- repair prompt saved;
- repair tokens tracked.
```

## Epic 9 — Scoring and reporting

### BENCH-080 Version scoring

Acceptance:

```text
- score.json per version;
- formula configurable;
- missing metrics handled.
```

### BENCH-081 Trajectory summary

Acceptance:

```text
- versions passed;
- first failure;
- total tokens;
- lifecycle quality;
- maintainability score.
```

### BENCH-082 Matrix report

Acceptance:

```text
- report.md;
- scores.csv;
- leaderboard.csv;
- grouped by model/prompt/task.
```

## Epic 10 — External jury

### BENCH-090 Anonymized mapping

Acceptance:

```text
- variant ids generated;
- private mapping saved separately;
- no model/prompt leaked in public packet.
```

### BENCH-091 Jury packet export

Acceptance:

```text
- screenshots;
- requirements;
- summary;
- code-health summary;
- review form;
- manifest.json.
```

### BENCH-092 Jury import/report

Acceptance:

```text
- CSV/JSON import;
- human scores aggregated;
- disagreement report generated.
```

## Epic 11 — Dashboard Lite stretch

### BENCH-100 Dashboard task

Acceptance:

```text
- reference assets;
- semantic UI;
- e2e/value/visual tests;
- evolution v1..v3.
```

## First implementation slice

```text
BENCH-001
BENCH-002
BENCH-003
BENCH-010
BENCH-011
BENCH-020
BENCH-030
BENCH-031
BENCH-040
BENCH-041
BENCH-050
BENCH-051
BENCH-052
BENCH-060
BENCH-061
BENCH-070
BENCH-080
BENCH-081
```
