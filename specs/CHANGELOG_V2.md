# Changelog V2

## Added

This archive extends the original app benchmark specs with a new requirements-negotiation layer.

New core docs:

```text
16_REQUIREMENTS_NEGOTIATION_BENCHMARK.md
17_AMBIGUITY_SCENARIO_FORMAT.md
18_CLARIFICATION_DECISION_PROTOCOL.md
19_ORACLE_USER_SIMULATION.md
20_CODEX_OPENCODE_SUPERVISOR_SKILL.md
21_NEGOTIATION_SCORING_AND_JURY.md
22_NEGOTIATION_PROMPT_ARMS.md
```

New examples/templates:

```text
examples/ambiguity_scenarios_todomvc.md
templates/ambiguity_scenario_template.md
templates/decision_protocol_prompt_template.md
templates/oracle_user_template.md
```

## Main conceptual addition

The benchmark now evaluates whether an agent can handle flawed product requests:

```text
- feature already exists;
- user misconception;
- incomplete feature request;
- contradiction with current behavior;
- hidden cross-cutting scope;
- ambiguous replacement;
- deletion with cleanup;
- missing visual/reference asset;
- scope explosion.
```

## New execution modes

```text
preflight-only
  Agent classifies the request and asks/does not ask. No code edits.

full-negotiation
  Agent preflights, oracle user answers, agent implements, evaluator scores.
```

## New metrics

```text
decision_accuracy
clarification_recall
clarification_precision
existing_behavior_awareness
hidden_impact_detection
silent_wrong_implementation_rate
false_clarification_rate
question_cost
post_clarification_implementation_score
```

## Codex/OpenCode integration

The updated specs include a supervisor design where:

```text
Codex = benchmark supervisor/orchestrator
OpenCode = implementation agent under test
Oracle user = scripted clarification responder
Node.js runner = evaluator and artifact collector
```

## Recommended MVP addition

Start with TodoMVC ambiguity scenarios:

```text
1. Search already exists
2. Mistaken Active filter bug
3. Due dates under-specified
4. Projects require migration
5. Replace projects with labels
6. Missing design reference
```
