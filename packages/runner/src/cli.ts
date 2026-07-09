#!/usr/bin/env node
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { aggregateRun } from "./aggregation.js";
import { loadMatrixConfig } from "./config.js";
import { EventLogger } from "./events.js";
import { evaluateWorkspace, type EvaluationResult } from "./evaluator.js";
import { ensureDir, pathExists, resolveFromRoot, writeFileIfMissing } from "./fs.js";
import { exportJuryPacket, importJuryReview } from "./juryPacket.js";
import { buildTrajectoryPlan } from "./matrix.js";
import { writeMockTodoMvc, type MockTodoMvcVariant } from "./mockGenerator.js";
import {
  buildNegotiatedImplementationPrompt,
  loadNegotiationScenario,
  runNegotiationPreflight,
  scenarioEvolutionStepIndex
} from "./negotiation.js";
import { runOpenCode, type OpenCodeRunResult } from "./opencodeAdapter.js";
import { compileEditPrompt, compileRepairPrompt, compileV0Prompt } from "./promptCompiler.js";
import { scoreV0, type VersionScore } from "./scoring.js";
import { loadTaskEvolution } from "./task.js";
import {
  buildFailureSummary,
  buildInitialRunMetadata,
  writeFailureSummary,
  writeTrajectoryArtifacts,
  writeRepairSummary,
  writeRunMetadata,
  writeRunReport,
  buildTrajectorySummary,
  readDiffMetrics,
  type RunMetadata,
  type RunType,
  type TrajectoryVersionSummary
} from "./artifacts.js";
import {
  defaultWeights,
  editPromptE2,
  exampleAcceptanceCriteria,
  exampleExpectedValues,
  exampleSemanticUi,
  exampleSpec,
  exampleTaskYaml,
  mvpConfig,
  scaffoldIndexHtml,
  scaffoldGitignore,
  scaffoldMain,
  scaffoldPackageJson,
  scaffoldStyles,
  scaffoldTsconfig,
  systemPromptS2,
  todoMvcAcceptanceCriteria,
  todoMvcE2eSpec,
  todoMvcEvolutionDueDatesPrompt,
  todoMvcEvolutionDueDatesSpec,
  todoMvcEvolutionRemoveTagsPrompt,
  todoMvcEvolutionRemoveTagsSpec,
  todoMvcEvolutionSearchPrompt,
  todoMvcEvolutionSearchSpec,
  todoMvcEvolutionTagsPrompt,
  todoMvcEvolutionTagsSpec,
  todoMvcExpectedValues,
  todoMvcSemanticUi,
  todoMvcSpec,
  todoMvcTaskYaml,
  todoMvcValuesSpec,
  todoMvcVisualSpec,
  userPromptU1,
  userPromptU3,
  userPromptU5
} from "./templates.js";
import { validateTaskWithPathChecks } from "./task.js";
import type { MatrixConfig, TrajectoryPlan } from "./types.js";
import { captureGitDiff, commitWorkspaceVersion, prepareWorkspace } from "./workspace.js";

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
      case "run-one":
        await runOneCommand(args);
        break;
      case "run-matrix":
        await runMatrixCommand(args);
        break;
      case "aggregate":
        await aggregateCommand(args);
        break;
      case "negotiate-one":
        await negotiateOneCommand(args);
        break;
      case "export-jury-packet":
        await exportJuryPacketCommand(args);
        break;
      case "import-jury-review":
        await importJuryReviewCommand(args);
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
    ["tasks/todomvc/evolution/01-add-due-dates.md", todoMvcEvolutionDueDatesPrompt],
    ["tasks/todomvc/evolution/02-add-search.md", todoMvcEvolutionSearchPrompt],
    ["tasks/todomvc/evolution/03-add-tags.md", todoMvcEvolutionTagsPrompt],
    ["tasks/todomvc/evolution/04-remove-tags.md", todoMvcEvolutionRemoveTagsPrompt],
    ["tasks/todomvc/tests/evolution/01-due-dates.spec.ts", todoMvcEvolutionDueDatesSpec],
    ["tasks/todomvc/tests/evolution/02-search.spec.ts", todoMvcEvolutionSearchSpec],
    ["tasks/todomvc/tests/evolution/03-tags.spec.ts", todoMvcEvolutionTagsSpec],
    ["tasks/todomvc/tests/evolution/04-remove-tags.spec.ts", todoMvcEvolutionRemoveTagsSpec],
    ["tasks/todomvc/scoring/weights.yaml", defaultWeights],
    ["prompts/system/S2-maintainable-simple.md", systemPromptS2],
    ["prompts/user/U1-structured.md", userPromptU1],
    ["prompts/user/U3-semantic-ui.md", userPromptU3],
    ["prompts/user/U5-maintainable.md", userPromptU5],
    ["prompts/edit/E2-smallest-maintainable-change.md", editPromptE2],
    ["scaffolds/vite-react-ts/.gitignore", scaffoldGitignore],
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

