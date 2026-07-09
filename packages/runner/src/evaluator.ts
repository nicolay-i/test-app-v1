import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { runCommand, type CommandResult } from "./command.js";
import { ensureDir, pathExists } from "./fs.js";
import { collectMetrics, type MetricSnapshot } from "./metrics.js";
import { parseSimpleYaml } from "./simpleYaml.js";

type CheckStatus = "passed" | "failed" | "skipped";

type BasicCheck = {
  status: CheckStatus;
  duration_ms: number;
  log_path?: string;
  message?: string;
  passed?: number;
  failed?: number;
  total?: number;
  report_path?: string;
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
    e2e: BasicCheck;
    values: BasicCheck;
    visual: BasicCheck;
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
  playwrightTimeoutMs?: number;
};

export async function evaluateWorkspace(options: EvaluateOptions): Promise<EvaluationResult> {
  await ensureDir(options.artifactsPath);

  const install = options.skipInstall
    ? skippedCheck("Install skipped by CLI option.")
    : commandCheck(
        await runCommand(
          "pnpm",
          ["install", "--frozen-lockfile=false", "--config.dangerouslyAllowAllBuilds=true"],
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
    build.status !== "passed"
      ? skippedCheck("Runtime smoke skipped because build did not pass.")
      : await runRuntimeSmoke(options.workspacePath, options.artifactsPath, options.runtimeTimeoutMs ?? 60000);
  const taskChecks = await loadTaskChecks(process.cwd(), options.taskId);
  const e2e =
    runtimeSmoke.status !== "passed"
      ? skippedCheck("E2E skipped because runtime smoke did not pass.")
      : await runPlaywrightCheck({
          workspacePath: options.workspacePath,
          artifactsPath: options.artifactsPath,
          category: "e2e",
          testPaths: taskChecks.e2e,
          timeoutMs: options.playwrightTimeoutMs ?? 120000
        });
  const values =
    runtimeSmoke.status !== "passed"
      ? skippedCheck("Value checks skipped because runtime smoke did not pass.")
      : await runPlaywrightCheck({
          workspacePath: options.workspacePath,
          artifactsPath: options.artifactsPath,
          category: "values",
          testPaths: taskChecks.values,
          timeoutMs: options.playwrightTimeoutMs ?? 120000
        });
  const visual =
    runtimeSmoke.status !== "passed"
      ? skippedCheck("Visual checks skipped because runtime smoke did not pass.")
      : await runPlaywrightCheck({
          workspacePath: options.workspacePath,
          artifactsPath: options.artifactsPath,
          category: "visual",
          testPaths: taskChecks.visual,
          timeoutMs: options.playwrightTimeoutMs ?? 120000
        });
  const metrics = await collectMetrics(options.workspacePath, options.versionId, options.artifactsPath);

  const result: EvaluationResult = {
    version_id: options.versionId,
    workspace_path: options.workspacePath,
    artifacts_path: options.artifactsPath,
    status: [install, build, runtimeSmoke, e2e, values, visual].every((check) => check.status !== "failed")
      ? "passed"
      : "failed",
    checks: {
      install,
      build,
      runtimeSmoke,
      e2e,
      values,
      visual
    },
    metrics
  };

  await writeFile(path.join(options.artifactsPath, "check-results.json"), JSON.stringify(result, null, 2), "utf8");
  return result;
}

type TaskChecks = {
  e2e: string[];
  values: string[];
  visual: string[];
};

async function loadTaskChecks(rootDir: string, taskId: string): Promise<TaskChecks> {
  const taskDir = path.join(rootDir, "tasks", taskId);
  const taskYaml = parseSimpleYaml(await readFile(path.join(taskDir, "task.yaml"), "utf8"));
  const checks = asRecord(taskYaml.checks);

  return {
    e2e: readPathArray(checks.e2e).map((item) => path.join(taskDir, item)),
    values: readPathArray(checks.values).map((item) => path.join(taskDir, item)),
    visual: readPathArray(checks.visual).map((item) => path.join(taskDir, item))
  };
}

function readPathArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
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

async function runPlaywrightCheck(options: {
  workspacePath: string;
  artifactsPath: string;
  category: "e2e" | "values" | "visual";
  testPaths: string[];
  timeoutMs: number;
}): Promise<BasicCheck> {
  if (options.testPaths.length === 0) {
    return skippedCheck(`No ${options.category} tests configured.`);
  }

  const startedAt = Date.now();
  const categoryDir = path.join(options.artifactsPath, options.category);
  const workspaceTestDir = path.join(options.workspacePath, ".ape-tests", options.category);
  const reportPath = path.join(categoryDir, "results.json");
  const configPath = path.join(categoryDir, "playwright.config.cjs");
  const serverLogPath = path.join(categoryDir, "dev-server.log");
  await ensureDir(categoryDir);
  await mkdir(workspaceTestDir, { recursive: true });
  const workspaceTestFiles = await copyTestsIntoWorkspace(options.testPaths, workspaceTestDir);

  let serverLog = "";
  let server: ChildProcess | undefined;

  try {
    const port = 5200 + Math.floor(Math.random() * 1000);
    const baseURL = `http://127.0.0.1:${port}`;
    server = spawn("pnpm", ["dev", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: options.workspacePath,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    server.stdout?.on("data", (chunk: Buffer) => {
      serverLog += chunk.toString("utf8");
    });
    server.stderr?.on("data", (chunk: Buffer) => {
      serverLog += chunk.toString("utf8");
    });

    await waitForHttp(baseURL, 60000);
    await writeFile(
      configPath,
      [
        "module.exports = {",
        `  testDir: ${JSON.stringify(workspaceTestDir)},`,
        `  testMatch: ${JSON.stringify(workspaceTestFiles.map((item) => path.basename(item)))},`,
        "  timeout: 12000,",
        "  expect: { timeout: 5000 },",
        "  workers: 1,",
        `  outputDir: ${JSON.stringify(path.join(categoryDir, "test-results"))},`,
        `  reporter: [["json", { outputFile: ${JSON.stringify(reportPath)} }]],`,
        `  use: { baseURL: ${JSON.stringify(baseURL)}, actionTimeout: 5000, screenshot: "only-on-failure", trace: "retain-on-failure" }`,
        "};",
        ""
      ].join("\n"),
      "utf8"
    );

    const command = await runCommand(
      "pnpm",
      ["exec", "playwright", "test", "--config", configPath],
      options.workspacePath,
      path.join(categoryDir, "playwright.log"),
      options.timeoutMs
    );
    const summary = await readPlaywrightSummary(reportPath);

    return {
      status: command.exitCode === 0 ? "passed" : "failed",
      duration_ms: Date.now() - startedAt,
      log_path: command.logPath,
      report_path: reportPath,
      passed: summary.passed,
      failed: summary.failed,
      total: summary.total,
      ...(command.exitCode === 0 ? {} : { message: `Playwright ${options.category} exited with ${command.exitCode}` })
    };
  } catch (error) {
    return {
      status: "failed",
      duration_ms: Date.now() - startedAt,
      log_path: path.join(categoryDir, "playwright.log"),
      report_path: reportPath,
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
    await rm(workspaceTestDir, { recursive: true, force: true });
    await writeFile(serverLogPath, serverLog, "utf8");
  }
}

async function copyTestsIntoWorkspace(testPaths: string[], workspaceTestDir: string): Promise<string[]> {
  const copied: string[] = [];
  for (const testPath of testPaths) {
    const destination = path.join(workspaceTestDir, path.basename(testPath));
    await writeFile(destination, await readFile(testPath, "utf8"), "utf8");
    copied.push(destination);
  }
  return copied;
}

async function readPlaywrightSummary(reportPath: string): Promise<{ passed: number; failed: number; total: number }> {
  try {
    const parsed = JSON.parse(await readFile(reportPath, "utf8")) as {
      stats?: {
        expected?: number;
        unexpected?: number;
        flaky?: number;
        skipped?: number;
      };
    };
    const passed = parsed.stats?.expected ?? 0;
    const failed = parsed.stats?.unexpected ?? 0;
    const skipped = parsed.stats?.skipped ?? 0;
    const flaky = parsed.stats?.flaky ?? 0;

    return {
      passed,
      failed,
      total: passed + failed + skipped + flaky
    };
  } catch {
    return {
      passed: 0,
      failed: 1,
      total: 1
    };
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
