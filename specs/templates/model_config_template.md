# Model Config Template

```yaml
models:
  - id: deepseek-v4-flash-free
    provider: opencode
    providerModel: opencode/deepseek-v4-flash-free
    inputMode: text
    notes: Free model availability may change. Check opencode models --refresh before run.

  - id: mimo-v2.5-free
    provider: opencode
    providerModel: opencode/mimo-v2.5-free
    inputMode: text
    notes: Use text mode in first benchmark to avoid mixing vision capability with prompt quality.

  - id: nemotron-3-ultra-free
    provider: opencode
    providerModel: opencode/nemotron-3-ultra-free
    inputMode: text
    notes: Do not send personal/confidential data.
```

Preflight:

```bash
opencode models --refresh
```

Policy:

```text
- Do not assume free models remain available.
- Store exact providerModel string.
- Store run date.
- Store opencode version.
- Store usage_status: observed/unavailable.
```