async function runOneCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml"));
  const config = await loadMatrixConfig(configPath);
  const dryRun = booleanOption(args, "dry-run", false);
  const mockOpenCode = booleanOption(args, "mock-opencode", false);
  const runType = readRunType(args, mockOpenCode);
  const useMockOpenCode = mockOpenCode || runType === "mock";
  const requestedVersions = numberOption(args, "versions", 0);
  const skipInstall = booleanOption(args, "skip-install", false);
  const selected = selectTrajectory(config, args);
  const runDir = path.join(rootDir, config.outputDir, config.id);
  const trajectoryArtifactsPath = path.join(runDir, "artifacts", selected.trajectoryId);
  const artifactsPath = path.join(runDir, "artifacts", selected.trajectoryId, "v0");
  const logger = new EventLogger(runDir, config.id);
  const startedAt = new Date().toISOString();
  const versionSummaries: TrajectoryVersionSummary[] = [];
  let totalLatencyMs = 0;

  await logger.write({
    level: "info",
    trajectory_id: selected.trajectoryId,
    version_id: "v0",
    phase: "run_one",
    event: dryRun ? "dry_run_started" : "started"
  });

  const scaffoldPath = resolveFromRoot(rootDir, config.scaffold.path);
  const evolution = await loadTaskEvolution(path.join(rootDir, "tasks", selected.taskId));
  const editVersions = Math.min(requestedVersions, config.maxVersions, evolution.length);
  if (requestedVersions > evolution.length) {
    throw new Error(`Requested ${requestedVersions} edit version(s), but task ${selected.taskId} has ${evolution.length} evolution step(s)`);
  }
  const workspace = await prepareWorkspace({
    rootDir,
    runDir,
    scaffoldPath,
    trajectory: selected
  });
  const compiled = await compileV0Prompt({
    rootDir,
    trajectory: selected,
    versionId: "v0",
    artifactsPath
  });

  console.log(`trajectory: ${selected.trajectoryId}`);
  console.log(`run type: ${runType}`);
  console.log(`edit versions: ${editVersions}`);
  console.log(`workspace: ${workspace.workspacePath}`);
  console.log(`prompt: ${compiled.promptPath}`);

  let metadata: RunMetadata = buildInitialRunMetadata({
    runType,
    trajectory: selected,
    versionId: "v0",
    workspacePath: workspace.workspacePath,
    artifactsPath,
    promptPath: compiled.promptPath,
    startedAt
  });
  await writeRunMetadata(artifactsPath, metadata);

  if (dryRun) {
    for (let index = 0; index < editVersions; index += 1) {
      const versionId = `v${index + 1}`;
      const editArtifactsPath = path.join(runDir, "artifacts", selected.trajectoryId, versionId);
      const editPrompt = await compileEditPrompt({
        rootDir,
        trajectory: selected,
        versionId,
        currentVersionId: `v${index}`,
        artifactsPath: editArtifactsPath,
        evolutionStep: evolution[index]!,
        knownFailures: []
      });
      const editMetadata = buildInitialRunMetadata({
        runType,
        trajectory: selected,
        versionId,
        workspacePath: workspace.workspacePath,
        artifactsPath: editArtifactsPath,
        promptPath: editPrompt.promptPath,
        startedAt
      });
      await writeRunMetadata(editArtifactsPath, {
        ...editMetadata,
        completed_at: new Date().toISOString(),
        status: "passed",
        failure_classification: "none"
      });
    }
    metadata = {
      ...metadata,
      completed_at: new Date().toISOString(),
      status: "passed",
      failure_classification: "none"
    };
    await writeRunMetadata(artifactsPath, metadata);
    await logger.write({
      level: "info",
      trajectory_id: selected.trajectoryId,
      version_id: "v0",
      phase: "run_one",
      event: "dry_run_completed",
      data: {
        workspacePath: workspace.workspacePath,
        promptPath: compiled.promptPath
      }
    });
    return;
  }

  const opencode = useMockOpenCode
    ? await runMockOpenCode(workspace.workspacePath, artifactsPath, undefined)
    : await runOpenCode({
        model: selected.providerModel,
        cwd: workspace.workspacePath,
        prompt: compiled.prompt,
        promptPath: compiled.promptPath,
        title: `${selected.trajectoryId}:v0`,
        artifactsPath,
        format: config.opencode.format,
        autoApprove: config.opencode.autoApprove,
        timeoutMs: config.opencode.timeoutMs
      });

  await captureGitDiff(workspace.workspacePath, path.join(artifactsPath, "git.diff"));
  totalLatencyMs += opencode.durationMs;

  if (!opencode.ok) {
    await logger.write({
      level: "error",
      trajectory_id: selected.trajectoryId,
      version_id: "v0",
      phase: "opencode_run",
      event: "failed",
      data: {
        exitCode: opencode.exitCode,
        error: opencode.error ?? ""
      }
    });
    const opencodeSummary = {
      status: "failed" as const,
      classification: "opencode_failure" as const,
      failed_phase: "opencode_run",
      failed_checks: ["opencode_run"],
      infra_suspected: false,
      messages: [opencode.error ?? `OpenCode failed with exit code ${opencode.exitCode}`],
      artifact_paths: {
        stdout: path.relative(artifactsPath, opencode.stdoutPath),
        stderr: path.relative(artifactsPath, opencode.stderrPath),
        events: path.relative(artifactsPath, opencode.eventsPath),
        git_diff: "git.diff"
      }
    };
    await writeFailureSummary(artifactsPath, opencodeSummary);
    metadata = {
      ...metadata,
      completed_at: new Date().toISOString(),
      status: "failed",
      failure_classification: "opencode_failure"
    };
    await writeRunMetadata(artifactsPath, metadata);
    throw new Error(`OpenCode failed with exit code ${opencode.exitCode}`);
  }

  let evalResult = await evaluateWorkspace({
    workspacePath: workspace.workspacePath,
    taskId: selected.taskId,
    versionId: "v0",
    artifactsPath,
    skipInstall
  });
  let failureSummary = buildFailureSummary(evalResult);
  await writeFailureSummary(artifactsPath, failureSummary);
  let score = await scoreV0(evalResult, artifactsPath, runType);
  const v0Repair = await maybeRepairVersion({
    rootDir,
    config,
    trajectory: selected,
    runType,
    useMockOpenCode,
    workspacePath: workspace.workspacePath,
    versionId: "v0",
    artifactsPath,
    evolutionStepIndex: undefined,
    failureSummary,
    maxRepairAttempts: config.maxRepairAttempts,
    skipInstall
  });
  if (v0Repair) {
    totalLatencyMs += v0Repair.durationMs;
    evalResult = v0Repair.evaluation;
    failureSummary = v0Repair.failureSummary;
    score = v0Repair.score;
  }
  versionSummaries.push(
    await buildVersionSummary({
      evaluation: evalResult,
      score,
      failureSummary,
      artifactsPath: v0Repair?.artifactsPath ?? artifactsPath,
      repairAttempts: v0Repair?.attempts ?? 0,
      repairSuccess: v0Repair?.success ?? false
    })
  );
  metadata = {
    ...metadata,
    completed_at: new Date().toISOString(),
    status: evalResult.status === "passed" ? "passed" : "failed",
    failure_classification: failureSummary.classification
  };
  await writeRunMetadata(artifactsPath, metadata);
  await writeRunReport({
    artifactsPath,
    metadata,
    evaluation: evalResult,
    score,
    failureSummary
  });
  await commitWorkspaceVersion(workspace.workspacePath, "v0", artifactsPath);
  await writeTrajectoryArtifacts(
    trajectoryArtifactsPath,
    buildTrajectorySummary({
      trajectory: selected,
      runType,
      versionsRequested: editVersions,
      versions: versionSummaries,
      totalLatencyMs
    })
  );

  await logger.write({
    level: evalResult.status === "passed" ? "info" : "warn",
    trajectory_id: selected.trajectoryId,
    version_id: "v0",
    phase: "run_one",
    event: "completed",
    data: {
      status: evalResult.status,
      versionQuality: score.scores.version_quality_smoke_score,
      opencodeDurationMs: opencode.durationMs,
      artifactsPath
    }
  });

  console.log(`opencode: ${opencode.ok ? "passed" : "failed"}`);
  console.log(`eval: ${evalResult.status}`);
  console.log(`score: ${score.scores.version_quality_smoke_score.toFixed(2)}`);
  console.log(`artifacts: ${artifactsPath}`);

  if (evalResult.status === "failed") {
    process.exitCode = 1;
    return;
  }

  let previousFailureMessages = failureSummary.messages;
  for (let index = 0; index < editVersions; index += 1) {
    const versionId = `v${index + 1}`;
    const currentVersionId = `v${index}`;
    const editArtifactsPath = path.join(runDir, "artifacts", selected.trajectoryId, versionId);
    const editStartedAt = new Date().toISOString();
    const editPrompt = await compileEditPrompt({
      rootDir,
      trajectory: selected,
      versionId,
      currentVersionId,
      artifactsPath: editArtifactsPath,
      evolutionStep: evolution[index]!,
      knownFailures: previousFailureMessages
    });
    let editMetadata = buildInitialRunMetadata({
      runType,
      trajectory: selected,
      versionId,
      workspacePath: workspace.workspacePath,
      artifactsPath: editArtifactsPath,
      promptPath: editPrompt.promptPath,
      startedAt: editStartedAt
    });
    await writeRunMetadata(editArtifactsPath, editMetadata);

    const editOpenCode = useMockOpenCode
      ? await runMockOpenCode(workspace.workspacePath, editArtifactsPath, index)
      : await runOpenCode({
          model: selected.providerModel,
          cwd: workspace.workspacePath,
          prompt: editPrompt.prompt,
          promptPath: editPrompt.promptPath,
          title: `${selected.trajectoryId}:${versionId}`,
          artifactsPath: editArtifactsPath,
          format: config.opencode.format,
          autoApprove: config.opencode.autoApprove,
          timeoutMs: config.opencode.timeoutMs
        });

    await captureGitDiff(workspace.workspacePath, path.join(editArtifactsPath, "git.diff"));
    totalLatencyMs += editOpenCode.durationMs;

    if (!editOpenCode.ok) {
      const editOpencodeSummary = {
        status: "failed" as const,
        classification: "opencode_failure" as const,
        failed_phase: "opencode_run",
        failed_checks: ["opencode_run"],
        infra_suspected: false,
        messages: [editOpenCode.error ?? `OpenCode failed with exit code ${editOpenCode.exitCode}`],
        artifact_paths: {
          stdout: path.relative(editArtifactsPath, editOpenCode.stdoutPath),
          stderr: path.relative(editArtifactsPath, editOpenCode.stderrPath),
          events: path.relative(editArtifactsPath, editOpenCode.eventsPath),
          git_diff: "git.diff"
        }
      };
      await writeFailureSummary(editArtifactsPath, editOpencodeSummary);
      editMetadata = {
        ...editMetadata,
        completed_at: new Date().toISOString(),
        status: "failed",
        failure_classification: "opencode_failure"
      };
      await writeRunMetadata(editArtifactsPath, editMetadata);
      throw new Error(`OpenCode failed for ${versionId} with exit code ${editOpenCode.exitCode}`);
    }

    let editEvalResult = await evaluateWorkspace({
      workspacePath: workspace.workspacePath,
      taskId: selected.taskId,
      versionId,
      artifactsPath: editArtifactsPath,
      evolutionStepIndex: index,
      skipInstall
    });
    let editFailureSummary = buildFailureSummary(editEvalResult);
    await writeFailureSummary(editArtifactsPath, editFailureSummary);
    let editScore = await scoreV0(editEvalResult, editArtifactsPath, runType);
    const editRepair = await maybeRepairVersion({
      rootDir,
      config,
      trajectory: selected,
      runType,
      useMockOpenCode,
      workspacePath: workspace.workspacePath,
      versionId,
      artifactsPath: editArtifactsPath,
      evolutionStepIndex: index,
      failureSummary: editFailureSummary,
      maxRepairAttempts: config.maxRepairAttempts,
      skipInstall
    });
    if (editRepair) {
      totalLatencyMs += editRepair.durationMs;
      editEvalResult = editRepair.evaluation;
      editFailureSummary = editRepair.failureSummary;
      editScore = editRepair.score;
    }
    versionSummaries.push(
      await buildVersionSummary({
        evaluation: editEvalResult,
        score: editScore,
        failureSummary: editFailureSummary,
        artifactsPath: editRepair?.artifactsPath ?? editArtifactsPath,
        repairAttempts: editRepair?.attempts ?? 0,
        repairSuccess: editRepair?.success ?? false
      })
    );
    editMetadata = {
      ...editMetadata,
      completed_at: new Date().toISOString(),
      status: editEvalResult.status === "passed" ? "passed" : "failed",
      failure_classification: editFailureSummary.classification
    };
    await writeRunMetadata(editArtifactsPath, editMetadata);
    await writeRunReport({
      artifactsPath: editArtifactsPath,
      metadata: editMetadata,
      evaluation: editEvalResult,
      score: editScore,
      failureSummary: editFailureSummary
    });
    await commitWorkspaceVersion(workspace.workspacePath, versionId, editArtifactsPath);
    await writeTrajectoryArtifacts(
      trajectoryArtifactsPath,
      buildTrajectorySummary({
        trajectory: selected,
        runType,
        versionsRequested: editVersions,
        versions: versionSummaries,
        totalLatencyMs
      })
    );

    await logger.write({
      level: editEvalResult.status === "passed" ? "info" : "warn",
      trajectory_id: selected.trajectoryId,
      version_id: versionId,
      phase: "run_one",
      event: "version_completed",
      data: {
        status: editEvalResult.status,
        evolutionStep: evolution[index]!.id,
        versionQuality: editScore.scores.version_quality_smoke_score,
        opencodeDurationMs: editOpenCode.durationMs,
        artifactsPath: editArtifactsPath
      }
    });

    console.log(`${versionId} opencode: ${editOpenCode.ok ? "passed" : "failed"}`);
    console.log(`${versionId} eval: ${editEvalResult.status}`);
    console.log(`${versionId} score: ${editScore.scores.version_quality_smoke_score.toFixed(2)}`);
    console.log(`${versionId} artifacts: ${editArtifactsPath}`);

    previousFailureMessages = editFailureSummary.messages;
    if (editEvalResult.status === "failed") {
      process.exitCode = 1;
      return;
    }
  }
}

