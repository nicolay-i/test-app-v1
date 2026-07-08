# App Prompt Evolution Benchmark — набор спек

Дата подготовки: 2026-07-08

## Суть проекта

Проект нужен для A/B/n-тестирования промптов, которые используются для генерации и дальнейшей доработки веб-приложений через coding agent. Основной вопрос не только в том, какой промпт даёт лучший `v0`, а в том, какой промпт создаёт кодовую базу, которую дешевле и безопаснее менять на дистанции.

Главная метрика проекта:

```text
lifecycle_quality / lifecycle_cost
```

То есть:

```text
насколько качественно приложение работает и развивается
на каждый потраченный токен / прогон / repair attempt
```

## Что benchmark должен проверять

1. Насколько хорошо модель реализует приложение по разным формулировкам пользовательского промпта.
2. Насколько системные промпты влияют на качество, дисциплину и поддерживаемость кода.
3. Какой формат reference input лучше работает: обычное описание, acceptance criteria, semantic HTML-like UI tree, e2e-сценарии, скриншоты.
4. Как быстро кодовая база превращается в неподдерживаемую при последовательных изменениях.
5. Как растёт токен-расход на аналогичные изменения в разных траекториях.
6. Насколько автоматические оценки совпадают с внешней экспертной оценкой.

## Основные единицы эксперимента

```text
task_id
model_id
system_prompt_arm_id
user_prompt_arm_id
asset_representation_id
edit_prompt_arm_id
run_id
version_id
```

Один эксперимент — это не один prompt → app, а полная траектория:

```text
prompt → app_v0 → change_1 → app_v1 → ... → change_N → app_vN
```

## Рекомендуемый MVP

Для первых нескольких дней:

```text
Tasks:
- TodoMVC Lifecycle
- Dashboard Lite from Flowbite-like reference
- Conduit Lite, если останется время

Models:
- opencode/deepseek-v4-flash-free
- opencode/mimo-v2.5-free
- opencode/nemotron-3-ultra-free

Prompt arms:
- U1 structured
- U3 structured + semantic UI
- U5 structured + semantic UI + maintainability addendum

System prompt:
- S2 maintainable-simple

Runs:
- 2 на комбинацию

Evolution:
- v0 + 4 изменения
```

Минимальный smoke test:

```text
1 task × 3 models × 3 prompt arms × 2 runs × 6 versions = 108 agent steps
```

## Состав архива

```text
00_README.md
01_PRODUCT_SPEC.md
02_SYSTEM_ARCHITECTURE_NODEJS.md
03_OPENCODE_INTEGRATION_SPEC.md
04_BENCHMARK_TASK_FORMAT.md
05_PROMPT_AB_TESTING_SPEC.md
06_REFERENCE_ASSETS_AND_SOURCES.md
07_EVALUATION_PIPELINE_SPEC.md
08_CODE_HEALTH_AND_MAINTAINABILITY_METRICS.md
09_LIFECYCLE_EVOLUTION_BENCHMARK.md
10_EXTERNAL_JURY_FEEDBACK_SPEC.md
11_DATA_MODEL_AND_RESULT_SCHEMA.md
12_RUNNER_CLI_SPEC.md
13_MVP_EXECUTION_PLAN.md
14_SECURITY_PRIVACY_REPRODUCIBILITY.md
15_IMPLEMENTATION_BACKLOG.md

templates/
  task_spec_template.md
  prompt_arm_template.md
  system_prompt_template.md
  edit_prompt_template.md
  evolution_step_template.md
  semantic_ui_template.md
  scoring_config_template.md
  external_jury_form_template.md
  final_report_template.md
  model_config_template.md

examples/
  todomvc_task_example.md
  jury_packet_example.md
```

## Важные публичные источники для reference apps/assets

- TodoMVC repo/spec: https://github.com/tastejs/todomvc
- TodoMVC app spec: https://github.com/tastejs/todomvc/blob/master/app-spec.md
- RealWorld / Conduit: https://github.com/realworld-apps/realworld
- Flowbite Admin Dashboard: https://github.com/themesberg/flowbite-admin-dashboard
- Flowbite Figma UI Kit: https://github.com/themesberg/tailwind-figma-ui-kit
- OpenCode CLI docs: https://opencode.ai/docs/cli/
- OpenCode Zen models/pricing/privacy: https://opencode.ai/docs/zen/
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- jscpd: https://github.com/kucherenko/jscpd
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
- ESLint complexity rule: https://eslint.org/docs/latest/rules/complexity

---

## V2 additions: requirements negotiation benchmark

Вторая версия архива добавляет отдельный слой оценки для ситуаций, когда пользовательский запрос на доработку неполный, ошибочный, противоречивый или требует скрытого продуктового решения.

Новые документы:

```text
16_REQUIREMENTS_NEGOTIATION_BENCHMARK.md
17_AMBIGUITY_SCENARIO_FORMAT.md
18_CLARIFICATION_DECISION_PROTOCOL.md
19_ORACLE_USER_SIMULATION.md
20_CODEX_OPENCODE_SUPERVISOR_SKILL.md
21_NEGOTIATION_SCORING_AND_JURY.md
22_NEGOTIATION_PROMPT_ARMS.md
```

Этот слой проверяет:

```text
- умеет ли агент понять, что функционал уже есть;
- отличает ли он bug report от product change;
- спрашивает ли он уточнение перед рискованным изменением;
- видит ли скрытый blast radius;
- не задаёт ли лишних вопросов;
- умеет ли после oracle answer реализовать именно intended behavior;
- как это влияет на lifecycle cost и maintainability.
```

Рекомендуемый старт:

```text
TodoMVC + 6 ambiguity scenarios + preflight-only mode + 3 negotiation prompt arms.
```
