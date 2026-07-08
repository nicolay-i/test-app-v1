#!/usr/bin/env node
import { execFile } from "node:child_process";
import { cpus } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { loadMatrixConfig } from "./config.js";
import { EventLogger } from "./events.js";
import { evaluateWorkspace } from "./evaluator.js";
import { ensureDir, pathExists, resolveFromRoot, writeFileIfMissing } from "./fs.js";
import { buildTrajectoryPlan } from "./matrix.js";
import {
  defaultWeights,
  exampleAcceptanceCriteria,
  exampleExpectedValues,
  exampleSemanticUi,
  exampleSpec,
  exampleTaskYaml,
  mvpConfig,
  scaffoldIndexHtml,
  scaffoldMain,
  scaffoldPackageJson,
  scaffoldStyles,
  scaffoldTsconfig,
  todoMvcAcceptanceCriteria,
  todoMvcE2eSpec,
  todoMvcExpectedValues,
  todoMvcSemanticUi,
  todoMvcSpec,
  todoMvcTaskYaml,
  todoMvcValuesSpec,
  todoMvcVisualSpec
} from "./templates.js";
import { validateTaskWithPathChecks } from "./task.js";

const execFileAsync = promisify(execFile);

type CliArgs = {
  command: string | undefined;
  options: Map<string, string | boolean>;
  positionals: string[];
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  try {
    switch (args.command) {
      case "init":
        await initCommand();
        break;
      case "preflight":
        await preflightCommand(args);
        break;
      case "validate-task":
        await validateTaskCommand(args);
        break;
      case "eval":
        await evalCommand(args);
        break;
      case "run-matrix":
        await runMatrixCommand(args);
        break;
      case "help":
      case undefined:
        printHelp();
        break;
      default:
        throw new Error(`Unknown command "${args.command}"`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`bench: ${message}`);
    process.exitCode = 1;
  }
}

async function initCommand(): Promise<void> {
  const rootDir = process.cwd();
  const files = [
    ["configs/mvp.yaml", mvpConfig],
    ["tasks/_example/task.yaml", exampleTaskYaml],
    ["tasks/_example/reference/spec.md", exampleSpec],
    ["tasks/_example/reference/acceptance-criteria.md", exampleAcceptanceCriteria],
    ["tasks/_example/reference/semantic-ui.xml", exampleSemanticUi],
    ["tasks/_example/reference/expected-values.json", exampleExpectedValues],
    ["tasks/_example/scoring/weights.yaml", defaultWeights],
    ["tasks/todomvc/task.yaml", todoMvcTaskYaml],
    ["tasks/todomvc/reference/spec.md", todoMvcSpec],
    ["tasks/todomvc/reference/acceptance-criteria.md", todoMvcAcceptanceCriteria],
    ["tasks/todomvc/reference/semantic-ui.xml", todoMvcSemanticUi],
    ["tasks/todomvc/reference/expected-values.json", todoMvcExpectedValues],
    ["tasks/todomvc/tests/base/e2e.spec.ts", todoMvcE2eSpec],
    ["tasks/todomvc/tests/base/values.spec.ts", todoMvcValuesSpec],
    ["tasks/todomvc/tests/base/visual.spec.ts", todoMvcVisualSpec],
    ["tasks/todomvc/scoring/weights.yaml", defaultWeights],
    ["scaffolds/vite-react-ts/package.json", scaffoldPackageJson],
    ["scaffolds/vite-react-ts/index.html", scaffoldIndexHtml],
    ["scaffolds/vite-react-ts/src/main.tsx", scaffoldMain],
    ["scaffolds/vite-react-ts/src/styles.css", scaffoldStyles],
    ["scaffolds/vite-react-ts/tsconfig.json", scaffoldTsconfig],
    ["runs/.gitkeep", ""]
  ] as const;

  let created = 0;
  for (const [relativePath, content] of files) {
    const didCreate = await writeFileIfMissing(path.join(rootDir, relativePath), content);
    if (didCreate) {
      created += 1;
      console.log(`created ${relativePath}`);
    } else {
      console.log(`exists  ${relativePath}`);
    }
  }

  console.log(`init complete: ${created} file(s) created`);
}

async function validateTaskCommand(args: CliArgs): Promise<void> {
  const taskPath = args.positionals[0];
  if (!taskPath) {
    throw new Error("validate-task requires a task directory path");
  }

  const result = await validateTaskWithPathChecks(resolveFromRoot(process.cwd(), taskPath));
  printTaskValidation(result);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function evalCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const workspacePath = resolveFromRoot(rootDir, stringOption(args, "workspace", "scaffolds/vite-react-ts"));
  const taskId = stringOption(args, "task", "todomvc");
  const versionId = stringOption(args, "version", "v0");
  const artifactsPath = resolveFromRoot(
    rootDir,
    stringOption(args, "artifacts", `runs/local-eval/artifacts/${taskId}/${versionId}`)
  );
  const skipInstall = booleanOption(args, "skip-install", false);

  const result = await evaluateWorkspace({
    workspacePath,
    taskId,
    versionId,
    artifactsPath,
    skipInstall
  });

  console.log(`eval ${result.status}`);
  console.log(`install: ${result.checks.install.status}`);
  console.log(`build: ${result.checks.build.status}`);
  console.log(`runtimeSmoke: ${result.checks.runtimeSmoke.status}`);
  console.log(`artifacts: ${artifactsPath}`);

  if (result.status === "failed") {
    process.exitCode = 1;
  }
}

async function preflightCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml"));
  const config = await loadMatrixConfig(configPath);
  const runDir = path.join(rootDir, config.outputDir, config.id);
  const logger = new EventLogger(runDir, config.id);

  await logger.write({
    level: "info",
    phase: "preflight",
    event: "started",
    data: { configPath }
  });

  const scaffoldPath = resolveFromRoot(rootDir, config.scaffold.path);
  const checks = [
    await checkCommand("node", ["--version"]),
    await checkCommand("pnpm", ["--version"]),
    await checkCommand("git", ["--version"]),
    await checkCommand("opencode", ["--version"], true),
    await checkCommand("pnpm", ["--dir", scaffoldPath, "exec", "playwright", "--version"], true)
  ];

  const scaffoldExists = await pathExists(scaffoldPath);
  const taskResults = await Promise.all(
    config.tasks.map((taskId) => validateTaskWithPathChecks(path.join(rootDir, "tasks", taskId)))
  );
  const outputDir = resolveFromRoot(rootDir, config.outputDir);
  await ensureDir(outputDir);

  const plan = buildTrajectoryPlan(config);

  for (const check of checks) {
    const status = check.ok ? "ok" : check.optional ? "missing optional" : "missing";
    console.log(`${status.padEnd(16)} ${check.label}${check.output ? ` ${check.output}` : ""}`);
  }

  console.log(`${scaffoldExists ? "ok" : "missing"}             scaffold ${config.scaffold.path}`);
  for (const taskResult of taskResults) {
    console.log(`${taskResult.ok ? "ok" : "invalid"}             task ${taskResult.taskId}`);
  }
  console.log(`ok               output ${config.outputDir}`);
  console.log(`matrix           ${plan.length} trajectories, ${plan.length * (config.maxVersions + 1)} version steps`);
  console.log(`host             ${cpus().length} CPU cores detected, configured concurrency ${config.concurrency}`);

  const hardFailures = checks.filter((check) => !check.ok && !check.optional);
  if (!scaffoldExists) {
    hardFailures.push({ label: "scaffold", ok: false, optional: false, output: config.scaffold.path });
  }
  for (const taskResult of taskResults) {
    if (!taskResult.ok) {
      hardFailures.push({
        label: `task:${taskResult.taskId}`,
        ok: false,
        optional: false,
        output: taskResult.errors.join("; ")
      });
    }
  }

  await logger.write({
    level: hardFailures.length === 0 ? "info" : "error",
    phase: "preflight",
    event: hardFailures.length === 0 ? "passed" : "failed",
    data: {
      hardFailures: hardFailures.map((failure) => failure.label),
      trajectories: plan.length,
      versionSteps: plan.length * (config.maxVersions + 1)
    }
  });

  if (hardFailures.length > 0) {
    throw new Error(`Preflight failed: ${hardFailures.map((failure) => failure.label).join(", ")}`);
  }
}

