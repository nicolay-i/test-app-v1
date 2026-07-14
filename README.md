# Benchmark эволюции промптов приложения

Рабочее пространство benchmark-а из `specs/`.

## Команды

```bash
pnpm install
pnpm bench init
pnpm bench preflight --config configs/mvp.yaml
pnpm bench validate-task tasks/todomvc

pnpm bench run-one \
  --task todomvc \
  --model deepseek-v4-flash-free \
  --system S2-maintainable-simple \
  --user U5-maintainable \
  --edit E2-smallest-maintainable-change \
  --versions 4 \
  --run-type mock

pnpm bench run-matrix --config configs/mvp.yaml --dry-run
pnpm bench run-matrix --config configs/mvp.yaml --run-type mock --versions 2 --max-trajectories 2
pnpm bench run-matrix --config configs/r2-ab-u3-vs-u5.yaml --run-type real --versions 2
pnpm bench report-experiment --config configs/r2-ab-u3-vs-u5.yaml --id r2-observable-u3-u5 --executions <execution-id>
pnpm bench aggregate --config configs/mvp.yaml --execution <execution-id>
pnpm bench verify-run --execution <execution-id>
pnpm bench record-proof --execution <execution-id> --out proof/<name>.json --command "pnpm bench run-one ..."

pnpm bench negotiate-one \
  --task todomvc \
  --scenario 03-underspecified-tags \
  --model deepseek-v4-flash-free \
  --system S2-maintainable-simple \
  --run-type mock \
  --full

# Для preflight по конкретной версии приложения:
pnpm bench negotiate-one ... --source-workspace runs/<matrix>/executions/<id>/workspaces/<trajectory>

pnpm bench export-jury-packet --trajectory <trajectory-id> --blind --out jury-packets/<packet-id>
pnpm bench import-jury-review --trajectory <trajectory-id> --review jury-packets/<packet-id>/review-form.md --reviewer reviewer-1
```

## Текущая область

Runner поддерживает TodoMVC-траекторию: генерацию v0, эволюционные промпты v1..v4, накопительные регрессионные тесты, несколько попыток repair (`repair-N`), requirements preflight с clarification rounds, continuation той же OpenCode session, артефакты по версиям, сводки траекторий, агрегацию, сценарии переговоров и экспорт/импорт слепых пакетов жюри.

После каждой OpenCode-попытки runner сохраняет фильтрованный снапшот workspace в `opencode-attempts/attempt-N/workspace/`; путь записывается в `opencode-attempts.json` как `codeSnapshotPath`. В снапшот входят исходники и конфигурация, но не `node_modules`, build output, `.git` и служебные файлы benchmark-а. Это позволяет анализировать код каждого implementation, continuation, preflight и repair отдельно от финального `git.diff` версии.

`--run-type mock` использует детерминированный локальный генератор и исключается из leaderboard. `--run-type real` вызывает OpenCode. Реальный запуск требует чистого git-дерева; `--allow-dirty` предназначен только для диагностики и помечает execution как непригодный для публикации. Для такого запуска сохраняются `source.patch` и его SHA-256.

Каждый `run-one` и `run-matrix` по умолчанию создаёт новое execution. Возобновление требует `--resume <execution-id>` и отклоняет изменения типа запуска, исходного кода runner-а, состояния репозитория, config/task/prompt/scaffold-хешей, числа версий, mock-профиля или определения траектории. `--fresh` и `--force-new-execution` — явные синонимы нового запуска; их нельзя сочетать с `--resume`.

В R2-matrix arm ограничен тремя trajectories. Выполнение фиксируется в `experiment-manifest.json`; после первого успешного cumulative case оставшиеся trajectories этого arm помечаются `skipped_after_first_success` и не запускаются.

Фактические ручные действия передаются только явным JSONL-журналом `--interventions <path>`. Каждая запись содержит `version_id`, `kind` (`human_prompt_correction`, `human_acceptance_correction` или `human_code_edit`) и `text`; для `human_code_edit` обязательны/допустимы counters `manual_files_changed`, `manual_lines_added`, `manual_lines_deleted`. Runner сохраняет исходный журнал в artifacts и отделяет эти counters от oracle/scenario clarifications.

`pnpm proof:mock` и `pnpm proof:fairness` — детерминированные локальные proof-проверки без учётных данных провайдера. Fairness proof включает контрольные реализации и mutations для completed-filter, due dates и search. GitHub Actions workflow пока не настроен.
