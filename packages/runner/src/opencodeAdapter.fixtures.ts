import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runOpenCode } from "./opencodeAdapter.js";

export async function verifyOpenCodeRetryFixture(): Promise<string[]> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ape-opencode-retry-"));
  const binDir = path.join(root, "bin");
  const commandPath = path.join(binDir, "opencode");
  const counterPath = path.join(root, "attempt-count");
  const artifactsPath = path.join(root, "artifacts");
  const originalPath = process.env.PATH;
  const originalCounter = process.env.OPENCODE_RETRY_COUNTER;
  const failures: string[] = [];

  try {
    await mkdir(binDir, { recursive: true });
    await writeFile(
      commandPath,
      `#!/bin/sh
count=0
if [ -f "$OPENCODE_RETRY_COUNTER" ]; then count=$(cat "$OPENCODE_RETRY_COUNTER"); fi
count=$((count + 1))
printf '%s' "$count" > "$OPENCODE_RETRY_COUNTER"
if [ "$count" -eq 1 ]; then
  printf '{"type":"text.delta","text":"first attempt"}\\n'
  printf 'transient provider failure\\n' >&2
  exit 75
fi
printf '{"type":"text.delta","text":"second attempt"}\\n'
`,
      "utf8"
    );
    await chmod(commandPath, 0o755);
    process.env.PATH = `${binDir}${path.delimiter}${originalPath ?? ""}`;
    process.env.OPENCODE_RETRY_COUNTER = counterPath;

    const result = await runOpenCode({
      model: "fixture/model",
      cwd: root,
      prompt: "fixture",
      title: "retry-fixture",
      artifactsPath,
      maxAttempts: 2,
      timeoutMs: 5_000
    });
    const attempts = JSON.parse(await readFile(path.join(artifactsPath, "opencode-attempts.json"), "utf8")) as {
      max_attempts: number;
      attempts: Array<{ attempt: number; ok: boolean }>;
    };
    const stdout = await readFile(path.join(artifactsPath, "opencode.stdout.log"), "utf8");

    if (!result.ok || result.attempts.length !== 2) failures.push("result-attempt-count");
    if (result.attempts[0]?.ok !== false || result.attempts[1]?.ok !== true) failures.push("attempt-outcomes");
    if (attempts.max_attempts !== 2 || attempts.attempts.length !== 2) failures.push("attempt-manifest");
    if (result.parsed.assistantText !== "second attempt" || !stdout.includes("second attempt") || stdout.includes("first attempt")) failures.push("canonical-final-attempt");
    if ((await readFile(counterPath, "utf8")) !== "2") failures.push("command-invocations");
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalCounter === undefined) delete process.env.OPENCODE_RETRY_COUNTER;
    else process.env.OPENCODE_RETRY_COUNTER = originalCounter;
    await rm(root, { recursive: true, force: true });
  }

  return failures;
}