async function buildVersionSummary(options: {
  evaluation: EvaluationResult;
  score: VersionScore;
  failureSummary: ReturnType<typeof buildFailureSummary>;
  artifactsPath: string;
  repairAttempts?: number;
  repairSuccess?: boolean;
}): Promise<TrajectoryVersionSummary> {
  return {
    version_id: options.evaluation.version_id,
    status: options.evaluation.status === "passed" ? "passed" : "failed",
    score: options.score.scores.version_quality_smoke_score,
    failure_classification: options.failureSummary.classification,
    failed_checks: options.failureSummary.failed_checks,
    repair_attempts: options.repairAttempts ?? 0,
    repair_success: options.repairSuccess ?? false,
    loc_total: options.evaluation.metrics.code_health.loc_total,
    largest_file_loc: options.evaluation.metrics.code_health.largest_file.loc,
    diff: await readDiffMetrics(path.join(options.artifactsPath, "git.diff")),
    artifacts_path: options.artifactsPath
  };
}

type RepairResult = {
  attempts: number;
  success: boolean;
  durationMs: number;
  artifactsPath: string;
  evaluation: EvaluationResult;
  failureSummary: ReturnType<typeof buildFailureSummary>;
  score: VersionScore;
};

async function maybeRepairVersion(options: {
  rootDir: string;
  config: MatrixConfig;
  trajectory: TrajectoryPlan;
  runType: RunType;
  useMockOpenCode: boolean;
  workspacePath: string;
  versionId: string;
  artifactsPath: string;
  evolutionStepIndex: number | undefined;
  failureSummary: ReturnType<typeof buildFailureSummary>;
  maxRepairAttempts: number;
  skipInstall: boolean;
}): Promise<RepairResult | null> {
  if (options.maxRepairAttempts < 1 || !shouldAttemptRepair(options.failureSummary.failed_checks)) {
    return null;
  }

  const repairArtifactsPath = path.join(options.artifactsPath, "repair-1");
  const repairPrompt = await compileRepairPrompt({
    rootDir: options.rootDir,
    trajectory: options.trajectory,
    versionId: options.versionId,
    artifactsPath: repairArtifactsPath,
    failedVersionId: options.versionId,
    failedChecks: options.failureSummary.failed_checks,
    failureMessages: options.failureSummary.messages,
    artifactPaths: options.failureSummary.artifact_paths
  });
  const repairOpenCode = options.useMockOpenCode
    ? await runMockOpenCode(options.workspacePath, repairArtifactsPath, options.evolutionStepIndex)
    : await runOpenCode({
        model: options.trajectory.providerModel,
        cwd: options.workspacePath,
        prompt: repairPrompt.prompt,
        promptPath: repairPrompt.promptPath,
        title: `${options.trajectory.trajectoryId}:${options.versionId}:repair-1`,
        artifactsPath: repairArtifactsPath,
        format: options.config.opencode.format,
        autoApprove: options.config.opencode.autoApprove,
        timeoutMs: options.config.opencode.timeoutMs
      });

  await captureGitDiff(options.workspacePath, path.join(repairArtifactsPath, "git.diff"));

  if (!repairOpenCode.ok) {
    const failedEvaluation = await evaluateWorkspace({
      workspacePath: options.workspacePath,
      taskId: options.trajectory.taskId,
      versionId: options.versionId,
      artifactsPath: repairArtifactsPath,
      evolutionStepIndex: options.evolutionStepIndex,
      skipInstall: options.skipInstall
    });
    const failedSummary = buildFailureSummary(failedEvaluation);
    await writeFailureSummary(repairArtifactsPath, failedSummary);
    const failedScore = await scoreV0(failedEvaluation, repairArtifactsPath, options.runType);
    await writeRepairSummary(options.artifactsPath, repairArtifactsPath, {
      version_id: options.versionId,
      attempt: 1,
      status: "failed",
      repair_success: false,
      failed_checks_before_repair: options.failureSummary.failed_checks,
      failed_checks_after_repair: failedSummary.failed_checks,
      artifacts_path: repairArtifactsPath,
      prompt_path: repairPrompt.promptPath
    });
    return {
      attempts: 1,
      success: false,
      durationMs: repairOpenCode.durationMs,
      artifactsPath: repairArtifactsPath,
      evaluation: failedEvaluation,
      failureSummary: failedSummary,
      score: failedScore
    };
  }

  const evaluation = await evaluateWorkspace({
    workspacePath: options.workspacePath,
    taskId: options.trajectory.taskId,
    versionId: options.versionId,
    artifactsPath: repairArtifactsPath,
    evolutionStepIndex: options.evolutionStepIndex,
    skipInstall: options.skipInstall
  });
  const failureSummary = buildFailureSummary(evaluation);
  await writeFailureSummary(repairArtifactsPath, failureSummary);
  const score = await scoreV0(evaluation, repairArtifactsPath, options.runType);
  await commitWorkspaceVersion(options.workspacePath, `${options.versionId}-repair-1`, repairArtifactsPath);
  await writeRepairSummary(options.artifactsPath, repairArtifactsPath, {
    version_id: options.versionId,
    attempt: 1,
    status: evaluation.status === "passed" ? "passed" : "failed",
    repair_success: evaluation.status === "passed",
    failed_checks_before_repair: options.failureSummary.failed_checks,
    failed_checks_after_repair: failureSummary.failed_checks,
    artifacts_path: repairArtifactsPath,
    prompt_path: repairPrompt.promptPath
  });

  return {
    attempts: 1,
    success: evaluation.status === "passed",
    durationMs: repairOpenCode.durationMs,
    artifactsPath: repairArtifactsPath,
    evaluation,
    failureSummary,
    score
  };
}

