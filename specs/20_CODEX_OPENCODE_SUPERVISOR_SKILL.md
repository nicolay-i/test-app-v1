# Codex ↔ OpenCode Supervisor Skill Spec

## 1. Назначение

Этот документ описывает вариант, где Codex agent выступает supervisor-ом benchmark-а, а OpenCode agent является implementer-ом под тестом.

Цель:

```text
Codex управляет экспериментом, запускает OpenCode, передаёт prompts, симулирует oracle user, запускает проверки и собирает артефакты.
```

OpenCode при этом не должен знать, какой prompt arm или model arm тестируется, если это не требуется экспериментом.

## 2. Роли

### 2.1 Codex supervisor

Отвечает за:

```text
- подготовку worktree/workspace;
- сборку prompt-а;
- запуск OpenCode CLI/server;
- контроль clarification gate;
- oracle user simulation;
- запуск build/e2e/code-health checks;
- сбор git diff и метрик;
- экспорт jury packet;
- запись results.jsonl.
```

### 2.2 OpenCode implementer

Отвечает за:

```text
- анализ текущего кода;
- preflight decision;
- вопросы при необходимости;
- реализацию после APPROVED_TO_EDIT;
- сохранение работающего приложения.
```

OpenCode agent является объектом A/B теста.

### 2.3 Oracle user

Скриптованный пользователь, который отвечает на вопросы implementer-а.

### 2.4 Evaluator

Node.js/TypeScript pipeline:

```text
- build check;
- Playwright e2e;
- visual snapshots;
- value checks;
- code-health metrics;
- scoring.
```

## 3. Skill structure

Рекомендуемая структура:

```text
.agent-skills/
  app-prompt-evolution-benchmark/
    SKILL.md
    references/
      benchmark-overview.md
      decision-protocol.md
      ambiguity-taxonomy.md
      scoring-rubric.md
      opencode-contract.md
    scripts/
      run-opencode-step.ts
      run-preflight.ts
      parse-decision.ts
      simulate-oracle.ts
      run-evaluation.ts
      collect-code-health.ts
      export-jury-packet.ts
      summarize-run.ts
    templates/
      preflight-wrapper.md
      implementation-wrapper.md
      oracle-answer-wrapper.md
      jury-packet-template.md
```

Если skill-механизм недоступен, те же файлы могут жить в обычной папке:

```text
tools/benchmark-supervisor/
```

## 4. SKILL.md outline

```md
# App Prompt Evolution Benchmark Skill

Use this skill when running A/B/n benchmark trajectories for LLM-generated app implementations.

Workflow:
1. Read task.yaml and selected run matrix.
2. Create isolated workspace.
3. Invoke OpenCode with selected model and prompt arm.
4. For ambiguity scenarios, require preflight decision JSON before edits.
5. If clarification is needed, answer with oracle user response.
6. Run evaluation pipeline after every version.
7. Save artifacts, metrics, and result rows.
8. Export blind jury packet when configured.

Never leak hidden expected.yaml contents into the agent prompt.
Never disclose prompt arm IDs to external jury packets.
```

## 5. OpenCode invocation contract

CLI mode:

```bash
opencode run \
  --model "$OPENCODE_MODEL" \
  --dir "$WORKSPACE_DIR" \
  --format json \
  --auto \
  "$PROMPT_TEXT"
```

Alternative file mode:

```bash
opencode run \
  --model "$OPENCODE_MODEL" \
  --dir "$WORKSPACE_DIR" \
  --format json \
  --auto \
  --file "$PROMPT_FILE"
```

Runner should capture:

```text
stdout
stderr
exit_code
start_time
end_time
latency_ms
raw JSON output when available
token usage when available
```

## 6. Ambiguity scenario flow

```text
Codex supervisor
  ├── loads scenario expected.yaml
  ├── creates preflight prompt wrapper
  ├── calls OpenCode
  ├── checks git status: no files changed allowed
  ├── parses decision JSON
  ├── scores preflight decision
  ├── if preflight-only:
  │     └── stop and save score
  ├── if clarification needed:
  │     ├── simulate oracle answer
  │     └── send oracle answer + APPROVED_TO_EDIT
  ├── if proceed/already_exists with implementation allowed:
  │     └── send APPROVED_TO_EDIT
  ├── calls OpenCode implementation step
  ├── runs evaluator
  └── saves artifacts
```

