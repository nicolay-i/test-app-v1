# Статус proof-записей

Файлы в этом каталоге, созданные до схемы `proof_schema_version: "0.2.0"`, являются legacy-доказательствами R1. Они полезны как исторические результаты, но не подтверждают воспроизводимость текущего runner-а: в них отсутствуют SHA-256 execution/artifact manifest и явный статус git-дерева.

Для R2 создавайте записи командой:

```bash
pnpm bench record-proof \
  --execution <execution-id> \
  --out proof/<experiment>-<case>.json \
  --command "pnpm bench run-one ..."
```

Проверка связи записи с текущими артефактами:

```bash
pnpm bench verify-run --execution <execution-id> --proof proof/<experiment>-<case>.json
```

Real proof с `repo_dirty: true` диагностический и не пригоден для опубликованных результатов.