function shouldAttemptRepair(failedChecks: string[]): boolean {
  return failedChecks.some((check) => check === "build" || check === "e2e" || check === "values");
}

async function runMockOpenCode(
  workspacePath: string,
  artifactsPath: string,
  evolutionStepIndex?: number
): Promise<OpenCodeRunResult> {
  const startedAt = Date.now();
  const variant = mockVariantForEvolutionStep(evolutionStepIndex);
  await writeMockTodoMvc(workspacePath, variant);
  await ensureDir(artifactsPath);
  await writeFile(path.join(artifactsPath, "opencode.stdout.log"), `mock-opencode generated TodoMVC locally (${variant})\n`, "utf8");
  await writeFile(path.join(artifactsPath, "opencode.stderr.log"), "", "utf8");
  await writeFile(
    path.join(artifactsPath, "opencode.events.jsonl"),
    `${JSON.stringify({ type: "mock_generation", status: "completed", variant })}\n`,
    "utf8"
  );
  return {
    ok: true,
    exitCode: 0,
    durationMs: Date.now() - startedAt,
    stdoutPath: path.join(artifactsPath, "opencode.stdout.log"),
    stderrPath: path.join(artifactsPath, "opencode.stderr.log"),
    eventsPath: path.join(artifactsPath, "opencode.events.jsonl")
  };
}

