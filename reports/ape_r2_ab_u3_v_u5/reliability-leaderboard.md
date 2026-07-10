# Надёжность

Execution: `20260710T153150Z-real-bedb90`.

| Arm | Запусков | Исключено как adapter failure | Оставшихся model-result trajectories | Вывод |
| --- | ---: | ---: | ---: | --- |
| U3-semantic-ui | 3 | 2 | 1 | Единственная оцениваемая траектория завершилась на v1 после repair |
| U5-maintainable | 3 | 3 | 0 | Сравнение качества недоступно |

Пять trajectories завершились `opencode_failure` после provider stall и исключены из
ranking. Это не свидетельство в пользу или против prompt arm.
