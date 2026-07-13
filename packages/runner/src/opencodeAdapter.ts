import { spawn } from "node:child_process";
import { copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";
import { parseOpenCodeEvents, type AgentUsage, type ParsedOpenCodeResult } from "./opencodeEventParser.js";

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
  failureClassification: "none" | "technical_interruption" | "agent_failure";
  exitCode: number | null;
  startedAt: string;
  endedAt: string;
  terminalStatus: string | null;
  usage: AgentUsage;
};

export type OpenCodeRunResult = {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  stdoutPath: string;
  stderrPath: string;
  eventsPath: string;
  resultPath: string;
  assistantResponsePath: string;
  parsed: ParsedOpenCodeResult;
  attempts: OpenCodeAttempt[];
  error?: string;
  failureClassification: "none" | "technical_interruption" | "agent_failure";
};

export async function runOpenCode(request: OpenCodeRunRequest): Promise<OpenCodeRunResult> {
  const maxAttempts = Math.max(1, request.maxAttempts ?? 2);
  const attempts: OpenCodeRunResult["attempts"] = [];
  let result: Omit<OpenCodeRunResult, "attempts"> | undefined;
  let previousSessionId: string | null = null;
  const parsedAttempts: ParsedOpenCodeResult[] = [];
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
      failureClassification: result.failureClassification,
      exitCode: result.exitCode,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      terminalStatus: result.parsed.finishStatus,
      usage: result.parsed.usage
    });
    parsedAttempts.push(result.parsed);
    previousSessionId = result.parsed.sessionId ?? previousSessionId;
    if (result.ok || result.failureClassification !== "technical_interruption" || attempt === maxAttempts) break;
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
  const aggregateUsage = aggregateAttemptUsage(parsedAttempts);
  const parsed = { ...result.parsed, usage: aggregateUsage };
  return {
    ...result,
    parsed,
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
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let timedOut = false;
  let spawnError = false;
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
    const child = spawnOpenCode(args, request.cwd, process.env);
    let settled = false;
    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(code);
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
      stderr += `\nTimed out after ${request.timeoutMs ?? 900000}ms\n`;
      // Windows PowerShell shims may never deliver close after their child is
      // terminated. A timeout is already a terminal technical interruption.
      finish(null);
    }, request.timeoutMs ?? 900000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      spawnError = true;
      stderr += `${error.message}\n`;
      finish(null);
    });
    child.on("close", (code) => {
      finish(code);
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
  const failureClassification = exitCode === 0 && parsed.streamStatus !== "invalid"
    ? "none"
    : isTechnicalInterruption({ stderr, timedOut, spawnError, streamStatus: parsed.streamStatus })
      ? "technical_interruption"
      : "agent_failure";

  return {
    ok: exitCode === 0 && parsed.streamStatus !== "invalid",
    exitCode,
    durationMs: Date.now() - startedAtMs,
    startedAt,
    endedAt: new Date().toISOString(),
    stdoutPath,
    stderrPath,
    eventsPath,
    resultPath,
    assistantResponsePath,
    parsed,
    failureClassification,
    ...(error ? { error } : {})
  };
}

function spawnOpenCode(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  if (process.platform === "win32") {
    // npm's OpenCode installation exposes a PowerShell shim; spawn("opencode")
    // cannot execute that shim from Node on Windows.
    return spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "& opencode @args", "--", ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env
    });
  }
  return spawn("opencode", args, { cwd, stdio: ["ignore", "pipe", "pipe"], env });
}

function terminateProcessTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (process.platform !== "win32") {
    child.kill("SIGTERM");
    return;
  }
  const taskkill = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  taskkill.once("error", () => child.kill("SIGTERM"));
}

function isTechnicalInterruption(options: { stderr: string; timedOut: boolean; spawnError: boolean; streamStatus: ParsedOpenCodeResult["streamStatus"] }): boolean {
  if (options.timedOut || options.spawnError || options.streamStatus === "invalid") return true;
  return /provider|network|econn|enotfound|timeout|timed out|rate limit|temporar(?:y|ily)|connection reset|socket hang up/i.test(options.stderr);
}

function aggregateAttemptUsage(parsedAttempts: ParsedOpenCodeResult[]): AgentUsage {
  const seenPartIds = new Set<string>();
  const usages: AgentUsage[] = [];
  for (const parsed of parsedAttempts) {
    if (parsed.stepUsageParts.length > 0) {
      for (const part of parsed.stepUsageParts) {
        if (seenPartIds.has(part.partId)) continue;
        seenPartIds.add(part.partId);
        usages.push(part.usage);
      }
    } else {
      usages.push(parsed.usage);
    }
  }
  if (usages.length === 0) return unavailableUsage();
  const complete = usages.every((usage) => usage.status === "complete");
  const numeric = (field: keyof Pick<AgentUsage, "inputTokens" | "outputTokens" | "reasoningTokens" | "cacheReadTokens" | "cacheWriteTokens" | "totalTokens" | "reportedCost">): number | null =>
    complete && usages.every((usage) => usage[field] !== null) ? usages.reduce((sum, usage) => sum + (usage[field] as number), 0) : null;
  return {
    status: complete ? "complete" : usages.some((usage) => usage.totalTokens !== null) ? "partial" : "unavailable",
    inputTokens: numeric("inputTokens"), outputTokens: numeric("outputTokens"), reasoningTokens: numeric("reasoningTokens"),
    cacheReadTokens: numeric("cacheReadTokens"), cacheWriteTokens: numeric("cacheWriteTokens"), totalTokens: numeric("totalTokens"),
    reportedCost: numeric("reportedCost"), currency: null, source: "events"
  };
}

function unavailableUsage(): AgentUsage {
  return { status: "unavailable", inputTokens: null, outputTokens: null, reasoningTokens: null, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: null, reportedCost: null, currency: null, source: "unavailable" };
}
