#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { cpus } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { aggregateRun, aggregateRuns } from "./aggregation.js";
import { runCommand } from "./command.js";
import { loadMatrixConfig } from "./config.js";
import { EventLogger } from "./events.js";
import { createOrResumeExecution, finalizeExecution } from "./execution.js";
import { evaluateWorkspace, type EvaluationResult } from "./evaluator.js";
import { copyDirFiltered, ensureDir, pathExists, resolveFromRoot, writeFileIfMissing } from "./fs.js";
import { exportJuryPacket, importJuryReview, type JuryBlindMode } from "./juryPacket.js";
import { buildTrajectoryPlan } from "./matrix.js";
import { writeMockTodoMvc, type MockTodoMvcVariant } from "./mockGenerator.js";
import {
  buildNegotiatedImplementationPrompt,
  loadNegotiationScenario,
  runNegotiationPreflight,
  scenarioEvolutionStepIndex
} from "./negotiation.js";
import { appendClarificationToImplementationPrompt, resolveLifecycleClarification, runLifecyclePreflight } from "./lifecyclePreflight.js";
import { verifyLifecyclePreflightFixture } from "./lifecyclePreflight.fixtures.js";
import { runOpenCode, type OpenCodeRunResult } from "./opencodeAdapter.js";
import { verifyOpenCodeRetryFixture } from "./opencodeAdapter.fixtures.js";
import { parseOpenCodeEvents, type AgentUsage } from "./opencodeEventParser.js";
import { verifyOpenCodeEventParserFixtures } from "./opencodeEventParser.fixtures.js";
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
  buildTerminalVersionSummary,
  readDiffMetrics,
  writeTerminalRunReport,
  unavailableAgentUsage,
  type RunMetadata,
  type RunType,
  type FeedbackEvent,
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
import { createArtifactManifest, verifyExecution } from "./verification.js";

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
      case "doctor":
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
      case "verify-run":
        await verifyRunCommand(args);
        break;
      case "record-proof":
        await recordProofCommand(args);
        break;
      case "verify-opencode-parser":
        await verifyOpenCodeParserCommand();
        break;
      case "verify-opencode-retry":
        await verifyOpenCodeRetryCommand();
        break;
      case "verify-lifecycle-preflight":
        await verifyLifecyclePreflightCommand();
        break;
      case "negotiate-one":
        await negotiateOneCommand(args);
        break;
      case "export-jury-packet":
        await exportJuryPacketCommand(args);
        break;
      case "export-jury-pair":
        await exportJuryPairCommand(args);
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
  const mockProfile = stringOption(args, "mock-profile", "happy");
  const clarificationAnswer = optionalStringOption(args, "clarification-answer");
  const requestedVersions = numberOption(args, "versions", 0);
  const skipInstall = booleanOption(args, "skip-install", false);
  const selectedBase = selectTrajectory(config, args);
  const selected = dryRun
    ? { ...selectedBase, trajectoryId: `${selectedBase.trajectoryId}__dry-run` }
    : selectedBase;
  const matrixRoot = path.join(rootDir, config.outputDir, config.id);
  const resumeExecutionId = optionalStringOption(args, "resume");
  const matrixChildResume = booleanOption(args, "matrix-child-resume", false);
  const allowDirty = booleanOption(args, "allow-dirty", false);
  assertExecutionMode(args, resumeExecutionId);
  const execution = await createOrResumeExecution({
    rootDir,
    matrixRoot,
    configPath,
    config,
    trajectories: [selected],
    runType,
    requestedVersions,
    mockProfile: useMockOpenCode ? mockProfile : null,
    allowDirty,
    ...(matrixChildResume ? { allowTrajectorySubset: true } : {}),
    ...(resumeExecutionId ? { resumeExecutionId } : {})
  });
  const runDir = execution.rootPath;
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
    trajectory: selected,
    executionId: execution.executionId
  });
  const compiled = await compileV0Prompt({
    rootDir,
    trajectory: selected,
    versionId: "v0",
    artifactsPath
  });
  const v0Preparation = dryRun ? emptyPreparedImplementation(compiled.prompt) : await prepareImplementationAfterPreflight({
    rootDir,
    config,
    trajectory: selected,
    runType,
    workspacePath: workspace.workspacePath,
    artifactsPath,
    versionId: "v0",
    prompt: compiled.prompt,
    promptPath: compiled.promptPath,
    ...(clarificationAnswer ? { clarificationAnswer } : {})
  });

  console.log(`trajectory: ${selected.trajectoryId}`);
  console.log(`execution: ${execution.executionId}${execution.resumed ? " (resumed)" : ""}`);
  console.log(`run type: ${runType}`);
  console.log(`edit versions: ${editVersions}`);
  console.log(`workspace: ${workspace.workspacePath}`);
  console.log(`prompt: ${compiled.promptPath}`);

  let metadata: RunMetadata = buildInitialRunMetadata({
    runType,
    executionId: execution.executionId,
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
        executionId: execution.executionId,
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
    await finalizeExecution(execution, "completed");
    return;
  }

  const opencode = useMockOpenCode
    ? await runMockOpenCode(workspace.workspacePath, artifactsPath, undefined, mockProfile)
    : await runOpenCode({
        model: selected.providerModel,
        cwd: workspace.workspacePath,
        prompt: v0Preparation.prompt,
        promptPath: compiled.promptPath,
        title: `${selected.trajectoryId}:v0`,
        artifactsPath,
        format: config.opencode.format,
        autoApprove: config.opencode.autoApprove,
        timeoutMs: config.opencode.timeoutMs,
        maxAttempts: Math.min(config.opencode.maxAttempts, config.opencode.maxContinuations + 1)
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
    versionSummaries.push(
      await buildTerminalVersionSummary({
        versionId: "v0",
        classification: "opencode_failure",
        failedPhase: "opencode_run",
        artifactsPath,
        generationUsage: opencode.parsed.usage
      })
    );
    await writeTerminalRunReport({ artifactsPath, metadata, failureSummary: opencodeSummary });
    await writeTrajectoryArtifacts(
      trajectoryArtifactsPath,
      buildTrajectorySummary({ trajectory: selected, runType, versionsRequested: editVersions, versions: versionSummaries, totalLatencyMs })
    );
    await finalizeExecution(execution, "failed");
    throw new Error(`OpenCode failed with exit code ${opencode.exitCode}`);
  }

  let evalResult: EvaluationResult;
  try {
    evalResult = await evaluateWorkspace({
      workspacePath: workspace.workspacePath,
      taskId: selected.taskId,
      versionId: "v0",
      artifactsPath,
      skipInstall
    });
  } catch (error) {
    await finalizeUnhandledVersion({ execution, trajectory: selected, runType, editVersions, versionSummaries, totalLatencyMs, trajectoryArtifactsPath, artifactsPath, metadata, versionId: "v0", error });
    throw error;
  }
  let failureSummary = buildFailureSummary(evalResult);
  await writeFailureSummary(artifactsPath, failureSummary);
  let score = await scoreV0(evalResult, artifactsPath, runType);
  const v0Repair = await maybeRepairVersion({
    rootDir,
    config,
    trajectory: selected,
    runType,
    useMockOpenCode,
    mockProfile,
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
      repairSuccess: v0Repair?.success ?? false,
      generationUsage: opencode.parsed.usage,
      preflightUsage: v0Preparation.preflightUsage,
      clarificationUsage: v0Preparation.clarificationUsage,
      repairUsage: v0Repair?.usage ?? [],
      feedbackEvents: v0Preparation.feedbackEvents
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
    await finalizeExecution(execution, "failed");
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
    const editPreparation = await prepareImplementationAfterPreflight({
      rootDir,
      config,
      trajectory: selected,
      runType,
      workspacePath: workspace.workspacePath,
      artifactsPath: editArtifactsPath,
      versionId,
      prompt: editPrompt.prompt,
      promptPath: editPrompt.promptPath,
      ...(evolution[index]!.clarificationScenario ? { clarificationScenario: evolution[index]!.clarificationScenario } : {}),
      ...(clarificationAnswer ? { clarificationAnswer } : {})
    });
    let editMetadata = buildInitialRunMetadata({
      runType,
      executionId: execution.executionId,
      trajectory: selected,
      versionId,
      workspacePath: workspace.workspacePath,
      artifactsPath: editArtifactsPath,
      promptPath: editPrompt.promptPath,
      startedAt: editStartedAt
    });
    await writeRunMetadata(editArtifactsPath, editMetadata);

    const editOpenCode = useMockOpenCode
      ? await runMockOpenCode(workspace.workspacePath, editArtifactsPath, index, mockProfile)
      : await runOpenCode({
          model: selected.providerModel,
          cwd: workspace.workspacePath,
          prompt: editPreparation.prompt,
          promptPath: editPrompt.promptPath,
          title: `${selected.trajectoryId}:${versionId}`,
          artifactsPath: editArtifactsPath,
          format: config.opencode.format,
          autoApprove: config.opencode.autoApprove,
          timeoutMs: config.opencode.timeoutMs,
          maxAttempts: Math.min(config.opencode.maxAttempts, config.opencode.maxContinuations + 1)
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
      versionSummaries.push(
        await buildTerminalVersionSummary({
          versionId,
          classification: "opencode_failure",
          failedPhase: "opencode_run",
          artifactsPath: editArtifactsPath,
          generationUsage: editOpenCode.parsed.usage
        })
      );
      await writeTerminalRunReport({ artifactsPath: editArtifactsPath, metadata: editMetadata, failureSummary: editOpencodeSummary });
      await writeTrajectoryArtifacts(
        trajectoryArtifactsPath,
        buildTrajectorySummary({ trajectory: selected, runType, versionsRequested: editVersions, versions: versionSummaries, totalLatencyMs })
      );
      await finalizeExecution(execution, "failed");
      throw new Error(`OpenCode failed for ${versionId} with exit code ${editOpenCode.exitCode}`);
    }

    let editEvalResult: EvaluationResult;
    try {
      editEvalResult = await evaluateWorkspace({
        workspacePath: workspace.workspacePath,
        taskId: selected.taskId,
        versionId,
        artifactsPath: editArtifactsPath,
        evolutionStepIndex: index,
        skipInstall
      });
    } catch (error) {
      await finalizeUnhandledVersion({ execution, trajectory: selected, runType, editVersions, versionSummaries, totalLatencyMs, trajectoryArtifactsPath, artifactsPath: editArtifactsPath, metadata: editMetadata, versionId, error });
      throw error;
    }
    let editFailureSummary = buildFailureSummary(editEvalResult);
    await writeFailureSummary(editArtifactsPath, editFailureSummary);
    let editScore = await scoreV0(editEvalResult, editArtifactsPath, runType);
    const editRepair = await maybeRepairVersion({
      rootDir,
      config,
      trajectory: selected,
      runType,
      useMockOpenCode,
      mockProfile,
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
        repairSuccess: editRepair?.success ?? false,
        generationUsage: editOpenCode.parsed.usage,
        preflightUsage: editPreparation.preflightUsage,
        clarificationUsage: editPreparation.clarificationUsage,
        repairUsage: editRepair?.usage ?? [],
        feedbackEvents: editPreparation.feedbackEvents
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
      await finalizeExecution(execution, "failed");
      return;
    }
  }
  await finalizeExecution(execution, "completed");
}

async function buildVersionSummary(options: {
  evaluation: EvaluationResult;
  score: VersionScore;
  failureSummary: ReturnType<typeof buildFailureSummary>;
  artifactsPath: string;
  repairAttempts?: number;
  repairSuccess?: boolean;
  generationUsage: AgentUsage;
  preflightUsage?: AgentUsage[];
  clarificationUsage?: AgentUsage[];
  repairUsage?: AgentUsage[];
  feedbackEvents?: FeedbackEvent[];
}): Promise<TrajectoryVersionSummary> {
  return {
    version_id: options.evaluation.version_id,
    status: options.evaluation.status === "passed" ? "passed" : "failed",
    score: options.score.scores.version_quality_smoke_score,
    failure_classification: options.failureSummary.classification,
    failed_phase: options.failureSummary.failed_phase,
    evaluation_completed: true,
    failed_checks: options.failureSummary.failed_checks,
    repair_attempts: options.repairAttempts ?? 0,
    repair_success: options.repairSuccess ?? false,
    loc_total: options.evaluation.metrics.code_health.loc_total,
    largest_file_loc: options.evaluation.metrics.code_health.largest_file.loc,
    diff: await readDiffMetrics(path.join(options.artifactsPath, "git.diff")),
    generation_usage: options.generationUsage,
    preflight_usage: options.preflightUsage ?? [],
    clarification_usage: options.clarificationUsage ?? [],
    repair_usage: options.repairUsage ?? [],
    version_total_usage: combineVersionUsage(options.generationUsage, [...(options.preflightUsage ?? []), ...(options.clarificationUsage ?? []), ...(options.repairUsage ?? [])]),
    feedback_events: options.feedbackEvents ?? [],
    artifacts_path: options.artifactsPath
  };
}

async function prepareImplementationAfterPreflight(options: {
  rootDir: string;
  config: MatrixConfig;
  trajectory: TrajectoryPlan;
  runType: RunType;
  workspacePath: string;
  artifactsPath: string;
  versionId: string;
  prompt: string;
  promptPath: string;
  clarificationScenario?: string;
  clarificationAnswer?: string;
}): Promise<PreparedImplementation> {
  let preparedPrompt = options.prompt;
  let resolvedAnswer: string | undefined;
  const preflightUsage: AgentUsage[] = [];
  const clarificationUsage: AgentUsage[] = [];
  const feedbackEvents: FeedbackEvent[] = [];
  for (let round = 0; round <= options.config.clarification.maxRounds; round += 1) {
    const preflight = await runLifecyclePreflight({
      rootDir: options.rootDir,
      taskId: options.trajectory.taskId,
      versionId: options.versionId,
      request: preparedPrompt,
      artifactsPath: options.artifactsPath,
      workspacePath: options.workspacePath,
      providerModel: options.trajectory.providerModel,
      runType: options.runType,
      opencodeFormat: options.config.opencode.format,
      autoApprove: options.config.opencode.autoApprove,
      timeoutMs: options.config.opencode.timeoutMs,
      maxAttempts: options.config.opencode.maxAttempts,
      maxContinuations: options.config.opencode.maxContinuations,
      ...(options.clarificationScenario ? { scenarioId: options.clarificationScenario } : {}),
      ...(resolvedAnswer ? { resolvedAnswer, purpose: "clarification" as const, round } : {})
    });
    if (round === 0) preflightUsage.push(preflight.usage);
    else clarificationUsage.push(preflight.usage);
    feedbackEvents.push({
      kind: "preflight",
      automatic: true,
      source: "none",
      round: round === 0 ? null : round,
      question_count: 0,
      answer_words: 0,
      artifacts_path: preflight.artifactsPath
    });
    const diffPath = path.join(preflight.artifactsPath, "preflight.git.diff");
    await captureGitDiff(options.workspacePath, diffPath);
    if ((await readFile(diffPath, "utf8")).trim()) {
      throw new Error(`Requirements preflight modified the workspace for ${options.versionId}`);
    }
    if (preflight.decision.decision === "proceed") {
      await writeFile(options.promptPath, preparedPrompt, "utf8");
      return { prompt: preparedPrompt, preflightUsage, clarificationUsage, feedbackEvents };
    }
    if (preflight.decision.decision !== "clarify") {
      throw new Error(`Requirements preflight for ${options.versionId} returned ${preflight.decision.decision}: ${preflight.decision.reason}`);
    }
    if (round >= options.config.clarification.maxRounds) {
      throw new Error(`Clarification limit reached for ${options.versionId}`);
    }
    const clarification = await resolveLifecycleClarification({
      rootDir: options.rootDir,
      taskId: options.trajectory.taskId,
      scenarioId: preflight.scenarioId,
      answerSource: options.config.clarification.answerSource,
      ...(options.clarificationAnswer ? { humanAnswer: options.clarificationAnswer } : {}),
      artifactsPath: options.artifactsPath,
      round: round + 1,
      questions: preflight.decision.questions
    });
    resolvedAnswer = clarification.answer;
    feedbackEvents.push({
      kind: "clarification",
      automatic: clarification.source !== "human_answer",
      source: clarification.source,
      round: round + 1,
      question_count: preflight.decision.questions.length,
      answer_words: clarification.answer.trim() ? clarification.answer.trim().split(/\s+/).length : 0,
      artifacts_path: clarification.artifactsPath
    });
    preparedPrompt = appendClarificationToImplementationPrompt(preparedPrompt, clarification.answer, clarification.source);
  }
  throw new Error(`Clarification limit reached for ${options.versionId}`);
}

type PreparedImplementation = {
  prompt: string;
  preflightUsage: AgentUsage[];
  clarificationUsage: AgentUsage[];
  feedbackEvents: FeedbackEvent[];
};

function emptyPreparedImplementation(prompt: string): PreparedImplementation {
  return { prompt, preflightUsage: [], clarificationUsage: [], feedbackEvents: [] };
}

async function finalizeUnhandledVersion(options: {
  execution: Awaited<ReturnType<typeof createOrResumeExecution>>;
  trajectory: TrajectoryPlan;
  runType: RunType;
  editVersions: number;
  versionSummaries: TrajectoryVersionSummary[];
  totalLatencyMs: number;
  trajectoryArtifactsPath: string;
  artifactsPath: string;
  metadata: RunMetadata;
  versionId: string;
  error: unknown;
}): Promise<void> {
  const message = options.error instanceof Error ? options.error.message : String(options.error);
  const failure = {
    status: "failed" as const,
    classification: "harness_failure" as const,
    failed_phase: "evaluation_running",
    failed_checks: ["evaluation_running"],
    infra_suspected: false,
    messages: [message],
    artifact_paths: {}
  };
  await writeFailureSummary(options.artifactsPath, failure);
  const metadata = { ...options.metadata, completed_at: new Date().toISOString(), status: "failed" as const, failure_classification: "harness_failure" as const };
  await writeRunMetadata(options.artifactsPath, metadata);
  await writeTerminalRunReport({ artifactsPath: options.artifactsPath, metadata, failureSummary: failure });
  options.versionSummaries.push(await buildTerminalVersionSummary({ versionId: options.versionId, classification: "harness_failure", failedPhase: "evaluation_running", artifactsPath: options.artifactsPath, generationUsage: unavailableAgentUsage() }));
  await writeTrajectoryArtifacts(options.trajectoryArtifactsPath, buildTrajectorySummary({ trajectory: options.trajectory, runType: options.runType, versionsRequested: options.editVersions, versions: options.versionSummaries, totalLatencyMs: options.totalLatencyMs }));
  await finalizeExecution(options.execution, "failed");
}

type RepairResult = {
  attempts: number;
  success: boolean;
  durationMs: number;
  artifactsPath: string;
  evaluation: EvaluationResult;
  failureSummary: ReturnType<typeof buildFailureSummary>;
  score: VersionScore;
  usage: AgentUsage[];
};

async function maybeRepairVersion(options: {
  rootDir: string;
  config: MatrixConfig;
  trajectory: TrajectoryPlan;
  runType: RunType;
  useMockOpenCode: boolean;
  mockProfile: string;
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

  let previousFailureSummary = options.failureSummary;
  let totalDurationMs = 0;
  const usages: AgentUsage[] = [];
  let lastResult: Omit<RepairResult, "attempts" | "success" | "durationMs" | "usage"> | null = null;

  for (let attempt = 1; attempt <= options.maxRepairAttempts; attempt += 1) {
    const repairArtifactsPath = path.join(options.artifactsPath, `repair-${attempt}`);
    const repairPrompt = await compileRepairPrompt({
      rootDir: options.rootDir,
      trajectory: options.trajectory,
      versionId: options.versionId,
      artifactsPath: repairArtifactsPath,
      failedVersionId: options.versionId,
      failedChecks: previousFailureSummary.failed_checks,
      failureMessages: previousFailureSummary.messages,
      artifactPaths: previousFailureSummary.artifact_paths
    });
    const repairOpenCode = options.useMockOpenCode
      ? await runMockOpenCode(options.workspacePath, repairArtifactsPath, options.evolutionStepIndex, options.mockProfile, attempt)
      : await runOpenCode({
          model: options.trajectory.providerModel,
          cwd: options.workspacePath,
          prompt: repairPrompt.prompt,
          promptPath: repairPrompt.promptPath,
          title: `${options.trajectory.trajectoryId}:${options.versionId}:repair-${attempt}`,
          artifactsPath: repairArtifactsPath,
          format: options.config.opencode.format,
          autoApprove: options.config.opencode.autoApprove,
          timeoutMs: options.config.opencode.timeoutMs,
          maxAttempts: Math.min(options.config.opencode.maxAttempts, options.config.opencode.maxContinuations + 1),
          purpose: "repair"
        });
    totalDurationMs += repairOpenCode.durationMs;
    usages.push(repairOpenCode.parsed.usage);
    await captureGitDiff(options.workspacePath, path.join(repairArtifactsPath, "git.diff"));

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
    await commitWorkspaceVersion(options.workspacePath, `${options.versionId}-repair-${attempt}`, repairArtifactsPath);
    const success = repairOpenCode.ok && evaluation.status === "passed";
    await writeRepairSummary(options.artifactsPath, repairArtifactsPath, {
      version_id: options.versionId,
      attempt,
      status: success ? "passed" : "failed",
      repair_success: success,
      failed_checks_before_repair: previousFailureSummary.failed_checks,
      failed_checks_after_repair: failureSummary.failed_checks,
      artifacts_path: repairArtifactsPath,
      prompt_path: repairPrompt.promptPath,
      usage: repairOpenCode.parsed.usage
    });
    lastResult = { artifactsPath: repairArtifactsPath, evaluation, failureSummary, score };
    if (success) {
      return { attempts: attempt, success: true, durationMs: totalDurationMs, usage: usages, ...lastResult };
    }
    previousFailureSummary = failureSummary;
  }

  if (!lastResult) return null;
  return { attempts: options.maxRepairAttempts, success: false, durationMs: totalDurationMs, usage: usages, ...lastResult };
}

function combineVersionUsage(generationUsage: AgentUsage, repairUsage: AgentUsage[]): AgentUsage {
  const usages = [generationUsage, ...repairUsage];
  if (usages.every((usage) => usage.status === "complete" && usage.totalTokens !== null)) {
    return {
      status: "complete",
      inputTokens: sumUsage(usages, "inputTokens"),
      outputTokens: sumUsage(usages, "outputTokens"),
      reasoningTokens: sumUsage(usages, "reasoningTokens"),
      cacheReadTokens: sumUsage(usages, "cacheReadTokens"),
      cacheWriteTokens: sumUsage(usages, "cacheWriteTokens"),
      totalTokens: sumUsage(usages, "totalTokens"),
      reportedCost: sumUsage(usages, "reportedCost"),
      currency: new Set(usages.map((usage) => usage.currency)).size === 1 ? usages[0]!.currency : null,
      source: new Set(usages.map((usage) => usage.source)).size === 1 ? usages[0]!.source : "unavailable"
    };
  }
  return usages.some((usage) => usage.totalTokens !== null) ? { ...unavailableAgentUsage(), status: "partial" } : unavailableAgentUsage();
}

function sumUsage(usages: AgentUsage[], field: keyof Pick<AgentUsage, "inputTokens" | "outputTokens" | "reasoningTokens" | "cacheReadTokens" | "cacheWriteTokens" | "totalTokens" | "reportedCost">): number | null {
  return usages.every((usage) => usage[field] !== null) ? usages.reduce((total, usage) => total + (usage[field] as number), 0) : null;
}

function shouldAttemptRepair(failedChecks: string[]): boolean {
  return failedChecks.some((check) => check === "build" || check === "e2e" || check === "values");
}

async function runMockOpenCode(
  workspacePath: string,
  artifactsPath: string,
  evolutionStepIndex?: number,
  profile = "happy",
  repairAttempt = 0
): Promise<OpenCodeRunResult> {
  const startedAt = Date.now();
  const versionId = `v${(evolutionStepIndex ?? -1) + 1}`;
  const fail =
    (profile === "opencode-fail-v0" && evolutionStepIndex === undefined) ||
    (profile === "opencode-fail-v2" && evolutionStepIndex === 1) ||
    (profile === "timeout-v0" && evolutionStepIndex === undefined);
  const variant = mockVariantForEvolutionStep(evolutionStepIndex);
  if (!fail) {
    await writeMockTodoMvc(workspacePath, variant);
    if (profile === "alternative-dom") {
      await applyAlternativeDomFixture(workspacePath);
    }
    if (profile === "intentionally-broken") {
      await applyBrokenFixture(workspacePath);
    }
    if (profile === "build-fail-v2-repair-success" && evolutionStepIndex === 1 && repairAttempt < 2) {
      await writeFile(path.join(workspacePath, "src", "main.tsx"), "this is intentionally invalid TypeScript\n", "utf8");
    }
    if (profile === "e2e-fail-v2-repair-fail" && evolutionStepIndex === 1) {
      const mainPath = path.join(workspacePath, "src", "main.tsx");
      const source = await readFile(mainPath, "utf8");
      await writeFile(mainPath, source.replace('aria-label="Search"', 'aria-label="Unavailable"'), "utf8");
    }
  }
  await ensureDir(artifactsPath);
  const eventLine = JSON.stringify({ type: "text.delta", sessionId: "mock", delta: fail ? "mock failure" : `generated ${variant}` });
  const usageLine = profile === "usage-complete"
    ? `${JSON.stringify({ type: "usage", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, reportedCost: 0.001, currency: "USD" } })}\n`
    : "";
  const events = profile === "malformed-events" ? `${eventLine}\n${usageLine}not-json\n` : `${eventLine}\n${usageLine}`;
  await writeFile(path.join(artifactsPath, "opencode.stdout.log"), events, "utf8");
  await writeFile(path.join(artifactsPath, "opencode.stderr.log"), fail ? `mock profile ${profile} failed ${versionId}\n` : "", "utf8");
  await writeFile(
    path.join(artifactsPath, "opencode.events.jsonl"),
    events,
    "utf8"
  );
  const eventsPath = path.join(artifactsPath, "opencode.events.jsonl");
  const parsed = parseOpenCodeEvents(await readFile(eventsPath, "utf8"));
  const resultPath = path.join(artifactsPath, "opencode-result.json");
  const assistantResponsePath = path.join(artifactsPath, "assistant-response.md");
  await writeFile(resultPath, JSON.stringify(parsed, null, 2), "utf8");
  await writeFile(assistantResponsePath, parsed.assistantText, "utf8");
  await writeFile(path.join(artifactsPath, "opencode-attempts.json"), JSON.stringify({ max_attempts: 1, attempts: [{ attempt: 1, ok: !fail, durationMs: Date.now() - startedAt, artifactsPath }] }, null, 2), "utf8");
  return {
    ok: !fail,
    exitCode: fail ? null : 0,
    durationMs: Date.now() - startedAt,
    stdoutPath: path.join(artifactsPath, "opencode.stdout.log"),
    stderrPath: path.join(artifactsPath, "opencode.stderr.log"),
    eventsPath,
    resultPath,
    assistantResponsePath,
    parsed,
    attempts: [{
      attempt: 1,
      purpose: "implementation",
      ok: !fail,
      durationMs: Date.now() - startedAt,
      artifactsPath,
      sessionId: "mock",
      continuedSessionId: null,
      continuationFallback: false,
      failureClassification: fail ? "technical_interruption" : "none"
    }],
    ...(fail ? { error: profile === "timeout-v0" ? `Timed out after mock profile ${profile}` : `mock profile ${profile} failed ${versionId}` } : {})
  };
}

async function applyAlternativeDomFixture(workspacePath: string): Promise<void> {
  const mainPath = path.join(workspacePath, "src", "main.tsx");
  const stylesPath = path.join(workspacePath, "src", "styles.css");
  const source = await readFile(mainPath, "utf8");
  const alternative = source
    .replace('const storageKey = "todos";', 'const storageKey = "alternative-todos";')
    .replace('<main className="todo-app" aria-label="TodoMVC">', '<section className="task-surface" aria-label="TodoMVC">')
    .replace('</main>', '</section>')
    .replace('className="todo-list"', 'className="task-rows"')
    .replace('className="tags"', 'className="task-labels"');
  await writeFile(mainPath, alternative, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  await writeFile(stylesPath, styles.replaceAll(".todo-app", ".task-surface").replaceAll(".todo-list", ".task-rows").replaceAll(".tags", ".task-labels"), "utf8");
}

async function applyBrokenFixture(workspacePath: string): Promise<void> {
  const mainPath = path.join(workspacePath, "src", "main.tsx");
  const source = await readFile(mainPath, "utf8");
  await writeFile(mainPath, source.replace('if (filter === "completed" && !todo.completed) {', 'if (false && filter === "completed" && !todo.completed) {'), "utf8");
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
  const matrixRoot = path.join(rootDir, config.outputDir, config.id);
  const logger = new EventLogger(matrixRoot, config.id);

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
  const configOption = stringOption(args, "config", "configs/mvp.yaml");
  const configPath = resolveFromRoot(rootDir, configOption);
  const dryRun = booleanOption(args, "dry-run", false);
  const config = await loadMatrixConfig(configPath);
  const matrixRoot = path.join(rootDir, config.outputDir, config.id);
  const maxTrajectories = optionalNumberOption(args, "max-trajectories");
  const requestedVersions = optionalNumberOption(args, "versions") ?? (dryRun ? config.maxVersions : 0);
  const runType = readRunType(args, booleanOption(args, "mock-opencode", false));
  const mockProfile = stringOption(args, "mock-profile", "happy");
  const skipInstall = booleanOption(args, "skip-install", false);
  const plan = buildTrajectoryPlan(config).slice(0, maxTrajectories ?? undefined);
  const resumeExecutionId = optionalStringOption(args, "resume");
  const allowDirty = booleanOption(args, "allow-dirty", false);
  assertExecutionMode(args, resumeExecutionId);
  const resume = Boolean(resumeExecutionId);
  const execution = await createOrResumeExecution({
    rootDir,
    matrixRoot,
    configPath,
    config,
    trajectories: plan,
    runType,
    requestedVersions,
    mockProfile: runType === "mock" ? mockProfile : null,
    allowDirty,
    ...(resumeExecutionId ? { resumeExecutionId } : {})
  });
  const runDir = execution.rootPath;
  const logger = new EventLogger(runDir, config.id);

  await logger.write({
    level: "info",
    phase: "run_matrix",
    event: dryRun ? "dry_run_started" : "started",
    data: {
      trajectories: plan.length,
      versionsPerTrajectory: requestedVersions + 1,
      runType,
      resume
    }
  });

  console.log(`matrix id: ${config.id}`);
  console.log(`execution: ${execution.executionId}${execution.resumed ? " (resumed)" : ""}`);
  console.log(`trajectories: ${plan.length}`);
  console.log(`version steps: ${plan.length * (requestedVersions + 1)}`);
  console.log(`concurrency: ${config.concurrency}`);
  console.log(`run type: ${runType}`);
  console.log(`edit versions: ${requestedVersions}`);
  console.log(`resume: ${resume}`);

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
    const result = await executeMatrix({
      rootDir,
      config,
      configOption,
      runDir,
      executionId: execution.executionId,
      plan,
      runType,
      mockProfile,
      requestedVersions,
      skipInstall,
      resume
    });
    const aggregate = await aggregateRun(runDir);
    await finalizeExecution(execution, result.failed === 0 ? "completed" : "failed");
    await logger.write({
      level: result.failed === 0 ? "info" : "warn",
      phase: "run_matrix",
      event: "completed",
      data: {
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        aggregate
      }
    });
    console.log(`matrix completed: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
    console.log(`leaderboard: ${aggregate.outputs.leaderboardMd}`);
    if (result.failed > 0) {
      process.exitCode = 1;
    }
    return;
  }

  await logger.write({
    level: "info",
    phase: "run_matrix",
    event: "dry_run_completed",
    data: {
      firstTrajectory: plan[0]?.trajectoryId ?? null
    }
  });
  await finalizeExecution(execution, "completed");
}

async function executeMatrix(options: {
  rootDir: string;
  config: MatrixConfig;
  configOption: string;
  runDir: string;
  executionId: string;
  plan: TrajectoryPlan[];
  runType: RunType;
  mockProfile: string;
  requestedVersions: number;
  skipInstall: boolean;
  resume: boolean;
}): Promise<{ passed: number; failed: number; skipped: number }> {
  const state = {
    nextIndex: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };
  const concurrency = Math.max(1, Math.min(options.config.concurrency, options.plan.length || 1));
  await ensureDir(path.join(options.runDir, "matrix"));

  async function worker(): Promise<void> {
    while (state.nextIndex < options.plan.length) {
      const index = state.nextIndex;
      state.nextIndex += 1;
      const trajectory = options.plan[index];
      if (!trajectory) {
        continue;
      }
      const summaryPath = path.join(options.runDir, "artifacts", trajectory.trajectoryId, "trajectory-summary.json");
      if (options.resume && (await pathExists(summaryPath))) {
        state.skipped += 1;
        console.log(`[${index + 1}/${options.plan.length}] skipped existing ${trajectory.trajectoryId}`);
        continue;
      }

      console.log(`[${index + 1}/${options.plan.length}] running ${trajectory.trajectoryId}`);
      const logPath = path.join(options.runDir, "matrix", `${trajectory.trajectoryId}.log`);
      const commandArgs = [
        "--import",
        "tsx",
        "packages/runner/src/cli.ts",
        "run-one",
        "--config",
        options.configOption,
        "--task",
        trajectory.taskId,
        "--model",
        trajectory.modelId,
        "--system",
        trajectory.systemPromptId,
        "--user",
        trajectory.userPromptId,
        "--edit",
        trajectory.editPromptId,
        "--run",
        String(trajectory.runNumber),
        "--versions",
        String(options.requestedVersions),
        "--run-type",
        options.runType,
        "--matrix-child-resume",
        "--resume",
        options.executionId
      ];
      if (options.runType === "mock") {
        commandArgs.push("--mock-profile", options.mockProfile);
      }
      if (options.skipInstall) {
        commandArgs.push("--skip-install");
      }
      const result = await runCommand(process.execPath, commandArgs, options.rootDir, logPath, 60 * 60 * 1000);
      if (result.exitCode === 0) {
        state.passed += 1;
      } else {
        state.failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return {
    passed: state.passed,
    failed: state.failed,
    skipped: state.skipped
  };
}

async function aggregateCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml"));
  const config = await loadMatrixConfig(configPath);
  const matrixRoot = path.join(rootDir, config.outputDir, config.id);
  const executionIds = stringOption(args, "executions", optionalStringOption(args, "execution") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const runDirs = executionIds.length > 0 ? executionIds.map((id) => path.join(matrixRoot, "executions", id)) : [matrixRoot];
  for (const [index, runDir] of runDirs.entries()) {
    if (executionIds[index] && !(await pathExists(path.join(runDir, "execution-manifest.json")))) throw new Error(`Execution not found: ${executionIds[index]}`);
  }
  const result = runDirs.length === 1 ? await aggregateRun(runDirs[0]!) : await aggregateRuns(runDirs, path.join(matrixRoot, "aggregates", executionIds.join("__")));

  console.log(`aggregated trajectories: ${result.trajectoryCount}`);
  console.log(`aggregated versions: ${result.versionCount}`);
  console.log(`trajectory results: ${result.outputs.trajectoryResultsJsonl}`);
  console.log(`version results: ${result.outputs.versionResultsJsonl}`);
  console.log(`scores: ${result.outputs.scoresCsv}`);
  console.log(`leaderboard: ${result.outputs.leaderboardMd}`);
}

async function verifyRunCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const config = await loadMatrixConfig(resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml")));
  const executionId = stringOption(args, "execution", "");
  if (!executionId) throw new Error("verify-run requires --execution <execution-id>");
  const executionPath = path.join(rootDir, config.outputDir, config.id, "executions", executionId);
  const result = await verifyExecution(executionPath);
  const manifest = await createArtifactManifest(executionPath);
  await writeFile(path.join(executionPath, "artifact-manifest.json"), JSON.stringify({ files: manifest }, null, 2), "utf8");
  const proofPath = optionalStringOption(args, "proof");
  if (proofPath) {
    const proof = await readJsonFile<Pick<CompactProofRecord, "execution_id" | "execution_manifest_sha256" | "artifact_manifest_sha256">>(resolveFromRoot(rootDir, proofPath));
    if (proof.execution_id !== executionId) result.errors.push("proof execution_id differs from requested execution");
    if (proof.execution_manifest_sha256 !== await sha256File(path.join(executionPath, "execution-manifest.json"))) result.errors.push("proof execution manifest hash differs");
    if (proof.artifact_manifest_sha256 !== await sha256File(path.join(executionPath, "artifact-manifest.json"))) result.errors.push("proof artifact manifest hash differs");
    result.ok = result.errors.length === 0;
  }
  console.log(`verified files: ${result.files}`);
  for (const error of result.errors) console.log(`error: ${error}`);
  if (!result.ok) process.exitCode = 1;
}

type CompactProofRecord = {
  proof_schema_version: "0.2.0";
  tested_runner_commit: string | null;
  repo_dirty: boolean;
  execution_id: string;
  command: string;
  exit_code: number;
  execution_manifest_sha256: string;
  artifact_manifest_sha256: string;
  verified_files: number;
  run_type: RunType;
  trajectory_status: "passed" | "failed" | "mixed" | "unknown";
  created_at: string;
};

async function recordProofCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const config = await loadMatrixConfig(resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml")));
  const executionId = stringOption(args, "execution", "");
  const output = stringOption(args, "out", "");
  if (!executionId) throw new Error("record-proof requires --execution <execution-id>");
  if (!output) throw new Error("record-proof requires --out <proof-file>");
  const executionPath = path.join(rootDir, config.outputDir, config.id, "executions", executionId);
  const verification = await verifyExecution(executionPath);
  if (!verification.ok) throw new Error(`Cannot record proof: ${verification.errors.join("; ")}`);
  const artifactFiles = await createArtifactManifest(executionPath);
  const artifactManifestPath = path.join(executionPath, "artifact-manifest.json");
  await writeFile(artifactManifestPath, JSON.stringify({ files: artifactFiles }, null, 2), "utf8");
  const [manifest, summaries] = await Promise.all([
    readJsonFile<{
      source_commit: string | null;
      repo_dirty: boolean;
      run_type: RunType;
    }>(path.join(executionPath, "execution-manifest.json")),
    trajectorySummaries(executionPath)
  ]);
  if (manifest.run_type === "real" && manifest.repo_dirty && !booleanOption(args, "allow-dirty", false)) {
    throw new Error("Refusing proof record for dirty real execution. Use --allow-dirty only for debugging.");
  }
  const statuses = summaries.map((summary) => summary.first_failed_version === null ? "passed" : "failed");
  const trajectoryStatus: CompactProofRecord["trajectory_status"] = statuses.length === 0 ? "unknown" : statuses.every((status) => status === "passed") ? "passed" : statuses.every((status) => status === "failed") ? "failed" : "mixed";
  const record: CompactProofRecord = {
    proof_schema_version: "0.2.0",
    tested_runner_commit: manifest.source_commit,
    repo_dirty: manifest.repo_dirty,
    execution_id: executionId,
    command: stringOption(args, "command", "not recorded"),
    exit_code: numberOption(args, "exit-code", 0),
    execution_manifest_sha256: await sha256File(path.join(executionPath, "execution-manifest.json")),
    artifact_manifest_sha256: await sha256File(artifactManifestPath),
    verified_files: verification.files,
    run_type: manifest.run_type,
    trajectory_status: trajectoryStatus,
    created_at: new Date().toISOString()
  };
  const outputPath = resolveFromRoot(rootDir, output);
  await writeFile(outputPath, JSON.stringify(record, null, 2), "utf8");
  console.log(`proof record: ${outputPath}`);
}

async function readJsonFile<T>(file: string): Promise<T> { return JSON.parse(await readFile(file, "utf8")) as T; }
async function sha256File(file: string): Promise<string> { return createHash("sha256").update(await readFile(file)).digest("hex"); }
async function trajectorySummaries(executionPath: string): Promise<Array<{ first_failed_version: string | null }>> {
  const artifactsRoot = path.join(executionPath, "artifacts");
  const entries = await (await import("node:fs/promises")).readdir(artifactsRoot, { withFileTypes: true }).catch(() => []);
  return Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => readJsonFile<{ first_failed_version: string | null }>(path.join(artifactsRoot, entry.name, "trajectory-summary.json"))));
}

async function verifyOpenCodeParserCommand(): Promise<void> {
  const failures = verifyOpenCodeEventParserFixtures();
  if (failures.length) throw new Error(`OpenCode parser fixture failures: ${failures.join(", ")}`);
  console.log("OpenCode parser fixtures: passed");
}

async function verifyOpenCodeRetryCommand(): Promise<void> {
  const failures = await verifyOpenCodeRetryFixture();
  if (failures.length) throw new Error(`OpenCode retry fixture failures: ${failures.join(", ")}`);
  console.log("OpenCode retry fixture: passed");
}

async function verifyLifecyclePreflightCommand(): Promise<void> {
  const failures = await verifyLifecyclePreflightFixture(process.cwd());
  if (failures.length) throw new Error(`Lifecycle preflight fixture failures: ${failures.join(", ")}`);
  console.log("Lifecycle preflight fixture: passed");
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
  const sourceWorkspaceOption = optionalStringOption(args, "source-workspace");
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
  const sourceWorkspacePath = sourceWorkspaceOption ? resolveFromRoot(rootDir, sourceWorkspaceOption) : undefined;
  if (sourceWorkspacePath && !(await pathExists(sourceWorkspacePath))) throw new Error(`Source workspace not found: ${sourceWorkspacePath}`);
  const preflightWorkspace = await prepareNegotiationWorkspace({ rootDir, runDir, scaffoldPath, negotiationId, taskId, model, systemPromptId, scenario, runNumber, phase: "preflight", ...(sourceWorkspacePath ? { sourceWorkspacePath } : {}) });
  const result = await runNegotiationPreflight({
    artifactsPath,
    scenario,
    runType,
    providerModel: model.providerModel,
    workspacePath: preflightWorkspace.workspacePath,
    opencodeFormat: config.opencode.format,
    autoApprove: config.opencode.autoApprove,
    timeoutMs: config.opencode.timeoutMs,
    maxAttempts: config.opencode.maxAttempts,
    maxContinuations: config.opencode.maxContinuations,
    currentAppContext: await negotiationWorkspaceContext({ taskDir, workspacePath: preflightWorkspace.workspacePath, scenario })
  });
  const preflightDiffPath = path.join(artifactsPath, "preflight.git.diff");
  await captureGitDiff(preflightWorkspace.workspacePath, preflightDiffPath);
  const preflightDiff = await readFile(preflightDiffPath, "utf8");
  await writeFile(
    path.join(artifactsPath, "protocol-violation.json"),
    JSON.stringify({ preflight_workspace: preflightWorkspace.workspacePath, changed_files: preflightDiff ? true : false, protocol_violation: preflightDiff ? "preflight_modified_workspace" : null }, null, 2),
    "utf8"
  );
  const protocolViolation = preflightDiff ? "preflight_modified_workspace" : null;
  const validClarification = result.decision.decision === "clarify" && !protocolViolation;
  let implementationEvaluated = false;
  if (full && validClarification) {
    const implementationWorkspace = await prepareNegotiationWorkspace({ rootDir, runDir, scaffoldPath, negotiationId, taskId, model, systemPromptId, scenario, runNumber, phase: "implementation", ...(sourceWorkspacePath ? { sourceWorkspacePath } : {}) });
    await runFullNegotiationImplementation({
      taskId,
      scenario,
      runType,
      model,
      config,
      workspacePath: implementationWorkspace.workspacePath,
      artifactsPath: path.join(artifactsPath, "implementation"),
      skipInstall
    });
    implementationEvaluated = true;
  }
  await writeFile(
    path.join(artifactsPath, "negotiation-result.json"),
    JSON.stringify(
      {
        harness_protocol_result: protocolViolation ? "violation_detected" : "passed",
        agent_negotiation_result: result.score.clarification_score > 0 ? "scored" : "invalid_or_unscored",
        agent_decision: result.decision.decision,
        agent_decision_score: result.score.clarification_score,
        implementation_evaluated: implementationEvaluated,
        implementation_skip_reason: implementationEvaluated ? null : full ? protocolViolation ? protocolViolation : "oracle_answer_requires_valid_clarification" : "not_requested"
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`negotiation: ${negotiationId}`);
  console.log(`run type: ${runType}`);
  console.log(`full: ${full}`);
  console.log(`decision: ${result.decision.decision}`);
  console.log(`score: ${result.score.clarification_score.toFixed(2)}`);
  console.log(`artifacts: ${artifactsPath}`);
}

async function prepareNegotiationWorkspace(options: {
  rootDir: string;
  runDir: string;
  scaffoldPath: string;
  negotiationId: string;
  taskId: string;
  model: MatrixConfig["models"][number];
  systemPromptId: string;
  scenario: Awaited<ReturnType<typeof loadNegotiationScenario>>;
  runNumber: number;
  phase: "preflight" | "implementation";
  sourceWorkspacePath?: string;
}): Promise<{ workspacePath: string }> {
  const trajectory = {
    trajectoryId: `negotiation-${options.phase}__${options.negotiationId}`,
    taskId: options.taskId,
    modelId: options.model.id,
    providerModel: options.model.providerModel,
    systemPromptId: options.systemPromptId,
    userPromptId: "negotiation",
    editPromptId: options.scenario.id,
    runNumber: options.runNumber,
    versions: [options.scenario.version]
  };
  if (!options.sourceWorkspacePath) {
    return prepareWorkspace({ rootDir: options.rootDir, runDir: options.runDir, scaffoldPath: options.scaffoldPath, trajectory, executionId: `negotiation-${options.phase}-${options.negotiationId}` });
  }
  const workspacePath = path.join(options.runDir, "workspaces", trajectory.trajectoryId);
  if (await pathExists(workspacePath)) return { workspacePath };
  await ensureDir(path.dirname(workspacePath));
  await copyDirFiltered(options.sourceWorkspacePath, workspacePath);
  const gitLogs = path.join(workspacePath, ".ape-negotiation-git");
  await runCommand("git", ["init"], workspacePath, `${gitLogs}-init.log`, 30000);
  await runCommand("git", ["config", "user.email", "ape-benchmark@example.local"], workspacePath, `${gitLogs}-email.log`, 30000);
  await runCommand("git", ["config", "user.name", "APE Benchmark"], workspacePath, `${gitLogs}-name.log`, 30000);
  await runCommand("git", ["add", "."], workspacePath, `${gitLogs}-add.log`, 30000);
  await runCommand("git", ["commit", "-m", "negotiation-source-snapshot"], workspacePath, `${gitLogs}-commit.log`, 30000);
  return { workspacePath };
}

async function negotiationWorkspaceContext(options: { taskDir: string; workspacePath: string; scenario: Awaited<ReturnType<typeof loadNegotiationScenario>> }): Promise<string> {
  const [tree, taskYaml, testFiles] = await Promise.all([
    compactFileTree(options.workspacePath, 80),
    readFile(path.join(options.taskDir, "task.yaml"), "utf8"),
    compactFileTree(path.join(options.taskDir, "tests"), 80)
  ]);
  const evolution = await loadTaskEvolution(options.taskDir);
  const versionNumber = Number(options.scenario.version.replace(/^v/, ""));
  const applied = Number.isInteger(versionNumber) && versionNumber > 0 ? evolution.slice(0, versionNumber).map((step) => step.id) : [];
  return [
    `Current version: ${options.scenario.version}`,
    `Applied evolution steps: ${applied.length ? applied.join(", ") : "none"}`,
    "Current requirement checklist:",
    taskYaml,
    "Current workspace file tree:",
    tree,
    "Current test inventory:",
    testFiles,
    "Known current failures: none supplied; inspect only, do not edit."
  ].join("\n");
}

async function compactFileTree(root: string, limit: number): Promise<string> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    if (files.length >= limit) return;
    for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
      if (["node_modules", ".git", "dist", "coverage", "playwright-report"].includes(entry.name)) continue;
      const item = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(item); else if (entry.isFile()) files.push(path.relative(root, item));
      if (files.length >= limit) return;
    }
  }
  await visit(root);
  return [...files.sort(), files.length >= limit ? "... truncated" : ""].filter(Boolean).join("\n");
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
          timeoutMs: options.config.opencode.timeoutMs,
          maxAttempts: Math.min(options.config.opencode.maxAttempts, options.config.opencode.maxContinuations + 1)
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
  const matrixRoot = path.join(rootDir, config.outputDir, config.id);
  const executionId = optionalStringOption(args, "execution");
  const runDir = executionId ? path.join(matrixRoot, "executions", executionId) : matrixRoot;
  const outPath = resolveFromRoot(rootDir, stringOption(args, "out", path.join("jury-packets", trajectoryId)));
  const strictBlind = booleanOption(args, "strict-blind", false);
  const blindMode: JuryBlindMode = strictBlind ? "strict" : booleanOption(args, "blind", false) ? "light" : "none";
  const result = await exportJuryPacket({
    rootDir,
    runDir,
    trajectoryId,
    outPath,
    blindMode
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
  const matrixRoot = path.join(rootDir, config.outputDir, config.id);
  const executionId = optionalStringOption(args, "execution");
  const runDir = executionId ? path.join(matrixRoot, "executions", executionId) : matrixRoot;
  const result = await importJuryReview({
    runDir,
    trajectoryId,
    reviewPath,
    reviewerId
  });

  console.log(`imported review: ${result.reviewPath}`);
}

async function exportJuryPairCommand(args: CliArgs): Promise<void> {
  const rootDir = process.cwd();
  const config = await loadMatrixConfig(resolveFromRoot(rootDir, stringOption(args, "config", "configs/mvp.yaml")));
  const matrixRoot = path.join(rootDir, config.outputDir, config.id);
  const leftExecution = stringOption(args, "left-execution", "");
  const leftTrajectory = stringOption(args, "left-trajectory", "");
  const rightExecution = stringOption(args, "right-execution", "");
  const rightTrajectory = stringOption(args, "right-trajectory", "");
  if (!leftExecution || !leftTrajectory || !rightExecution || !rightTrajectory) {
    throw new Error("export-jury-pair requires --left-execution, --left-trajectory, --right-execution and --right-trajectory");
  }
  const outPath = resolveFromRoot(rootDir, stringOption(args, "out", "jury-packets/pairwise"));
  const leftRunDir = path.join(matrixRoot, "executions", leftExecution);
  const rightRunDir = path.join(matrixRoot, "executions", rightExecution);
  for (const runDir of [leftRunDir, rightRunDir]) if (!(await pathExists(path.join(runDir, "execution-manifest.json")))) throw new Error(`Execution not found: ${path.basename(runDir)}`);
  const [left, right] = await Promise.all([
    exportJuryPacket({ rootDir, runDir: leftRunDir, trajectoryId: leftTrajectory, outPath: path.join(outPath, "Variant-A"), blindMode: "strict" }),
    exportJuryPacket({ rootDir, runDir: rightRunDir, trajectoryId: rightTrajectory, outPath: path.join(outPath, "Variant-B"), blindMode: "strict" })
  ]);
  const mappingDir = path.join(matrixRoot, "jury-pairwise-mappings");
  await ensureDir(mappingDir);
  const mappingPath = path.join(mappingDir, `${new Date().toISOString().replace(/[^0-9]/g, "")}.json`);
  await writeFile(mappingPath, JSON.stringify({ variant_a: { execution_id: leftExecution, trajectory_id: leftTrajectory }, variant_b: { execution_id: rightExecution, trajectory_id: rightTrajectory } }, null, 2), "utf8");
  console.log(`pairwise packet: ${outPath}`);
  console.log(`variant A files: ${left.files.length}`);
  console.log(`variant B files: ${right.files.length}`);
  console.log(`private mapping: ${mappingPath}`);
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

function optionalStringOption(args: CliArgs, key: string): string | undefined {
  if (!args.options.has(key)) return undefined;
  return stringOption(args, key, "");
}

function assertExecutionMode(args: CliArgs, resumeExecutionId: string | undefined): void {
  const fresh = booleanOption(args, "fresh", false);
  const forceNewExecution = booleanOption(args, "force-new-execution", false);
  if (resumeExecutionId && (fresh || forceNewExecution)) {
    throw new Error("--resume cannot be combined with --fresh or --force-new-execution");
  }
}

function printHelp(): void {
  console.log(`Usage:
  pnpm bench init
  pnpm bench validate-task tasks/todomvc
  pnpm bench preflight --config configs/mvp.yaml
  pnpm bench doctor --config configs/mvp.yaml
  pnpm bench eval --workspace scaffolds/vite-react-ts --task todomvc --version v0
  pnpm bench eval --workspace <workspace> --task todomvc --version v1 --evolution-step-index 0
  pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --edit E2-smallest-maintainable-change --dry-run
  pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --edit E2-smallest-maintainable-change --mock-opencode
  pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U5-maintainable --edit E2-smallest-maintainable-change --versions 4 --run-type mock
  pnpm bench run-one --task todomvc ... --fresh
  pnpm bench run-one --task todomvc ... --run-type real --allow-dirty
  pnpm bench run-one --task todomvc ... --resume <execution-id>
  pnpm bench run-matrix --config configs/mvp.yaml --dry-run
  pnpm bench aggregate --config configs/mvp.yaml --execution <execution-id>
  pnpm bench aggregate --config configs/mvp.yaml --executions <execution-id>,<execution-id>
  pnpm bench verify-run --execution <execution-id>
  pnpm bench record-proof --execution <execution-id> --out proof/<name>.json --command "pnpm bench run-one ..."
  pnpm bench verify-opencode-parser
  pnpm bench verify-opencode-retry
  pnpm bench verify-lifecycle-preflight
  pnpm bench negotiate-one --task todomvc --scenario 03-underspecified-tags --model deepseek-v4-flash-free --system S2-maintainable-simple --run-type mock
  pnpm bench negotiate-one --task todomvc --scenario 03-underspecified-tags --model deepseek-v4-flash-free --system S2-maintainable-simple --run-type mock --full
  pnpm bench export-jury-packet --trajectory <trajectory-id> --blind --out jury-packets/<packet-id>
  pnpm bench export-jury-packet --trajectory <trajectory-id> --strict-blind --out jury-packets/<packet-id>
  pnpm bench export-jury-pair --left-execution <id> --left-trajectory <id> --right-execution <id> --right-trajectory <id> --out jury-packets/<packet-id>
  pnpm bench import-jury-review --trajectory <trajectory-id> --review jury-packets/<packet-id>/review-form.md --reviewer reviewer-1
`);
}

await main();