function printTaskValidation(result: Awaited<ReturnType<typeof validateTaskWithPathChecks>>): void {
  console.log(`${result.ok ? "ok" : "invalid"} task ${result.taskId}`);

  for (const error of result.errors) {
    console.log(`error: ${error}`);
  }

  for (const warning of result.warnings) {
    console.log(`warn: ${warning}`);
  }
}

async function runMatrixCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml"));
  const dryRun = booleanOption(args, "dry-run", false);
  const config = await loadMatrixConfig(configPath);
  const runDir = path.join(rootDir, config.outputDir, config.id);
  const logger = new EventLogger(runDir, config.id);
  const plan = buildTrajectoryPlan(config);

  await logger.write({
    level: "info",
    phase: "run_matrix",
    event: dryRun ? "dry_run_started" : "started",
    data: {
      trajectories: plan.length,
      versionsPerTrajectory: config.maxVersions + 1
    }
  });

  console.log(`matrix id: ${config.id}`);
  console.log(`trajectories: ${plan.length}`);
  console.log(`version steps: ${plan.length * (config.maxVersions + 1)}`);
  console.log(`concurrency: ${config.concurrency}`);

  for (const [index, trajectory] of plan.slice(0, 10).entries()) {
    console.log(
      `[${index + 1}/${plan.length}] ${trajectory.taskId} ${trajectory.modelId} ` +
        `${trajectory.systemPromptId} ${trajectory.userPromptId} ${trajectory.editPromptId} r${trajectory.runNumber}`
    );
  }

  if (plan.length > 10) {
    console.log(`... ${plan.length - 10} more trajectories`);
  }

  if (!dryRun) {
    throw new Error("run-matrix execution is not implemented yet. Use --dry-run for this slice.");
  }

  await logger.write({
    level: "info",
    phase: "run_matrix",
    event: "dry_run_completed",
    data: {
      firstTrajectory: plan[0]?.trajectoryId ?? null
    }
  });
}

