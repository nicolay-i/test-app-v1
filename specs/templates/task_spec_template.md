# Task Spec Template

```yaml
id: <task-id>
name: <Human-readable task name>
version: 0.1.0
kind: crud_stateful | content_routing | visual_dashboard | kanban_workflow | form_settings
scaffold: vite-react-ts
license_status: permissive_reference | synthetic | internal_only

source:
  name: <source-name>
  url: <source-url>
  license: <license>
  dateAccessed: YYYY-MM-DD
  notes: <what is reused and normalized>

reference:
  spec: reference/spec.md
  acceptanceCriteria: reference/acceptance-criteria.md
  semanticUi: reference/semantic-ui.xml
  expectedValues: reference/expected-values.json
  styleTokens: reference/style-tokens.json
  mockData: reference/mock-data.json
  screenshots:
    desktop: reference/screenshots/desktop.png
    mobile: reference/screenshots/mobile.png

constraints:
  framework: react
  language: typescript
  styling: css_or_tailwind
  persistence: localStorage | none
  backend: none
  forbidden:
    - external backend services
    - auth providers
    - paid APIs

checks:
  install: true
  build: true
  runtimeSmoke: true
  e2e:
    - tests/base/e2e.spec.ts
  values:
    - tests/base/values.spec.ts
  visual:
    - tests/base/visual.spec.ts
  codeHealth: true

scoring:
  weights: scoring/weights.yaml

evolution:
  - id: 01-change-name
    name: <change name>
    prompt: evolution/01-change-name.md
    tests:
      - tests/evolution/01-change-name.spec.ts
    expectedBlastRadius:
      size: small
      maxChangedFiles: 5
      maxRewriteRatio: 0.2
```

## reference/spec.md sections

```markdown
# <Task Name>

## Goal

## Screens

## Features

## Data model

## User flows

## Responsive behavior

## Constraints

## Non-goals
```

## reference/source-notes.md sections

```markdown
# Source Notes

Source name:
Source URL:
License:
Date accessed:
What was reused:
What was normalized:
What was not reused:
Trademark/brand removals:
Open questions:
```
