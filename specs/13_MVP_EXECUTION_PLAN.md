# MVP Execution Plan

## 1. Goal for first few days

Получить работающий end-to-end benchmark на 1–2 задачах и 3 OpenCode free models.

Не строить идеальную платформу. Нужна проверяемая pipeline:

```text
run matrix → generate apps → evolve apps → evaluate → score → export jury packet
```

## 2. Day 0 — repo skeleton

Deliverables:

```text
- pnpm workspace;
- TypeScript config;
- CLI skeleton;
- config loader;
- task validator skeleton;
- runs directory structure;
- Vite React TS scaffold;
- README with commands.
```

Acceptance:

```bash
pnpm install
pnpm bench init
pnpm bench preflight --config configs/mvp.yaml
```

## 3. Day 1 — TodoMVC task + evaluator

Deliverables:

```text
- tasks/todomvc/task.yaml;
- TodoMVC spec/acceptance criteria;
- semantic-ui.xml;
- mock data;
- base Playwright tests;
- build/runtime/e2e evaluator;
- screenshots capture.
```

Acceptance:

```bash
pnpm bench validate-task tasks/todomvc
pnpm bench eval --workspace scaffolds/vite-react-ts --task todomvc --version v0
```

## 4. Day 2 — OpenCode integration + v0 generation

Deliverables:

```text
- opencode adapter;
- prompt compiler;
- run-one command;
- raw event logging;
- git diff capture;
- first TodoMVC v0 generation for one model/prompt;
- build/e2e result stored.
```

Acceptance:

```bash
pnpm bench run-one --task todomvc --model opencode/deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --versions 0
pnpm bench report --run runs/<id>
```

## 5. Day 3 — lifecycle/evolution

Deliverables:

```text
- evolution steps v1..v4 for TodoMVC;
- edit prompt compiler;
- run version in same workspace;
- regression test accumulation;
- code-health metrics basic: LOC, largest file, changed files, changed lines;
- trajectory summary.
```

Acceptance:

```bash
pnpm bench run-one --task todomvc --model opencode/deepseek-v4-flash-free --system S2-maintainable-simple --user U5-maintainable --edit E2-smallest-maintainable-change --versions 4
```

## 6. Day 4 — prompt/model matrix

Deliverables:

```text
- run-matrix command;
- models: deepseek, mimo, nemotron;
- prompts: U1/U3/U5;
- runsPerCell = 2;
- randomization;
- CSV/JSONL aggregation;
- leaderboard report.
```

Acceptance:

```bash
pnpm bench run-matrix --config configs/todomvc_mvp.yaml
pnpm bench report --run runs/<matrix-id>
```

## 7. Day 5 — external jury packet

Deliverables:

```text
- anonymized variant mapping;
- jury packet export;
- screenshots included;
- code-health summary included;
- review form markdown;
- CSV import schema;
- jury report placeholder.
```

Acceptance:

```bash
pnpm bench jury export --run runs/<matrix-id> --sample balanced --mode blind
pnpm bench jury import --run runs/<matrix-id> --input examples/jury-results.csv
pnpm bench jury report --run runs/<matrix-id>
```

## 8. Stretch — Dashboard Lite

Deliverables:

```text
- dashboard-lite reference based on Flowbite-like layout;
- semantic UI tree;
- visual tests;
- value tests for cards/table;
- evolution v1..v3.
```

## 9. Cut scope if needed

Если free limits/time давят:

```text
- оставить только TodoMVC;
- оставить only U1/U5;
- оставить one run per cell;
- versions v0..v3;
- отключить visual snapshot;
- отключить jscpd/dependency-cruiser, оставить LOC/diff metrics.
```

Минимальный полезный результат:

```text
1 task × 3 models × 2 prompt arms × 1 run × 4 versions = 24 agent steps
```

## 10. Implementation order

Не начинать с report polish. Порядок:

```text
1. Workspace creation.
2. OpenCode run works.
3. Build/e2e checks work.
4. Evolution step works.
5. Metrics stored.
6. Matrix runner.
7. Report.
8. Jury packet.
```

## 11. MVP success criteria

MVP успешен, если можно ответить на вопросы:

```text
- Какая из U1/U3/U5 формулировок дала лучший v0?
- Какая выдержала больше changes?
- На каком version начались регрессии?
- У какой модели быстрее растёт token cost?
- Где появился самый большой файл/дубли?
- Совпадает ли external jury с automated ranking?
```

## 12. Risks

### 12.1 Free models unstable/limited

Mitigation:

```text
- preflight models;
- маленькая матрица;
- resume;
- raw logs;
- не делать выводы по одному run.
```

### 12.2 Generated apps vary wildly

Mitigation:

```text
- strict scaffold;
- clear constraints;
- stable tests;
- multiple runs;
- seed/order logging.
```

### 12.3 Tests too brittle

Mitigation:

```text
- semantic selectors;
- no CSS class selectors;
- tolerate visual differences;
- keep e2e about behavior, not implementation.
```

### 12.4 Metrics punish good architecture

Mitigation:

```text
- separate overengineering penalty;
- use expected blast radius;
- combine metrics with jury review.
```
