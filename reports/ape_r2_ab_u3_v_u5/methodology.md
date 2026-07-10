# Методология A/B R2

Эксперимент сравнивает только `U3-semantic-ui` и `U5-maintainable` при фиксированных
TodoMVC, DeepSeek V4 Flash, system prompt S2 и edit prompt E2. Конфигурация задаёт
три независимых запуска на arm, v0->v2 и детерминированный перемешанный порядок.

Запуск разрешён только на чистом закоммиченном head:

```bash
pnpm bench run-matrix --config configs/r2-ab-u3-vs-u5.yaml --run-type real --versions 2
```

В отчёт включаются только real trajectories без infra failure. Результаты должны
показывать размер выборки и variance; они не доказывают превосходство arm при n=3.
