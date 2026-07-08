# Security, Privacy, Licensing and Reproducibility

## 1. Privacy rule

Не отправлять во free models:

```text
- private source code;
- customer data;
- personal data;
- credentials;
- internal URLs;
- private Figma links;
- production logs;
- paid/proprietary assets.
```

OpenCode Zen docs указывают exceptions for free model privacy/retention. Поэтому benchmark должен быть synthetic/open-source.

## 2. Secrets hygiene

Перед запуском:

```text
- не передавать env с API keys;
- очищать .env;
- не включать ~/.ssh;
- не давать доступ к private repos;
- не писать secrets в prompts;
- scan workspace for secret-like strings before jury export.
```

MVP secret scan:

```text
- grep for API_KEY, SECRET, TOKEN, PASSWORD, PRIVATE_KEY;
- optional gitleaks later.
```

## 3. Workspace isolation

MVP:

```text
- disposable directory per trajectory;
- no secrets in env;
- no symlinks outside workspace;
- git initialized inside workspace;
- artifacts copied out after run.
```

Later:

```text
- Docker container per trajectory;
- network restrictions;
- CPU/memory/time limits;
- read-only reference assets.
```

## 4. Licensing

Каждый task должен иметь:

```text
reference/source-notes.md
license field in task.yaml
what was reused
what was normalized
attribution notes
```

Правило:

```text
If unsure about asset reuse, do not distribute the asset in public benchmark package.
Keep only metadata or synthetic replacement.
```

## 5. Brand/trademark handling

Не писать:

```text
Build an exact Todoist clone.
Build an exact Trello clone with same logo/colors/copy.
```

Писать:

```text
Build a TodoMVC-style task app.
Build a neutral kanban board app.
Build a Medium-like content feed using synthetic brand/data.
```

## 6. Reproducibility

Сохранять:

```text
- date/time;
- model id;
- opencode version;
- node/pnpm versions;
- task version;
- prompt files exact content;
- config yaml;
- raw OpenCode events;
- generated source snapshot or git commits;
- test versions;
- metrics tool versions.
```

## 7. Determinism

Для tests:

```text
- fixed dates;
- fixed mock data;
- no network;
- no random ids in visible UI unless seeded;
- deterministic sort order;
- localStorage cleared before tests;
- viewport fixed.
```

## 8. Jury anonymization

Jury packet must hide:

```text
- model name;
- prompt id;
- run number semantics;
- auto score;
- token cost;
- provider logs;
- internal paths revealing prompt/model.
```

Mapping stored separately:

```text
jury-packet/private-mapping.json
```

Do not send private mapping to judges.

## 9. Data retention

Suggested retention policy:

```text
- raw workspaces: keep for internal research;
- node_modules/dist: delete after run;
- prompts/events/diffs/scores: keep;
- jury packets: keep anonymized;
- model raw logs: keep internal only;
- publish only aggregate reports unless license/privacy reviewed.
```

## 10. External publication

Before publishing benchmark results:

```text
- verify licenses;
- remove raw provider logs if terms unclear;
- anonymize human judges;
- disclose run date;
- disclose free model availability may change;
- disclose sample size;
- disclose task limitations;
- avoid overclaiming.
```

## 11. Known limitations

```text
- Free model endpoints may change over time.
- OpenCode behavior/version may change.
- Visual scoring can be brittle.
- Code-health metrics are proxies, not full architecture understanding.
- Human jury can be biased without blinding/randomization.
- Small task set may not generalize.
```

## 12. Minimum reproducibility bundle

To reproduce a result, store:

```text
runs/<id>/matrix.yaml
runs/<id>/results.jsonl
runs/<id>/scores.csv
runs/<id>/compiled-prompts/
runs/<id>/artifacts/*/*/git.diff
runs/<id>/artifacts/*/*/metrics.json
runs/<id>/artifacts/*/*/score.json
```

Optional but useful:

```text
source snapshots compressed per trajectory
Playwright reports
screenshots
opencode raw events
```
