# Observable Lifecycle Comparison

Experiment: r2-observable-u3-u5

## Method

First successful real v0-to-v2 case per prompt arm. This report is descriptive and does not claim statistical superiority.

## Baseline

- compatible: true
- runner commit: e495166c9dfc2508b88cfc3d0e10152dfaf696f4

## U3-semantic-ui

- execution: 20260713T054622Z-real-08c293
- trajectory: todomvc__deepseek-v4-flash-free__S2-maintainable-simple__U3-semantic-ui__E2-smallest-maintainable-change__r5
- lifecycle tokens: 1622150 (181382 non-cache; 1440768 cache-read)
- repairs: 1

| Version | Status | Score | Total tokens | Delta tokens | Delta non-cache | Delta cache-read | LOC | Largest file LOC | Diff (+/-/files/rewrite) | Repairs | Feedback |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| v0 | passed | 1.00 | 353226 | 0 | 0 | 0 | 374 | 203 | 194/19/3/0.089 | 0 | preflight |
| v1 | passed | 1.00 | 1005956 | 652730 | 61498 | 591232 | 466 | 245 | 124/21/2/0.145 | 1 | preflight |
| v2 | passed | 1.00 | 262968 | -742988 | -65484 | -677504 | 493 | 257 | 30/1/2/0.032 | 0 | preflight |

### Supervision

- required clarification: versions=0, rounds=0, questions=0, answer words=0, limits reached=0
- actual human activity: answers=0, answer words=0, prompt corrections=0, acceptance corrections=0, code edits=0

## U5-maintainable

- execution: 20260713T055703Z-real-e92cc1
- trajectory: todomvc__deepseek-v4-flash-free__S2-maintainable-simple__U5-maintainable__E2-smallest-maintainable-change__r3
- lifecycle tokens: 3033649 (262961 non-cache; 2770688 cache-read)
- repairs: 3

| Version | Status | Score | Total tokens | Delta tokens | Delta non-cache | Delta cache-read | LOC | Largest file LOC | Diff (+/-/files/rewrite) | Repairs | Feedback |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| v0 | passed | 1.00 | 722806 | 0 | 0 | 0 | 225 | 116 | 134/21/3/0.135 | 1 | preflight |
| v1 | passed | 1.00 | 2059656 | 1336850 | 61714 | 1275136 | 380 | 184 | 5/1/2/0.167 | 2 | preflight |
| v2 | passed | 1.00 | 251187 | -1808469 | -105813 | -1702656 | 407 | 196 | 33/4/2/0.108 | 0 | preflight |

### Supervision

- required clarification: versions=0, rounds=0, questions=0, answer words=0, limits reached=0
- actual human activity: answers=0, answer words=0, prompt corrections=0, acceptance corrections=0, code edits=0

## All Attempts

| Arm | Execution | Status | First failure | Repairs | Lifecycle tokens | Clarification rounds | Human answers | Failure classes |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| U3-semantic-ui | 20260713T054622Z-real-08c293 | completed | none | 1 | 1622150 | 0 | 0 | none,none,none |
| U5-maintainable | 20260713T055703Z-real-e92cc1 | completed | none | 3 | 3033649 | 0 | 0 | none,none,none |