function mockVariantForEvolutionStep(evolutionStepIndex?: number): MockTodoMvcVariant {
  if (evolutionStepIndex === 0) {
    return "due-dates";
  }
  if (evolutionStepIndex === 1) {
    return "search";
  }
  if (evolutionStepIndex === 2) {
    return "tags";
  }
  if (evolutionStepIndex === 3) {
    return "remove-tags";
  }
  return "base";
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
  const evolutionStepIndex = optionalNumberOption(args, "evolution-step-index");

  const result = await evaluateWorkspace({
    workspacePath,
    taskId,
    versionId,
    artifactsPath,
    skipInstall,
    evolutionStepIndex
  });
  const failureSummary = buildFailureSummary(result);
  await writeFailureSummary(artifactsPath, failureSummary);
  const score = await scoreV0(result, artifactsPath, "real");

  console.log(`eval ${result.status}`);
  console.log(`install: ${result.checks.install.status}`);
  console.log(`build: ${result.checks.build.status}`);
  console.log(`runtimeSmoke: ${result.checks.runtimeSmoke.status}`);
  console.log(`score: ${score.scores.version_quality_smoke_score.toFixed(2)}`);
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

async function aggregateCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml"));
  const config = await loadMatrixConfig(configPath);
  const runDir = path.join(rootDir, config.outputDir, config.id);
  const result = await aggregateRun(runDir);

  console.log(`aggregated trajectories: ${result.trajectoryCount}`);
  console.log(`aggregated versions: ${result.versionCount}`);
  console.log(`trajectory results: ${result.outputs.trajectoryResultsJsonl}`);
  console.log(`version results: ${result.outputs.versionResultsJsonl}`);
  console.log(`scores: ${result.outputs.scoresCsv}`);
  console.log(`leaderboard: ${result.outputs.leaderboardMd}`);
}

