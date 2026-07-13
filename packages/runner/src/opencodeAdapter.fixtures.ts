import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runOpenCode } from "./opencodeAdapter.js";

export async function verifyOpenCodeRetryFixture(): Promise<string[]> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ape-opencode-retry-"));
  const binDir = path.join(root, "bin");
  const commandPath = path.join(binDir, "opencode.ps1");
  const counterPath = path.join(root, "attempt-count");
  const argumentsPath = path.join(root, "attempt-arguments");
  const artifactsPath = path.join(root, "artifacts");
  const originalPath = process.env.PATH;
  const originalCounter = process.env.OPENCODE_RETRY_COUNTER;
  const originalArguments = process.env.OPENCODE_RETRY_ARGUMENTS;
  const originalMode = process.env.OPENCODE_RETRY_MODE;
  const failures: string[] = [];

  try {
    await mkdir(binDir, { recursive: true });
    await writeFile(
      commandPath,
      `$count = if (Test-Path $env:OPENCODE_RETRY_COUNTER) { [int](Get-Content -Raw $env:OPENCODE_RETRY_COUNTER) } else { 0 }
$count += 1
 [System.IO.File]::WriteAllText($env:OPENCODE_RETRY_COUNTER, "$count")
$args -join ' ' | Add-Content $env:OPENCODE_RETRY_ARGUMENTS
if ($env:OPENCODE_RETRY_MODE -eq 'model') {
  Write-Output '{"type":"text.delta","text":"cannot comply"}'
  [Console]::Error.WriteLine('invalid benchmark request')
  exit 42
}
if ($env:OPENCODE_RETRY_MODE -eq 'timeout') {
  Start-Sleep -Seconds 2
  exit 0
}
if ($count -eq 1) {
  Write-Output '{"type":"text.delta","text":"first attempt","sessionId":"session-1"}'
  Write-Output '{"type":"step_finish","part":{"id":"step-1","tokens":{"input":1,"output":2,"reasoning":0,"cache":{"read":3,"write":0}},"cost":0}}'
  [Console]::Error.WriteLine('transient provider failure')
  exit 75
}
Write-Output '{"type":"text.delta","text":"second attempt"}'
Write-Output '{"type":"step_finish","part":{"id":"step-2","tokens":{"input":4,"output":5,"reasoning":0,"cache":{"read":6,"write":0}},"cost":0}}'
`,
      "utf8"
    );
    await chmod(commandPath, 0o755);
    process.env.PATH = `${binDir}${path.delimiter}${originalPath ?? ""}`;
    process.env.OPENCODE_RETRY_COUNTER = counterPath;
    process.env.OPENCODE_RETRY_ARGUMENTS = argumentsPath;

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
      attempts: Array<{ attempt: number; ok: boolean; purpose: string; continuedSessionId: string | null; continuationFallback: boolean }>;
    };
    const stdout = await readFile(path.join(artifactsPath, "opencode.stdout.log"), "utf8");

    if (!result.ok || result.attempts.length !== 2) failures.push("result-attempt-count");
    if (result.attempts[0]?.ok !== false || result.attempts[1]?.ok !== true) failures.push("attempt-outcomes");
    if (attempts.max_attempts !== 2 || attempts.attempts.length !== 2) failures.push("attempt-manifest");
    if (attempts.attempts[1]?.purpose !== "continuation" || attempts.attempts[1]?.continuedSessionId !== "session-1" || attempts.attempts[1]?.continuationFallback) failures.push("same-session-continuation");
    if (result.parsed.assistantText !== "second attempt" || !stdout.includes("second attempt") || stdout.includes("first attempt")) failures.push("canonical-final-attempt");
    if (result.parsed.usage.totalTokens !== 21 || result.attempts[0]?.usage.totalTokens !== 6 || result.attempts[1]?.usage.totalTokens !== 15) failures.push("aggregate-attempt-usage");
    if ((await readFile(counterPath, "utf8")) !== "2") failures.push("command-invocations");
    const invocationArguments = (await readFile(argumentsPath, "utf8")).split(/\r?\n/).filter(Boolean);
    if (!invocationArguments.some((value) => value.includes("--session") && value.includes("session-1"))) failures.push("continuation-command");
    await writeFile(counterPath, "0", "utf8");
    process.env.OPENCODE_RETRY_MODE = "model";
    const modelFailure = await runOpenCode({ model: "fixture/model", cwd: root, prompt: "fixture", title: "no-retry-fixture", artifactsPath: path.join(root, "model-failure"), maxAttempts: 2, timeoutMs: 5_000 });
    if (modelFailure.attempts.length !== 1 || modelFailure.failureClassification !== "agent_failure") failures.push("do-not-retry-agent-failure");
    process.env.OPENCODE_RETRY_MODE = "timeout";
    const timeoutStartedAt = Date.now();
    const timeoutFailure = await runOpenCode({ model: "fixture/model", cwd: root, prompt: "fixture", title: "timeout-fixture", artifactsPath: path.join(root, "timeout-failure"), maxAttempts: 1, timeoutMs: 50 });
    if (timeoutFailure.failureClassification !== "technical_interruption" || timeoutFailure.attempts.length !== 1 || Date.now() - timeoutStartedAt > 1_500) failures.push("timeout-returns-terminal-result");
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalCounter === undefined) delete process.env.OPENCODE_RETRY_COUNTER;
    else process.env.OPENCODE_RETRY_COUNTER = originalCounter;
    if (originalArguments === undefined) delete process.env.OPENCODE_RETRY_ARGUMENTS;
    else process.env.OPENCODE_RETRY_ARGUMENTS = originalArguments;
    if (originalMode === undefined) delete process.env.OPENCODE_RETRY_MODE;
    else process.env.OPENCODE_RETRY_MODE = originalMode;
    await rm(root, { recursive: true, force: true }).catch(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await rm(root, { recursive: true, force: true });
    });
  }

  return failures;
}
