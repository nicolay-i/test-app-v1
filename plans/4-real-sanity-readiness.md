# R1: готовность контура к проверке с реальным OpenCode

Текущий repository head: `a479735dcee46f32bfc9cceea1dc70e827f66774`.
Последний зафиксированный clean tested commit из R1: `6385653fb1d26db0fe8485534bb36aae7f2fbf2a`.

| Критерий | Реализация | Доказательство | Статус | Ограничение |
| --- | --- | --- | --- | --- |
| Изоляция execution | `execution.ts`, отдельные каталоги executions/workspaces | mock/real same-cell: `20260710T063302Z-mock-6e605f` и `20260710T055814Z-real-ec6ced` | Proven | Для R1 нет |
| Итог при terminal failure | `cli.ts`, `artifacts.ts` | mock OpenCode failure, timeout, build/E2E failure и `verify-run` | Proven | Не заменяет методологию score |
| Разбор JSONL | `opencodeEventParser.ts` | `pnpm bench verify-opencode-parser`, malformed stream `20260710T060333Z-mock-3123ef` | Proven | Usage может быть unavailable |
| Стоимость жизненного цикла | частичные поля summary | нет полного реального usage-proof | Partial | Нужна нормализация usage в R2 |
| Реальный v0 | адаптер OpenCode | `20260710T055814Z-real-ec6ced`, score 1.00 | Proven | Один model/run |
| Реальный lifecycle | v0->v2 и repair | `20260710T060412Z-real-c773cd` | Proven | Короткая траектория |
| A/B U3 против U5 | aggregation | U3: `20260710T060412Z-real-c773cd`, U5: `20260710T063417Z-real-f89779` | Sanity only | `n=1`, вывод о превосходстве невозможен |
| Negotiation preflight | изолированный preflight workspace | mock run 4 сценария 03; real run 5 обнаружил нарушение протокола | Harness proven | Агент не выдал корректное JSON-решение |
| Слепой экспорт жюри | `juryPacket.ts` strict mode | strict packet r61 и pairwise export | Proven | Жюри не является источником истины |
| Автоматизация proof | `scripts/proof-mock.sh` | локально выполнен `pnpm proof:mock` | Proven locally | Это local pre-merge suite, не GitHub CI |

## Зафиксированные результаты R1

- `pnpm typecheck`, `pnpm bench validate-task tasks/todomvc` и `pnpm bench verify-opencode-parser` проходили на зафиксированном baseline R1.
- `pnpm proof:mock` покрывает happy path, OpenCode failure, timeout, repair success/failure, malformed events, изоляцию одной benchmark-cell и rejection stale resume.
- `verify-run` проверял по 30 обязательных файлов для реальных lifecycle-артефактов и E2E repair-failure.
- Fairness audit TodoMVC описан в `tasks/todomvc/tests/FAIRNESS.md`; due-date проверка сравнивает наблюдаемое вычисленное оформление, а не CSS-класс.

## Граница R1

R1 доказывает работоспособность harness-а и сохранение его артефактов. Он не доказывает публикационную воспроизводимость, полноту lifecycle cost или качество prompt arm: это задачи R2 из `plans/5.md`.
