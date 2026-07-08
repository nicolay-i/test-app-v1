# OpenCode Integration Spec

## 1. Цель

Интеграция должна запускать coding agent как black box и сохранять всё, что нужно для воспроизводимого анализа:

```text
- prompt;
- model id;
- workspace path;
- raw stdout/stderr;
- JSON events;
- session id;
- token usage;
- latency;
- final status;
- generated diff.
```

## 2. Основание

OpenCode CLI поддерживает non-interactive запуск через `opencode run [message..]`. В документации указаны флаги `--model`, `--file`, `--format`, `--dir`, `--auto`, `--attach` и др. Также `opencode models --refresh` можно использовать для обновления списка моделей.

Публичные docs:

```text
https://opencode.ai/docs/cli/
https://opencode.ai/docs/zen/
```

## 3. Model IDs для MVP

Использовать формат:

```text
opencode/<model-id>
```

Начальная тройка:

```text
opencode/deepseek-v4-flash-free
opencode/mimo-v2.5-free
opencode/nemotron-3-ultra-free
```

Важно: free models могут быть временными/ограниченными. Перед запуском матрицы runner должен делать preflight:

```bash
opencode models --refresh
```

И проверять, что нужные модели доступны.

## 4. Privacy caveat

Для free models нельзя отправлять персональные, секретные или коммерчески чувствительные данные. В OpenCode Zen privacy docs указано, что free endpoints могут использовать данные для улучшения моделей/сервисов или логировать trial usage.

Правило benchmark-а:

```text
Все задачи, mock data, screenshots, semantic UI tree и prompts должны быть synthetic/open-source/permissive.
Никаких private repos, credentials, customer data, PII.
```

## 5. Базовая команда

```bash
opencode run \
  --model opencode/deepseek-v4-flash-free \
  --dir ./runs/<matrix-id>/workspaces/<trajectory-id> \
  --format json \
  --auto \
  --title "<trajectory-id>:v0" \
  "$(cat ./runs/<matrix-id>/compiled-prompts/<trajectory-id>/v0.md)"
```

Если prompt слишком большой или нужны вложения:

```bash
opencode run \
  --model opencode/deepseek-v4-flash-free \
  --dir ./runs/<matrix-id>/workspaces/<trajectory-id> \
  --format json \
  --auto \
  --file ./tasks/todomvc/reference/spec.md \
  --file ./tasks/todomvc/reference/semantic-ui.xml \
  "$(cat ./compiled-prompt.md)"
```

## 6. Optional server attach

Для уменьшения cold boot overhead можно держать headless server:

```bash
opencode serve
```

А потом:

```bash
opencode run --attach http://localhost:4096 "..."
```

MVP может не использовать attach. Добавить как optimization flag:

```yaml
opencode:
  attachUrl: null
```

## 7. TypeScript adapter API

```ts
export type OpenCodeRunRequest = {
  model: string;
  cwd: string;
  prompt: string;
  title: string;
  files?: string[];
  format?: 'json' | 'default';
  autoApprove?: boolean;
  timeoutMs?: number;
};

export type OpenCodeRunResult = {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  stdoutPath: string;
  stderrPath: string;
  eventsPath?: string;
  sessionId?: string;
  tokenUsage?: {
    input?: number;
    output?: number;
    cachedRead?: number;
    cachedWrite?: number;
    total?: number;
  };
  error?: string;
};
```

## 8. Parsing JSON events

`--format json` должен сохраняться как raw JSONL, даже если parser пока не умеет извлекать все поля.

MVP parser:

```text
- session id, если доступен;
- usage/tokens, если доступно;
- tool calls count;
- final assistant message;
- errors.
```

Если token usage не удалось достать из events:

```text
- fallback: opencode stats после run;
- или считать tokens approximated через tokenizer позднее;
- или помечать usage_status = unavailable.
```

Не выдумывать token usage.

## 9. Permissions

`--auto` ускоряет прогон, но может быть опасным. Для MVP workspaces должны быть disposable.

Рекомендуемые ограничения:

```text
- run only inside generated workspace;
- no secrets in environment;
- no private SSH keys;
- optional no-network sandbox later;
- delete node_modules from archived artifacts, если нужно экономить место.
```

## 10. Prompt conventions for OpenCode

Каждый prompt должен явно говорить:

```text
- использовать текущий проект;
- не создавать вложенный новый проект внутри src или app;
- не удалять test/reference files;
- запускать/обновлять package scripts только при необходимости;
- сохранять приложение запускаемым через pnpm dev/build/test;
- не добавлять тяжелые зависимости без причины;
- не переписывать всё приложение при локальном изменении, если это не требуется.
```

## 11. Failure handling

Если OpenCode завершился с non-zero exit:

```text
- сохранить raw logs;
- пометить generation_failed;
- не запускать e2e;
- всё равно запустить git diff metrics, если файлы изменились;
- разрешить один retry только если ошибка инфраструктурная, не model-generated.
```

Если app не собирается:

```text
- optional repair attempt;
- prompt includes build error excerpt;
- model instructed to make minimum fix;
- repair tokens tracked separately.
```

## 12. Preflight checklist

Перед matrix run:

```bash
node --version
pnpm --version
opencode --version
opencode models --refresh
pnpm exec playwright --version
```

И проверить:

```text
- модели доступны;
- scaffold собирается;
- Playwright browsers installed;
- git доступен;
- tasks валидны;
- output directory writable;
- enough disk space.
```
