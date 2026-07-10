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

Runner поддерживает TodoMVC-траекторию: генерацию v0, эволюционные промпты v1..v4, накопительные регрессионные тесты, одну попытку ремонта, артефакты по версиям, сводки траекторий, агрегацию, сценарии переговоров и экспорт/импорт слепых пакетов жюри.

`--run-type mock` использует детерминированный локальный генератор и исключается из leaderboard. `--run-type real` вызывает OpenCode. Реальный запуск требует чистого git-дерева; `--allow-dirty` предназначен только для диагностики и помечает execution как непригодный для публикации. Для такого запуска сохраняются `source.patch` и его SHA-256.

Каждый `run-one` и `run-matrix` по умолчанию создаёт новое execution. Возобновление требует `--resume <execution-id>` и отклоняет изменения типа запуска, исходного кода runner-а, состояния репозитория, config/task/prompt/scaffold-хешей, числа версий, mock-профиля или определения траектории. `--fresh` и `--force-new-execution` — явные синонимы нового запуска; их нельзя сочетать с `--resume`.

`run-matrix` сначала следует применять к малым контролируемым пакетам через `--max-trajectories` и `--versions`.

`pnpm proof:mock` — детерминированный локальный набор proof-проверок без учётных данных провайдера. Это обязательная pre-merge проверка; GitHub Actions workflow в репозитории сейчас не настроен. Набор проверяет parser fixtures, mock lifecycle и конечные сценарии ошибок, repair, проверку артефактов, исключение mock из leaderboard и строгое возобновление.
