# Observable Lifecycle Comparison

Experiment: r2-observable-u3-u5-go-primary-repair

## Method

First successful real v0-to-v2 case per prompt arm. This report is descriptive and does not claim statistical superiority.

## Baseline

- compatible: true
- runner commit: d88893eeeab4e62d0d58d227326321e6d776a7a5

## U3-semantic-ui

- execution: 20260714T005700Z-real-310b8a
- trajectory: todomvc__deepseek-v4-flash__S2-maintainable-simple__U3-semantic-ui__E2-smallest-maintainable-change__r3
- lifecycle tokens: 2859676 (210972 non-cache; 2648704 cache-read)
- repairs: 1

| Version | Status | Score | Total tokens | Delta tokens | Delta non-cache | Delta cache-read | LOC | Largest file LOC | Code health (duplicate/cycles/complexity) | Diff (+/-/files/rewrite) | Repairs | Feedback |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | --- |
| v0 | passed | 1.00 | 476376 | 0 | 0 | 0 | 233 | 117 | 0.16666666666666666/0/15 | 125/15/3/0.107 | 0 | preflight |
| v1 | passed | 1.00 | 2065974 | 1589598 | 82782 | 1506816 | 372 | 197 | 0.26422764227642276/0/31 | 181/29/2/0.138 | 1 | preflight |
| v2 | passed | 1.00 | 317326 | -1748648 | -88488 | -1660160 | 393 | 208 | 0.26515151515151514/0/32 | 22/0/2/0.000 | 0 | preflight |

### Supervision

- required clarification: versions=0, rounds=0, questions=0, answer words=0, limits reached=0
- actual human activity: answers=0, answer words=0, prompt corrections=0, acceptance corrections=0, code edits=0

## U5-maintainable

- execution: 20260714T005700Z-real-310b8a
- trajectory: todomvc__deepseek-v4-flash__S2-maintainable-simple__U5-maintainable__E2-smallest-maintainable-change__r2
- lifecycle tokens: 3521428 (303252 non-cache; 3218176 cache-read)
- repairs: 2

| Version | Status | Score | Total tokens | Delta tokens | Delta non-cache | Delta cache-read | LOC | Largest file LOC | Code health (duplicate/cycles/complexity) | Diff (+/-/files/rewrite) | Repairs | Feedback |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | --- |
| v0 | passed | 1.00 | 330622 | 0 | 0 | 0 | 412 | 188 | 0.23371647509578544/0/14 | 369/13/3/0.034 | 0 | preflight |
| v1 | passed | 1.00 | 2808546 | 2477924 | 160612 | 2317312 | 503 | 233 | 0.2796352583586626/0/28 | 5/6/2/0.545 | 2 | preflight |
| v2 | passed | 1.00 | 382260 | -2426286 | -160814 | -2265472 | 530 | 249 | 0.3039772727272727/0/28 | 31/1/3/0.031 | 0 | preflight |

### Supervision

- required clarification: versions=0, rounds=0, questions=0, answer words=0, limits reached=0
- actual human activity: answers=0, answer words=0, prompt corrections=0, acceptance corrections=0, code edits=0

## All Attempts

| Arm | Execution | Status | First failure | Repairs | Lifecycle tokens | Clarification rounds | Human answers | Failure classes |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| U3-semantic-ui | 20260714T005700Z-real-310b8a | completed | none | 1 | 2859676 | 0 | 0 | none,none,none |
| U5-maintainable | 20260714T005700Z-real-310b8a | completed | none | 2 | 3521428 | 0 | 0 | none,none,none |