async function negotiateOneCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml"));
  const config = await loadMatrixConfig(configPath);
  const taskId = stringOption(args, "task", config.tasks[0] ?? "todomvc");
  const scenarioId = stringOption(args, "scenario", "03-underspecified-tags");
  const modelId = stringOption(args, "model", config.models[0]?.id ?? "");
  const systemPromptId = stringOption(args, "system", config.prompts.system[0] ?? "");
  const runNumber = numberOption(args, "run", 1);
  const runType = readRunType(args, booleanOption(args, "mock-opencode", false));
  const full = booleanOption(args, "full", false);
  const skipInstall = booleanOption(args, "skip-install", false);
  const model = config.models.find((item) => item.id === modelId || item.providerModel === modelId);
  if (!model) {
    throw new Error(`Unknown model "${modelId}"`);
  }
  if (!config.tasks.includes(taskId)) {
    throw new Error(`Unknown task "${taskId}"`);
  }
  if (!config.prompts.system.includes(systemPromptId)) {
    throw new Error(`Unknown system prompt "${systemPromptId}"`);
  }

  const taskDir = path.join(rootDir, "tasks", taskId);
  const scenario = await loadNegotiationScenario(taskDir, scenarioId);
  const runDir = path.join(rootDir, config.outputDir, config.id);
  const negotiationId = [taskId, scenario.id, model.id, systemPromptId, `r${runNumber}`].join("__");
  const artifactsPath = path.join(runDir, "negotiation", negotiationId);
  const scaffoldPath = resolveFromRoot(rootDir, config.scaffold.path);
  const workspace = await prepareWorkspace({
    rootDir,
    runDir,
    scaffoldPath,
    trajectory: {
      trajectoryId: `negotiation__${negotiationId}`,
      taskId,
      modelId: model.id,
      providerModel: model.providerModel,
      systemPromptId,
      userPromptId: "negotiation",
      editPromptId: scenario.id,
      runNumber,
      versions: [scenario.version]
    }
  });
  const result = await runNegotiationPreflight({
    artifactsPath,
    scenario,
    runType,
    providerModel: model.providerModel,
    workspacePath: workspace.workspacePath,
    opencodeFormat: config.opencode.format,
    autoApprove: config.opencode.autoApprove,
    timeoutMs: config.opencode.timeoutMs
  });
  if (full) {
    await runFullNegotiationImplementation({
      taskId,
      scenario,
      runType,
      model,
      config,
      workspacePath: workspace.workspacePath,
      artifactsPath: path.join(artifactsPath, "implementation"),
      skipInstall
    });
  }

  console.log(`negotiation: ${negotiationId}`);
  console.log(`run type: ${runType}`);
  console.log(`full: ${full}`);
  console.log(`decision: ${result.decision.decision}`);
  console.log(`score: ${result.score.clarification_score.toFixed(2)}`);
  console.log(`artifacts: ${artifactsPath}`);
}