async function checkCommand(
  command: string,
  args: string[],
  optional = false
): Promise<{ label: string; ok: boolean; optional: boolean; output: string }> {
  const label = [command, ...args].join(" ");

  try {
    const result = await execFileAsync(command, args, {
      timeout: 30000,
      cwd: process.cwd()
    });
    return {
      label,
      ok: true,
      optional,
      output: result.stdout.trim().split(/\r?\n/)[0] ?? ""
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      label,
      ok: false,
      optional,
      output: message
    };
  }
}

function parseArgs(rawArgs: string[]): CliArgs {
  const [command, ...rest] = rawArgs;
  const options = new Map<string, string | boolean>();
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    const inlineSeparator = withoutPrefix.indexOf("=");
    if (inlineSeparator !== -1) {
      options.set(withoutPrefix.slice(0, inlineSeparator), withoutPrefix.slice(inlineSeparator + 1));
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      options.set(withoutPrefix, next);
      index += 1;
      continue;
    }

    options.set(withoutPrefix, true);
  }

  return {
    command,
    options,
    positionals
  };
}

function stringOption(args: CliArgs, key: string, fallback: string): string {
  const value = args.options.get(key);
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string") {
    throw new Error(`--${key} requires a value`);
  }
  return value;
}

function booleanOption(args: CliArgs, key: string, fallback: boolean): boolean {
  const value = args.options.get(key);
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return value === "true";
}

function printHelp(): void {
  console.log(`Usage:
  pnpm bench init
  pnpm bench validate-task tasks/todomvc
  pnpm bench preflight --config configs/mvp.yaml
  pnpm bench eval --workspace scaffolds/vite-react-ts --task todomvc --version v0
  pnpm bench run-matrix --config configs/mvp.yaml --dry-run
`);
}

await main();
