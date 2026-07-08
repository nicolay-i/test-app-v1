# App Prompt Evolution Benchmark

Implementation workspace for the benchmark described in `specs/`.

## Commands

```bash
pnpm install
pnpm bench init
pnpm bench preflight --config configs/mvp.yaml
pnpm bench run-matrix --config configs/mvp.yaml --dry-run
```

The first slice implements the CLI foundation, config loading, matrix sizing and event logging.
