# Oracle User Template

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
      - {{keyword1}}
      - {{keyword2}}
    answer: {{answer to provide when agent asks matching question}}

fallbackAnswer: >
  {{fallback intended behavior if no specific question matches}}

finalIntendedBehavior:
  - {{expected behavior 1}}
  - {{expected behavior 2}}
  - {{expected behavior 3}}

postOracleInstruction: >
  Implement the clarified behavior. Preserve existing behavior and avoid unrelated changes.
```

## Modes

```text
precise-product-owner
  Complete and clear answer. Recommended for MVP.

terse-user
  Short answer, still enough to proceed.

partial-answer-user
  Answers only some questions, useful for later robustness tests.

confused-user
  Answers imprecisely, useful for stress tests.
```
