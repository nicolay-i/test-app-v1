import { spawn } from "node:child_process";
import { copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";
import { parseOpenCodeEvents, type ParsedOpenCodeResult } from "./opencodeEventParser.js";

export type OpenCodeRunRequest = {
  model: string;
  cwd: string;
  prompt: string;
  promptPath?: string;
  title: string;
  artifactsPath: string;
  format?: "json" | "default";
  autoApprove?: boolean;
  timeoutMs?: number;
  maxAttempts?: number;
  purpose?: "preflight" | "implementation" | "clarification" | "repair";
};

export type OpenCodeAttempt = {
  attempt: number;
  purpose: "preflight" | "implementation" | "clarification" | "repair" | "continuation";
  ok: boolean;
  durationMs: number;
  artifactsPath: string;
  sessionId: string | null;
  continuedSessionId: string | null;
  continuationFallback: boolean;
  failureClassification: "none" | "technical_interruption";
};

export type OpenCodeRunResult = {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  stdoutPath: string;
  stderrPath: string;
  eventsPath: string;
  resultPath: string;
  assistantResponsePath: string;
  parsed: ParsedOpenCodeResult;
  attempts: OpenCodeAttempt[];
  error?: string;
};

export async function runOpenCode(request: OpenCodeRunRequest): Promise<OpenCodeRunResult> {
  const maxAttempts = Math.max(1, request.maxAttempts ?? 2);
  const attempts: OpenCodeRunResult["attempts"] = [];
  let result: Omit<OpenCodeRunResult, "attempts"> | undefined;
  let previousSessionId: string | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const artifactsPath = path.join(request.artifactsPath, "opencode-attempts", `attempt-${attempt}`);
    const continuation = attempt > 1;
    const continuedSessionId = continuation ? previousSessionId : null;
    const { promptPath: _promptPath, ...requestWithoutPromptPath } = request;
    result = await runSingleOpenCode({
      ...(continuation ? requestWithoutPromptPath : request),
      artifactsPath,
      ...(continuation
        ? {
            prompt: "Continue the current task from where it stopped.",
            sessionId: continuedSessionId,
            continuation
          }
        : {})
    });
    attempts.push({
      attempt,
      purpose: continuation ? "continuation" : request.purpose ?? "implementation",
      ok: result.ok,
      durationMs: result.durationMs,
      artifactsPath,
      sessionId: result.parsed.sessionId,
      continuedSessionId,
      continuationFallback: continuation && continuedSessionId === null,
      failureClassification: result.ok ? "none" : "technical_interruption"
    });
    previousSessionId = result.parsed.sessionId ?? previousSessionId;
    if (result.ok || attempt === maxAttempts) break;
  }
  if (!result) throw new Error("OpenCode attempt was not started");
  await ensureDir(request.artifactsPath);
  await Promise.all([
    copyFile(result.stdoutPath, path.join(request.artifactsPath, "opencode.stdout.log")),
    copyFile(result.stderrPath, path.join(request.artifactsPath, "opencode.stderr.log")),
    copyFile(result.eventsPath, path.join(request.artifactsPath, "opencode.events.jsonl")),
    copyFile(result.resultPath, path.join(request.artifactsPath, "opencode-result.json")),
    copyFile(result.assistantResponsePath, path.join(request.artifactsPath, "assistant-response.md"))
  ]);
  await writeFile(path.join(request.artifactsPath, "opencode-attempts.json"), JSON.stringify({ max_attempts: maxAttempts, attempts }, null, 2), "utf8");
  return {
    ...result,
    stdoutPath: path.join(request.artifactsPath, "opencode.stdout.log"),
    stderrPath: path.join(request.artifactsPath, "opencode.stderr.log"),
    eventsPath: path.join(request.artifactsPath, "opencode.events.jsonl"),
    resultPath: path.join(request.artifactsPath, "opencode-result.json"),
    assistantResponsePath: path.join(request.artifactsPath, "assistant-response.md"),
    attempts
  };
}

async function runSingleOpenCode(request: OpenCodeRunRequest & { sessionId?: string | null; continuation?: boolean }): Promise<Omit<OpenCodeRunResult, "attempts">> {
  await ensureDir(request.artifactsPath);

  const stdoutPath = path.join(request.artifactsPath, "opencode.stdout.log");
  const stderrPath = path.join(request.artifactsPath, "opencode.stderr.log");
  const eventsPath = path.join(request.artifactsPath, "opencode.events.jsonl");
  const startedAt = Date.now();
  const args = [
    "run",
    "--model",
    request.model,
    "--dir",
    request.cwd,
    "--format",
    request.format ?? "json",
    "--title",
    request.title
  ];

  if (request.sessionId) {
    args.push("--session", request.sessionId);
  }

  if (request.autoApprove ?? true) {
    args.push("--auto");
  }

  args.push(
    request.continuation
      ? request.prompt
      : request.purpose === "preflight" || request.purpose === "clarification"
        ? "Read the attached benchmark prompt and follow its instructions exactly."
        : "Read the attached benchmark prompt and implement the requested app."
  );

  if (request.promptPath) {
    args.push("--file", request.promptPath);
  }

  let stdout = "";
  let stderr = "";

  const exitCode = await new Promise<number | null>((resolve) => {
    const child = spawn("opencode", args, {
      cwd: request.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += `\nTimed out after ${request.timeoutMs ?? 900000}ms\n`;
    }, request.timeoutMs ?? 900000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      clearTimeout(timeout);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  await writeFile(stdoutPath, stdout, "utf8");
  await writeFile(stderrPath, stderr, "utf8");
  // OpenCode emits NDJSON. Preserve it verbatim so malformed lines remain auditable.
  await writeFile(eventsPath, stdout, "utf8");
  const parsed = parseOpenCodeEvents(stdout);
  const resultPath = path.join(request.artifactsPath, "opencode-result.json");
  const assistantResponsePath = path.join(request.artifactsPath, "assistant-response.md");
  await writeFile(resultPath, JSON.stringify(parsed, null, 2), "utf8");
  await writeFile(assistantResponsePath, parsed.assistantText, "utf8");

  const error = exitCode === 0 ? undefined : stderr.trim().split(/\r?\n/).slice(-5).join("\n");

  return {
    ok: exitCode === 0,
    exitCode,
    durationMs: Date.now() - startedAt,
    stdoutPath,
    stderrPath,
    eventsPath,
    resultPath,
    assistantResponsePath,
    parsed,
    ...(error ? { error } : {})
  };
}