async function runFullNegotiationImplementation(options: {
  taskId: string;
  scenario: Awaited<ReturnType<typeof loadNegotiationScenario>>;
  runType: RunType;
  model: MatrixConfig["models"][number];
  config: MatrixConfig;
  workspacePath: string;
  artifactsPath: string;
  skipInstall: boolean;
}): Promise<void> {
  await ensureDir(options.artifactsPath);
  const prompt = buildNegotiatedImplementationPrompt(options.scenario);
  const promptPath = path.join(options.artifactsPath, "prompt.md");
  await writeFile(promptPath, prompt, "utf8");
  const opencode =
    options.runType === "mock"
      ? await runMockOpenCode(options.workspacePath, options.artifactsPath, scenarioEvolutionStepIndex(options.scenario))
      : await runOpenCode({
          model: options.model.providerModel,
          cwd: options.workspacePath,
          prompt,
          promptPath,
          title: `negotiation:${options.scenario.id}:implementation`,
          artifactsPath: options.artifactsPath,
          format: options.config.opencode.format,
          autoApprove: options.config.opencode.autoApprove,
          timeoutMs: options.config.opencode.timeoutMs
        });
  await captureGitDiff(options.workspacePath, path.join(options.artifactsPath, "git.diff"));

  if (!opencode.ok) {
    await writeFile(
      path.join(options.artifactsPath, "full-negotiation-result.json"),
      JSON.stringify(
        {
          status: "failed",
          phase: "implementation_opencode",
          opencode_exit_code: opencode.exitCode,
          error: opencode.error ?? null
        },
        null,
        2
      ),
      "utf8"
    );
    return;
  }

  const evaluation = await evaluateWorkspace({
    workspacePath: options.workspacePath,
    taskId: options.taskId,
    versionId: options.scenario.version,
    artifactsPath: options.artifactsPath,
    evolutionStepIndex: scenarioEvolutionStepIndex(options.scenario),
    skipInstall: options.skipInstall
  });
  const failureSummary = buildFailureSummary(evaluation);
  await writeFailureSummary(options.artifactsPath, failureSummary);
  const score = await scoreV0(evaluation, options.artifactsPath, options.runType);
  await commitWorkspaceVersion(options.workspacePath, `negotiation-${options.scenario.id}`, options.artifactsPath);
  await writeFile(
    path.join(options.artifactsPath, "full-negotiation-result.json"),
    JSON.stringify(
      {
        status: evaluation.status,
        scenario_id: options.scenario.id,
        version_id: options.scenario.version,
        evolution_step_index: scenarioEvolutionStepIndex(options.scenario) ?? null,
        implementation_score: score.scores.version_quality_smoke_score,
        failure_classification: failureSummary.classification,
        failed_checks: failureSummary.failed_checks,
        check_results: "check-results.json",
        score: "score.json"
      },
      null,
      2
    ),
    "utf8"
  );
}

async function exportJuryPacketCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml"));
  const config = await loadMatrixConfig(configPath);
  const trajectoryId = stringOption(args, "trajectory", "");
  if (!trajectoryId) {
    throw new Error("export-jury-packet requires --trajectory");
  }
  const runDir = path.join(rootDir, config.outputDir, config.id);
  const outPath = resolveFromRoot(rootDir, stringOption(args, "out", path.join("jury-packets", trajectoryId)));
  const blind = booleanOption(args, "blind", false);
  const result = await exportJuryPacket({
    rootDir,
    runDir,
    trajectoryId,
    outPath,
    blind
  });

  console.log(`jury packet: ${result.packetPath}`);
  console.log(`files: ${result.files.length}`);
}