## 7. Prompt handoff examples

### 7.1 Preflight prompt to OpenCode

```md
You are the implementation agent in a benchmark.

Before editing files, inspect the current app and classify the user request.
Return only a JSON decision block using the required schema.
Do not edit files until you receive APPROVED_TO_EDIT.

User request:
{{REQUEST}}
```

### 7.2 Oracle answer back to OpenCode

```md
ORACLE_ANSWER

{{ORACLE_ANSWER}}

APPROVED_TO_EDIT

Implement the clarified behavior. Preserve existing behavior and avoid unrelated changes.
```

### 7.3 Proceed approval

```md
APPROVED_TO_EDIT

Implement the requested change according to your preflight decision. Preserve existing behavior and avoid unrelated changes.
```

## 8. Workspace isolation

Each trajectory should run in an isolated directory:

```text
runs/<run-id>/workspace/
```

Use git commits after every version:

```text
v0-generated
v1-add-due-dates
v2-add-search
v3-ambiguity-labels
```

This enables:

```text
- diff metrics;
- rollback;
- artifact review;
- external jury source snapshots;
- reproducibility.
```

## 9. Git guardrails

Before preflight:

```bash
git status --porcelain
```

After preflight:

```bash
git status --porcelain
```

If files changed before approval:

```text
protocol_violation: edited_before_approval
```

After implementation:

```bash
git diff --stat HEAD
git diff HEAD > diff.patch
```

## 10. Artifacts per ambiguity step

```text
runs/<run-id>/versions/v4/ambiguity/<scenario-id>/
  request.md
  preflight-prompt.md
  opencode-preflight-stdout.txt
  opencode-preflight-stderr.txt
  agent-decision.json
  protocol-validation.json
  oracle-input-questions.json
  oracle-answer.md
  implementation-prompt.md
  opencode-implementation-stdout.txt
  opencode-implementation-stderr.txt
  diff.patch
  build.log
  playwright-report/
  code-health.json
  scores.json
  jury-packet/
```

## 11. Skill configuration

Example:

```yaml
benchmarkSkill:
  opencode:
    mode: cli
    command: opencode
    defaultFlags:
      - --format
      - json
      - --auto

  clarificationGate:
    enabled: true
    requireJsonDecision: true
    failOnPreflightEdits: true
    approvalToken: APPROVED_TO_EDIT

  oracle:
    defaultMode: precise-product-owner
    maxTurns: 2

  evaluator:
    runBuild: true
    runE2E: true
    runCodeHealth: true
    exportJuryPacket: true
```

## 12. Failure handling

If OpenCode fails during preflight:

```text
- save raw output;
- mark preflight_status = failed;
- do not attempt implementation unless retry policy allows;
- count token/latency cost if available.
```

If OpenCode asks questions outside JSON:

```text
- parser attempts extraction;
- if no valid JSON, protocol violation;
- optional repair prompt can ask to restate in JSON, but count as repair.
```

If OpenCode implements wrong after oracle:

```text
- run tests;
- mark post_oracle_intent_failure;
- include in silent wrong implementation analysis if applicable.
```

## 13. A/B correctness

The skill must record:

```text
system_prompt_arm_id
user_prompt_arm_id
edit_prompt_arm_id
negotiation_prompt_arm_id
oracle_mode
model_id
scenario_id
```

But external jury packets must hide these fields by default.

## 14. Human review handoff

For each ambiguity step, export:

```text
- current app summary;
- user request;
- agent preflight response;
- questions asked;
- oracle answer;
- final diff summary;
- screenshots;
- test summary;
- anonymized variant id.
```

The jury should not see:

```text
- model name;
- prompt arm id;
- expected.yaml raw scoring config;
- hidden oracle matching rules;
- benchmark author notes that reveal the correct answer too directly, unless used in gold-review mode.
```

## 15. MVP implementation steps

```text
1. Implement preflight wrapper.
2. Implement decision JSON parser.
3. Implement git guard for no edits before approval.
4. Implement oracle matching from oracle.yaml.
5. Implement full negotiation mode for one TodoMVC scenario.
6. Add scoring against expected.yaml.
7. Add jury packet export.
8. Add 5–8 ambiguity scenarios.
```
