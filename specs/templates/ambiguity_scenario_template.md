# Ambiguity Scenario Template

Use this template for one unclear, wrong, incomplete or contradictory feature request.

## Directory

```text
tasks/<task-id>/ambiguity/<scenario-id>/
  request.md
  expected.yaml
  oracle.yaml
  tests-after-oracle.spec.ts
  jury-context.md
```

## request.md

```md
# User request

{{USER_REQUEST_VISIBLE_TO_AGENT}}
```

## expected.yaml

```yaml
id: {{scenario-id}}
name: {{Human name}}
kind: ambiguity
category:
  - {{feature-already-exists | user-misconception | underspecified-feature | hidden-cross-cutting-change | ambiguous-replacement | deletion-with-cleanup | missing-reference-asset | scope-explosion}}

taskId: {{task-id}}
startVersion: {{v0|v1|v2}}
requestFile: request.md

expectedDecision:
  primary: {{proceed|proceed_with_assumptions|clarify|already_exists|conflict|out_of_scope|cannot_validate}}
  acceptable:
    - {{optional alternative decision}}
  unacceptable:
    - {{bad decision}}

blockingClarification: {{true|false}}

expectedAgentFindings:
  required:
    - id: {{finding-id}}
      description: {{what the agent must notice}}
      matchHints:
        - {{keyword or phrase}}
  optional:
    - id: {{optional-finding-id}}
      description: {{optional useful observation}}

requiredQuestions:
  - id: {{question-id}}
    topic: {{decision-critical topic}}
    blocking: {{true|false}}
    acceptablePhrases:
      - {{phrase}}

prohibitedQuestions:
  - topic: {{non-critical topic}}
    reason: {{why it should not block}}

recommendedDefault:
  required: {{true|false}}
  expected: {{recommended default behavior}}

expectedAffectedAreas:
  required:
    - {{data model}}
    - {{UI}}
    - {{persistence}}
  optional:
    - {{tests}}

prohibitedBehavior:
  - id: {{bad-behavior-id}}
    description: {{what the agent must not do}}

oracle:
  file: oracle.yaml

postClarification:
  required: {{true|false}}
  tests:
    - tests-after-oracle.spec.ts

scoring:
  weights:
    decisionAccuracy: 0.3
    findingRecall: 0.2
    questionPrecision: 0.15
    existingBehaviorAwareness: 0.15
    hiddenImpactDetection: 0.1
    recommendedDefaultQuality: 0.1
  penalties:
    unnecessaryQuestion: 0.05
    silentWrongImplementation: 1.0
```

## oracle.yaml

```yaml
id: {{scenario-id}}-oracle
scenarioId: {{scenario-id}}
mode: precise-product-owner

answerPolicy:
  maxTurns: 2
  answerOnlyAskedQuestions: true
  includeRecommendedScope: true
  revealEvaluationRubric: false

answers:
  - id: {{answer-id}}
    whenQuestionMatches:
      - {{keyword}}
      - {{keyword}}
    answer: {{oracle answer}}

fallbackAnswer: >
  {{fallback answer with intended behavior}}

finalIntendedBehavior:
  - {{behavior 1}}
  - {{behavior 2}}

postOracleInstruction: >
  Implement the clarified behavior. Preserve existing behavior and avoid unrelated changes.
```

## jury-context.md

```md
# Jury context

Current app state:
{{summary}}

User request:
{{request}}

Known intended behavior:
{{intended behavior, for gold review only}}

Review focus:
- Did the agent correctly decide whether to ask?
- Were the questions decision-critical?
- Did it avoid wrong implementation?
- Did it preserve old behavior?
```
```