async function importJuryReviewCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml"));
  const config = await loadMatrixConfig(configPath);
  const trajectoryId = stringOption(args, "trajectory", "");
  const reviewPath = resolveFromRoot(rootDir, stringOption(args, "review", ""));
  const reviewerId = stringOption(args, "reviewer", "anonymous");
  if (!trajectoryId) {
    throw new Error("import-jury-review requires --trajectory");
  }
  if (!reviewPath) {
    throw new Error("import-jury-review requires --review");
  }
  const runDir = path.join(rootDir, config.outputDir, config.id);
  const result = await importJuryReview({
    runDir,
    trajectoryId,
    reviewPath,
    reviewerId
  });

  console.log(`imported review: ${result.reviewPath}`);
}

function selectTrajectory(config: MatrixConfig, args: CliArgs): TrajectoryPlan {
  const taskId = stringOption(args, "task", config.tasks[0] ?? "");
  const modelId = stringOption(args, "model", config.models[0]?.id ?? "");
  const systemPromptId = stringOption(args, "system", config.prompts.system[0] ?? "");
  const userPromptId = stringOption(args, "user", config.prompts.user[0] ?? "");
  const editPromptId = stringOption(args, "edit", config.prompts.edit[0] ?? "");
  const runNumber = numberOption(args, "run", 1);

  const model = config.models.find((item) => item.id === modelId || item.providerModel === modelId);
  if (!model) {
    throw new Error(`Unknown model "${modelId}"`);
  }
  if (!config.tasks.includes(taskId)) {
    throw new Error(`Unknown task "${taskId}"`);
  }
  if (!config.prompts.system.includes(systemPromptId)) {
    throw new Error(`Unknown system prompt "${systemPromptId}"`);
  }
  if (!config.prompts.user.includes(userPromptId)) {
    throw new Error(`Unknown user prompt "${userPromptId}"`);
  }
  if (!config.prompts.edit.includes(editPromptId)) {
    throw new Error(`Unknown edit prompt "${editPromptId}"`);
  }
  if (runNumber < 1) {
    throw new Error("Run number must be at least 1");
  }

  return {
    trajectoryId: [taskId, model.id, systemPromptId, userPromptId, editPromptId, `r${runNumber}`].join("__"),
    taskId,
    modelId: model.id,
    providerModel: model.providerModel,
    systemPromptId,
    userPromptId,
    editPromptId,
    runNumber,
    versions: Array.from({ length: config.maxVersions + 1 }, (_, index) => `v${index}`)
  };
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

function readRunType(args: CliArgs, mockOpenCode: boolean): RunType {
  const value = stringOption(args, "run-type", mockOpenCode ? "mock" : "real");
  if (value !== "mock" && value !== "real") {
    throw new Error("--run-type must be either mock or real");
  }
  if (mockOpenCode && value !== "mock") {
    throw new Error("--mock-opencode requires --run-type mock");
  }
  return value;
}

function numberOption(args: CliArgs, key: string, fallback: number): number {
  const value = args.options.get(key);
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string") {
    throw new Error(`--${key} requires a numeric value`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`--${key} must be an integer`);
  }
  return parsed;
}

function optionalNumberOption(args: CliArgs, key: string): number | undefined {
  if (!args.options.has(key)) {
    return undefined;
  }
  return numberOption(args, key, 0);
}

function printHelp(): void {
  console.log(`Usage:
  pnpm bench init
  pnpm bench validate-task tasks/todomvc
  pnpm bench preflight --config configs/mvp.yaml
  pnpm bench eval --workspace scaffolds/vite-react-ts --task todomvc --version v0
  pnpm bench eval --workspace <workspace> --task todomvc --version v1 --evolution-step-index 0
  pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --edit E2-smallest-maintainable-change --dry-run
  pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --edit E2-smallest-maintainable-change --mock-opencode
  pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U5-maintainable --edit E2-smallest-maintainable-change --versions 4 --run-type mock
  pnpm bench run-matrix --config configs/mvp.yaml --dry-run
  pnpm bench aggregate --config configs/mvp.yaml
  pnpm bench negotiate-one --task todomvc --scenario 03-underspecified-tags --model deepseek-v4-flash-free --system S2-maintainable-simple --run-type mock
  pnpm bench negotiate-one --task todomvc --scenario 03-underspecified-tags --model deepseek-v4-flash-free --system S2-maintainable-simple --run-type mock --full
  pnpm bench export-jury-packet --trajectory <trajectory-id> --blind --out jury-packets/<packet-id>
  pnpm bench import-jury-review --trajectory <trajectory-id> --review jury-packets/<packet-id>/review-form.md --reviewer reviewer-1
`);
}

await main();
