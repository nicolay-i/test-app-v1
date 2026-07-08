import { spawn, type ChildProcess } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { runCommand, type CommandResult } from "./command.js";
import { ensureDir, pathExists } from "./fs.js";
import { collectMetrics, type MetricSnapshot } from "./metrics.js";

type CheckStatus = "passed" | "failed" | "skipped";

type BasicCheck = {
  status: CheckStatus;
  duration_ms: number;
  log_path?: string;
  message?: string;
};

export type EvaluationResult = {
  version_id: string;
  workspace_path: string;
  artifacts_path: string;
  status: CheckStatus;
  checks: {
    install: BasicCheck;
    build: BasicCheck;
    runtimeSmoke: BasicCheck;
  };
  metrics: MetricSnapshot;
};

export type EvaluateOptions = {
  workspacePath: string;
  taskId: string;
  versionId: string;
  artifactsPath: string;
  skipInstall?: boolean;
  installTimeoutMs?: number;
  buildTimeoutMs?: number;
  runtimeTimeoutMs?: number;
};

export async function evaluateWorkspace(options: EvaluateOptions): Promise<EvaluationResult> {
  await ensureDir(options.artifactsPath);

  const install = options.skipInstall
    ? skippedCheck("Install skipped by CLI option.")
    : commandCheck(
        await runCommand(
          "pnpm",
          ["install", "--frozen-lockfile=false"],
          options.workspacePath,
          path.join(options.artifactsPath, "install.log"),
          options.installTimeoutMs ?? 120000
        )
      );

  const build =
    install.status === "failed"
      ? skippedCheck("Build skipped because install failed.")
      : commandCheck(
          await runCommand(
            "pnpm",
            ["build"],
            options.workspacePath,
            path.join(options.artifactsPath, "build.log"),
            options.buildTimeoutMs ?? 120000
          )
        );

  const runtimeSmoke =
    build.status === "failed"
      ? skippedCheck("Runtime smoke skipped because build failed.")
      : await runRuntimeSmoke(options.workspacePath, options.artifactsPath, options.runtimeTimeoutMs ?? 60000);
  const metrics = await collectMetrics(options.workspacePath, options.versionId, options.artifactsPath);

  const result: EvaluationResult = {
    version_id: options.versionId,
    workspace_path: options.workspacePath,
    artifacts_path: options.artifactsPath,
    status: [install, build, runtimeSmoke].every((check) => check.status !== "failed") ? "passed" : "failed",
    checks: {
      install,
      build,
      runtimeSmoke
    },
    metrics
  };

  await writeFile(path.join(options.artifactsPath, "check-results.json"), JSON.stringify(result, null, 2), "utf8");
  return result;
}

function commandCheck(result: CommandResult): BasicCheck {
  return {
    status: result.exitCode === 0 ? "passed" : "failed",
    duration_ms: result.durationMs,
    log_path: result.logPath,
    ...(result.exitCode === 0 ? {} : { message: `Command exited with ${result.exitCode}` })
  };
}

function skippedCheck(message: string): BasicCheck {
  return {
    status: "skipped",
    duration_ms: 0,
    message
  };
}

async function runRuntimeSmoke(
  workspacePath: string,
  artifactsPath: string,
  timeoutMs: number
): Promise<BasicCheck> {
  const startedAt = Date.now();
  const logPath = path.join(artifactsPath, "runtime-smoke.log");
  let log = "";
  let server: ChildProcess | undefined;

  try {
    if (!(await pathExists(path.join(workspacePath, "package.json")))) {
      return {
        status: "failed",
        duration_ms: Date.now() - startedAt,
        log_path: logPath,
        message: "package.json not found"
      };
    }

    const port = 4173 + Math.floor(Math.random() * 1000);
    server = spawn("pnpm", ["dev", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: workspacePath,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    server.stdout?.on("data", (chunk: Buffer) => {
      log += chunk.toString("utf8");
    });
    server.stderr?.on("data", (chunk: Buffer) => {
      log += chunk.toString("utf8");
    });

    const url = `http://127.0.0.1:${port}/`;
    const responseText = await waitForHttp(url, timeoutMs);
    log += `\nFetched ${url}\n${responseText.slice(0, 500)}\n`;

    const passed = responseText.includes("<div id=\"root\">");
    return {
      status: passed ? "passed" : "failed",
      duration_ms: Date.now() - startedAt,
      log_path: logPath,
      ...(passed ? {} : { message: "Root element not found in HTML" })
    };
  } catch (error) {
    return {
      status: "failed",
      duration_ms: Date.now() - startedAt,
      log_path: logPath,
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
    await writeFile(logPath, log, "utf8");
  }
}

async function waitForHttp(url: string, timeoutMs: number): Promise<string> {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.text();
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Runtime server did not respond in ${timeoutMs}ms: ${lastError}`);
}
