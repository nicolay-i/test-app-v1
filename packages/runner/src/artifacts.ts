import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvaluationResult } from "./evaluator.js";
import type { VersionScore } from "./scoring.js";
import type { TrajectoryPlan } from "./types.js";
import type { AgentUsage } from "./opencodeEventParser.js";

export type RunType = "mock" | "real";

export type FailureClassification =
  | "none"
  | "infra_failure"
  | "model_failure"
  | "opencode_failure"
  | "harness_failure"
  | "unknown";

export type RunMetadata = {
  schema_version: "0.1.0";
  execution_id: string;
  run_type: RunType;
  task_id: string;
  model_id: string;
  provider_model: string;
  system_prompt_id: string;
  user_prompt_id: string;
  edit_prompt_id: string;
  run_number: number;
  version_id: string;
  workspace_path: string;
  artifacts_path: string;
  prompt_path: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "passed" | "failed" | "incomplete" | "aborted";
  failure_classification: FailureClassification;
};

export type FailureSummary = {
  status: "passed" | "failed";
  classification: FailureClassification;
  failed_phase: string | null;
  failed_checks: string[];
  infra_suspected: boolean;
  messages: string[];
  artifact_paths: Record<string, string | null>;
};

export type DiffMetrics = {
  files_touched: number;
  lines_added: number;
  lines_deleted: number;
  rewrite_ratio: number;
  package_json_changed: boolean;
};

export type FeedbackEvent = {
  kind: "preflight" | "clarification" | "repair" | "continuation" | "human_prompt_correction" | "human_acceptance_correction" | "human_code_edit";
  automatic: boolean;
  source: "none" | "oracle_answer" | "scenario_answer" | "human_answer" | "human_prompt_correction" | "human_acceptance_correction" | "human_code_edit";
  round: number | null;
  question_count: number;
  answer_words: number;
  manual_files_changed?: number;
  manual_lines_added?: number;
  manual_lines_deleted?: number;
  artifacts_path: string;
};

export type TrajectoryVersionSummary = {
  version_id: string;
  status: "passed" | "failed" | "incomplete" | "aborted";
  score: number | null;
  failure_classification: FailureClassification;
  failed_phase: string | null;
  evaluation_completed: boolean;
  failed_checks: string[];
  repair_attempts: number;
  repair_success: boolean;
  loc_total: number | null;
  largest_file_loc: number | null;
  code_health: {
    duplicate_ratio: number | null;
    dependency_cycles: number | null;
    max_cyclomatic_complexity: number | null;
  };
  diff: DiffMetrics;
  generation_usage: AgentUsage;
  preflight_usage: AgentUsage[];
  clarification_usage: AgentUsage[];
  repair_usage: AgentUsage[];
  version_total_usage: AgentUsage;
  feedback_events: FeedbackEvent[];
  artifacts_path: string;
};

export type TrajectorySummary = {
  schema_version: "0.1.0";
  trajectory_id: string;
  run_type: RunType;
  task_id: string;
  model_id: string;
  system_prompt_id: string;
  user_prompt_id: string;
  edit_prompt_id: string;
  run_number: number;
  total_versions_requested: number;
  survived_versions: number;
  first_failed_version: string | null;
  regression_failures_total: number;
  repair_attempts_total: number;
  repair_successes_total: number;
  total_tokens: number | null;
  lifecycle_usage: AgentUsage;
  lifecycle_reported_cost: number | null;
  survival_rate: number;
  regression_free_versions: number;
  repair_free_versions: number;
  quality_degradation_slope: number | null;
  lifecycle_tokens: number | null;
  tokens_per_passing_version: number | null;
  usage_complete: boolean;
  tokens_per_attempted_version: number | null;
  total_latency_ms: number;
  total_files_touched: number;
  total_lines_added: number;
  total_lines_deleted: number;
  largest_file_growth: number;
  loc_growth: number;
  score_by_version: Record<string, number | null>;
  repair_token_ratio: number | null;
  successful_versions_per_100k_tokens: number | null;
  quality_adjusted_survival_per_100k_tokens: number | null;
  required_supervision: {
    versions_requiring_clarification: number;
    clarification_rounds: number;
    questions_total: number;
    answer_words: number;
    clarification_limit_reached: number;
  };
  actual_human_activity: {
    human_answers_total: number;
    human_answer_words: number;
    human_prompt_corrections: number;
    human_acceptance_corrections: number;
    human_code_edits: number;
    manual_files_changed: number;
    manual_lines_added: number;
    manual_lines_deleted: number;
  };
  versions: TrajectoryVersionSummary[];
};

export type TrajectoryMetadata = {
  schema_version: "0.1.0";
  trajectory_id: string;
  run_type: RunType;
  task_id: string;
  model_id: string;
  system_prompt_id: string;
  user_prompt_id: string;
  edit_prompt_id: string;
  run_number: number;
  total_versions_requested: number;
  artifacts_path: string;
  generated_at: string;
};

export type RepairSummary = {
  version_id: string;
  attempt: number;
  status: "passed" | "failed";
  repair_success: boolean;
  failed_checks_before_repair: string[];
  failed_checks_after_repair: string[];
  artifacts_path: string;
  prompt_path: string;
  usage: AgentUsage;
};

export function unavailableAgentUsage(): AgentUsage {
  return {
    status: "unavailable",
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    totalTokens: null,
    reportedCost: null,
    currency: null,
    source: "unavailable"
  };
}

export function buildInitialRunMetadata(options: {
  runType: RunType;
  executionId: string;
  trajectory: TrajectoryPlan;
  versionId: string;
  workspacePath: string;
  artifactsPath: string;
  promptPath: string;
  startedAt: string;
}): RunMetadata {
  return {
    schema_version: "0.1.0",
    execution_id: options.executionId,
    run_type: options.runType,
    task_id: options.trajectory.taskId,
    model_id: options.trajectory.modelId,
    provider_model: options.trajectory.providerModel,
    system_prompt_id: options.trajectory.systemPromptId,
    user_prompt_id: options.trajectory.userPromptId,
    edit_prompt_id: options.trajectory.editPromptId,
    run_number: options.trajectory.runNumber,
    version_id: options.versionId,
    workspace_path: options.workspacePath,
    artifacts_path: options.artifactsPath,
    prompt_path: options.promptPath,
    started_at: options.startedAt,
    completed_at: null,
    status: "running",
    failure_classification: "none"
  };
}

export async function writeRunMetadata(artifactsPath: string, metadata: RunMetadata): Promise<void> {
  await writeFile(path.join(artifactsPath, "run-metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
}

export function buildFailureSummary(evaluation: EvaluationResult): FailureSummary {
  const failedChecks = Object.entries(evaluation.checks)
    .filter(([, check]) => check.status === "failed")
    .map(([name]) => name);
  const failedPhase = failedChecks[0] ?? null;
  const classification = classifyFailure(evaluation, failedPhase);
  const messages = Object.entries(evaluation.checks)
    .filter(([, check]) => check.status === "failed")
    .map(([name, check]) => `${name}: ${check.message ?? "failed"}`);

  return {
    status: evaluation.status === "passed" ? "passed" : "failed",
    classification,
    failed_phase: failedPhase,
    failed_checks: failedChecks,
    infra_suspected: classification === "infra_failure",
    messages,
    artifact_paths: {
      install_log: relativeArtifactPath(evaluation, evaluation.checks.install.log_path),
      build_log: relativeArtifactPath(evaluation, evaluation.checks.build.log_path),
      runtime_smoke_log: relativeArtifactPath(evaluation, evaluation.checks.runtimeSmoke.log_path),
      e2e_log: relativeArtifactPath(evaluation, evaluation.checks.e2e.log_path),
      values_log: relativeArtifactPath(evaluation, evaluation.checks.values.log_path),
      visual_log: relativeArtifactPath(evaluation, evaluation.checks.visual.log_path),
      metrics: "metrics.json",
      check_results: "check-results.json"
    }
  };
}

export async function writeFailureSummary(artifactsPath: string, summary: FailureSummary): Promise<void> {
  await writeFile(path.join(artifactsPath, "failure-summary.json"), JSON.stringify(summary, null, 2), "utf8");
}

export async function writeRunReport(options: {
  artifactsPath: string;
  metadata: RunMetadata;
  evaluation: EvaluationResult;
  score: VersionScore;
  failureSummary: FailureSummary;
}): Promise<void> {
  const { metadata, evaluation, score, failureSummary } = options;
  const report = [
    "# Run Summary",
    "",
    `Task: ${metadata.task_id}`,
    `Model: ${metadata.model_id}`,
    `Provider model: ${metadata.provider_model}`,
    `Run type: ${metadata.run_type}`,
    `Prompt: ${metadata.user_prompt_id}`,
    `Status: ${metadata.status}`,
    `Eligible for leaderboard: ${score.eligible_for_leaderboard}`,
    "",
    "## Scores",
    "",
    `- build_runtime_score: ${formatScore(score.scores.build_runtime_score)}`,
    `- e2e_score: ${formatScore(score.scores.e2e_score)}`,
    `- value_score: ${formatScore(score.scores.value_score)}`,
    `- visual_smoke_score: ${formatScore(score.scores.visual_smoke_score)}`,
    `- visual_similarity_score: ${score.scores.visual_similarity_score ?? "not configured"}`,
    `- maintainability_score: ${formatScore(score.scores.maintainability_score)}`,
    `- runtime_error_penalty: ${formatScore(score.scores.runtime_error_penalty)}`,
    `- version_quality_smoke_score: ${formatScore(score.scores.version_quality_smoke_score)}`,
    "",
    "## Checks",
    "",
    `- install: ${evaluation.checks.install.status}`,
    `- build: ${evaluation.checks.build.status}`,
    `- runtime smoke: ${evaluation.checks.runtimeSmoke.status}`,
    `- e2e: ${evaluation.checks.e2e.status}`,
    `- values: ${evaluation.checks.values.status}`,
    `- visual capture: ${evaluation.checks.visual.status}`,
    "",
    "## Metrics",
    "",
    `- LOC: ${evaluation.metrics.code_health.loc_total}`,
    `- file count: ${evaluation.metrics.code_health.file_count}`,
    `- largest file: ${evaluation.metrics.code_health.largest_file.path || "n/a"} (${evaluation.metrics.code_health.largest_file.loc} LOC)`,
    "",
    "## Failure Summary",
    "",
    `- classification: ${failureSummary.classification}`,
    `- failed phase: ${failureSummary.failed_phase ?? "none"}`,
    `- messages: ${failureSummary.messages.length > 0 ? failureSummary.messages.join("; ") : "none"}`,
    "",
    "## Artifact Paths",
    "",
    `- workspace: ${metadata.workspace_path}`,
    `- artifacts: ${metadata.artifacts_path}`,
    `- prompt: ${metadata.prompt_path}`,
    `- check results: ${path.join(metadata.artifacts_path, "check-results.json")}`,
    `- metrics: ${path.join(metadata.artifacts_path, "metrics.json")}`,
    `- score: ${path.join(metadata.artifacts_path, "score.json")}`,
    `- failure summary: ${path.join(metadata.artifacts_path, "failure-summary.json")}`,
    ""
  ].join("\n");

  await writeFile(path.join(options.artifactsPath, "report.md"), report, "utf8");
}

export async function writeTerminalRunReport(options: {
  artifactsPath: string;
  metadata: RunMetadata;
  failureSummary: FailureSummary;
}): Promise<void> {
  await writeFile(
    path.join(options.artifactsPath, "report.md"),
    ["# Run Summary", "", `Task: ${options.metadata.task_id}`, `Status: ${options.metadata.status}`, "", "## Failure Summary", "", `- classification: ${options.failureSummary.classification}`, `- failed phase: ${options.failureSummary.failed_phase ?? "unknown"}`, `- messages: ${options.failureSummary.messages.join("; ") || "none"}`, ""].join("\n"),
    "utf8"
  );
}

export async function buildTerminalVersionSummary(options: {
  versionId: string;
  classification: FailureClassification;
  failedPhase: string;
  artifactsPath: string;
  generationUsage?: AgentUsage;
}): Promise<TrajectoryVersionSummary> {
  const generationUsage = options.generationUsage ?? unavailableAgentUsage();
  return {
    version_id: options.versionId,
    status: "failed",
    score: null,
    failure_classification: options.classification,
    failed_phase: options.failedPhase,
    evaluation_completed: false,
    failed_checks: [options.failedPhase],
    repair_attempts: 0,
    repair_success: false,
    loc_total: null,
    largest_file_loc: null,
    code_health: { duplicate_ratio: null, dependency_cycles: null, max_cyclomatic_complexity: null },
    diff: await readDiffMetrics(path.join(options.artifactsPath, "git.diff")),
    generation_usage: generationUsage,
    preflight_usage: [],
    clarification_usage: [],
    repair_usage: [],
    version_total_usage: generationUsage,
    feedback_events: [],
    artifacts_path: options.artifactsPath
  };
}

export async function readDiffMetrics(diffPath: string): Promise<DiffMetrics> {
  const diff = await readFile(diffPath, "utf8").catch(() => "");
  const files = new Set<string>();
  let linesAdded = 0;
  let linesDeleted = 0;
  let packageJsonChanged = false;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const filePath = match?.[2] ?? line;
      files.add(filePath);
      if (filePath === "package.json" || filePath.endsWith("/package.json")) {
        packageJsonChanged = true;
      }
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      linesAdded += 1;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      linesDeleted += 1;
    }
  }

  const churn = linesAdded + linesDeleted;
  return {
    files_touched: files.size,
    lines_added: linesAdded,
    lines_deleted: linesDeleted,
    rewrite_ratio: churn === 0 ? 0 : linesDeleted / churn,
    package_json_changed: packageJsonChanged
  };
}

export function buildTrajectorySummary(options: {
  trajectory: TrajectoryPlan;
  runType: RunType;
  versionsRequested: number;
  versions: TrajectoryVersionSummary[];
  totalLatencyMs: number;
}): TrajectorySummary {
  const failed = options.versions.find((version) => version.status !== "passed");
  const baseline = options.versions[0];
  const final = options.versions[options.versions.length - 1];
  const scoreByVersion = Object.fromEntries(options.versions.map((version) => [version.version_id, version.score]));
  const regressionFailuresTotal = options.versions.reduce(
    (total, version) => total + version.failed_checks.filter((check) => check === "e2e" || check === "values").length,
    0
  );
  const evaluatedScores = options.versions
    .map((version, index) => ({ index, score: version.score }))
    .filter((item): item is { index: number; score: number } => item.score !== null);
  const qualityDegradationSlope = evaluatedScores.length < 2
    ? null
    : linearSlope(evaluatedScores.map((item) => item.index), evaluatedScores.map((item) => item.score));
  const lifecycleUsage = aggregateUsage(options.versions.flatMap((version) => [version.generation_usage, ...version.preflight_usage, ...version.clarification_usage, ...version.repair_usage]));
  const lifecycleTokens = lifecycleUsage.status === "complete" ? lifecycleUsage.totalTokens : null;
  const lifecycleReportedCost = lifecycleUsage.status === "complete" ? lifecycleUsage.reportedCost : null;
  const successfulVersions = options.versions.filter((version) => version.status === "passed").length;
  const repairUsage = aggregateUsage(options.versions.flatMap((version) => version.repair_usage));
  const clarificationEvents = options.versions.flatMap((version) => version.feedback_events.filter((event) => event.kind === "clarification"));
  const humanEvents = options.versions.flatMap((version) => version.feedback_events.filter((event) => event.source === "human_answer"));
  const promptCorrections = options.versions.flatMap((version) => version.feedback_events.filter((event) => event.source === "human_prompt_correction"));
  const acceptanceCorrections = options.versions.flatMap((version) => version.feedback_events.filter((event) => event.source === "human_acceptance_correction"));
  const codeEdits = options.versions.flatMap((version) => version.feedback_events.filter((event) => event.source === "human_code_edit"));

  return {
    schema_version: "0.1.0",
    trajectory_id: options.trajectory.trajectoryId,
    run_type: options.runType,
    task_id: options.trajectory.taskId,
    model_id: options.trajectory.modelId,
    system_prompt_id: options.trajectory.systemPromptId,
    user_prompt_id: options.trajectory.userPromptId,
    edit_prompt_id: options.trajectory.editPromptId,
    run_number: options.trajectory.runNumber,
    total_versions_requested: options.versionsRequested,
    survived_versions: countSurvivedEditVersions(options.versions),
    first_failed_version: failed?.version_id ?? null,
    regression_failures_total: regressionFailuresTotal,
    repair_attempts_total: options.versions.reduce((total, version) => total + version.repair_attempts, 0),
    repair_successes_total: options.versions.filter((version) => version.repair_success).length,
    total_tokens: lifecycleTokens,
    lifecycle_usage: lifecycleUsage,
    lifecycle_reported_cost: lifecycleReportedCost,
    survival_rate: options.versions.length === 0 ? 0 : countSurvivedEditVersions(options.versions) / Math.max(1, options.versionsRequested),
    regression_free_versions: options.versions.filter((version) => !version.failed_checks.some((check) => check === "e2e" || check === "values")).length,
    repair_free_versions: options.versions.filter((version) => version.repair_attempts === 0).length,
    quality_degradation_slope: qualityDegradationSlope,
    lifecycle_tokens: lifecycleTokens,
    tokens_per_passing_version: lifecycleTokens !== null && successfulVersions > 0 ? lifecycleTokens / successfulVersions : null,
    usage_complete: lifecycleUsage.status === "complete",
    tokens_per_attempted_version: lifecycleTokens !== null && options.versions.length > 0 ? lifecycleTokens / options.versions.length : null,
    total_latency_ms: options.totalLatencyMs,
    total_files_touched: options.versions.reduce((total, version) => total + version.diff.files_touched, 0),
    total_lines_added: options.versions.reduce((total, version) => total + version.diff.lines_added, 0),
    total_lines_deleted: options.versions.reduce((total, version) => total + version.diff.lines_deleted, 0),
    largest_file_growth: final && baseline && final.largest_file_loc !== null && baseline.largest_file_loc !== null ? final.largest_file_loc - baseline.largest_file_loc : 0,
    loc_growth: final && baseline && final.loc_total !== null && baseline.loc_total !== null ? final.loc_total - baseline.loc_total : 0,
    score_by_version: scoreByVersion,
    repair_token_ratio: lifecycleTokens !== null && lifecycleTokens > 0
      ? options.versions.some((version) => version.repair_usage.length > 0)
        ? repairUsage.status === "complete" && repairUsage.totalTokens !== null ? repairUsage.totalTokens / lifecycleTokens : null
        : 0
      : null,
    successful_versions_per_100k_tokens: lifecycleTokens !== null && lifecycleTokens > 0 ? successfulVersions / lifecycleTokens * 100000 : null,
    quality_adjusted_survival_per_100k_tokens: lifecycleTokens !== null && lifecycleTokens > 0 ? options.versions.reduce((total, version) => total + (version.score ?? 0), 0) / lifecycleTokens * 100000 : null,
    required_supervision: {
      versions_requiring_clarification: options.versions.filter((version) => version.feedback_events.some((event) => event.kind === "clarification")).length,
      clarification_rounds: clarificationEvents.length,
      questions_total: clarificationEvents.reduce((total, event) => total + event.question_count, 0),
      answer_words: clarificationEvents.reduce((total, event) => total + event.answer_words, 0),
      clarification_limit_reached: options.versions.filter((version) => version.failed_phase === "clarification_limit_reached").length
    },
    actual_human_activity: {
      human_answers_total: humanEvents.length,
      human_answer_words: humanEvents.reduce((total, event) => total + event.answer_words, 0),
      human_prompt_corrections: promptCorrections.length,
      human_acceptance_corrections: acceptanceCorrections.length,
      human_code_edits: codeEdits.length,
      manual_files_changed: codeEdits.reduce((total, event) => total + (event.manual_files_changed ?? 0), 0),
      manual_lines_added: codeEdits.reduce((total, event) => total + (event.manual_lines_added ?? 0), 0),
      manual_lines_deleted: codeEdits.reduce((total, event) => total + (event.manual_lines_deleted ?? 0), 0)
    },
    versions: options.versions
  };
}

function aggregateUsage(usages: AgentUsage[]): AgentUsage {
  if (usages.length === 0) return unavailableAgentUsage();
  const statuses = usages.map((usage) => usage.status);
  const complete = statuses.every((status) => status === "complete");
  const anyMeasured = usages.some((usage) => usage.totalTokens !== null || usage.inputTokens !== null || usage.outputTokens !== null);
  const sum = (field: keyof Pick<AgentUsage, "inputTokens" | "outputTokens" | "reasoningTokens" | "cacheReadTokens" | "cacheWriteTokens" | "totalTokens" | "reportedCost">): number | null =>
    complete && usages.every((usage) => usage[field] !== null) ? usages.reduce((total, usage) => total + (usage[field] as number), 0) : null;
  return {
    status: complete ? "complete" : anyMeasured ? "partial" : statuses.includes("invalid") ? "invalid" : "unavailable",
    inputTokens: sum("inputTokens"),
    outputTokens: sum("outputTokens"),
    reasoningTokens: sum("reasoningTokens"),
    cacheReadTokens: sum("cacheReadTokens"),
    cacheWriteTokens: sum("cacheWriteTokens"),
    totalTokens: sum("totalTokens"),
    reportedCost: sum("reportedCost"),
    currency: complete && new Set(usages.map((usage) => usage.currency)).size === 1 ? usages[0]!.currency : null,
    source: complete && new Set(usages.map((usage) => usage.source)).size === 1 ? usages[0]!.source : "unavailable"
  };
}

function linearSlope(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const meanX = xs.reduce((total, value) => total + value, 0) / xs.length;
  const meanY = ys.reduce((total, value) => total + value, 0) / ys.length;
  const denominator = xs.reduce((total, value) => total + (value - meanX) ** 2, 0);
  return denominator === 0 ? null : xs.reduce((total, value, index) => total + (value - meanX) * (ys[index]! - meanY), 0) / denominator;
}

export async function writeTrajectoryArtifacts(artifactsRootPath: string, summary: TrajectorySummary): Promise<void> {
  await writeFile(
    path.join(artifactsRootPath, "trajectory-metadata.json"),
    JSON.stringify(buildTrajectoryMetadata(artifactsRootPath, summary), null, 2),
    "utf8"
  );
  await writeFile(path.join(artifactsRootPath, "trajectory-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  await writeFile(path.join(artifactsRootPath, "trajectory-report.md"), renderTrajectoryReport(summary), "utf8");
}

function buildTrajectoryMetadata(artifactsRootPath: string, summary: TrajectorySummary): TrajectoryMetadata {
  return {
    schema_version: "0.1.0",
    trajectory_id: summary.trajectory_id,
    run_type: summary.run_type,
    task_id: summary.task_id,
    model_id: summary.model_id,
    system_prompt_id: summary.system_prompt_id,
    user_prompt_id: summary.user_prompt_id,
    edit_prompt_id: summary.edit_prompt_id,
    run_number: summary.run_number,
    total_versions_requested: summary.total_versions_requested,
    artifacts_path: artifactsRootPath,
    generated_at: new Date().toISOString()
  };
}

export async function writeRepairSummary(
  versionArtifactsPath: string,
  repairArtifactsPath: string,
  summary: RepairSummary
): Promise<void> {
  const rendered = JSON.stringify(summary, null, 2);
  await writeFile(path.join(versionArtifactsPath, "repair-summary.json"), rendered, "utf8");
  await writeFile(path.join(repairArtifactsPath, "repair-summary.json"), rendered, "utf8");
  const summariesPath = path.join(versionArtifactsPath, "repair-summaries.json");
  const existing = await readFile(summariesPath, "utf8").then((raw) => JSON.parse(raw) as RepairSummary[]).catch(() => []);
  const summaries = [...existing.filter((item) => item.attempt !== summary.attempt), summary].sort((left, right) => left.attempt - right.attempt);
  await writeFile(summariesPath, JSON.stringify(summaries, null, 2), "utf8");
}

function classifyFailure(evaluation: EvaluationResult, failedPhase: string | null): FailureClassification {
  if (evaluation.status === "passed") {
    return "none";
  }
  if (failedPhase === "install") {
    const message = evaluation.checks.install.message ?? "";
    return /network|cache|policy|lockfile|registry|fetch|ENOENT|browser/i.test(message)
      ? "infra_failure"
      : "unknown";
  }
  if (failedPhase === "build") {
    const message = evaluation.checks.build.message ?? "";
    return /ERR_PNPM|network|cache|policy|lockfile|registry|fetch|ENOENT|modules directory|supply-chain/i.test(message)
      ? "infra_failure"
      : "model_failure";
  }
  if (failedPhase === "runtimeSmoke") {
    const message = evaluation.checks.runtimeSmoke.message ?? "";
    return /EPERM|EADDRINUSE|operation not permitted|listen/i.test(message) ? "infra_failure" : "model_failure";
  }
  if (failedPhase === "visual") {
    return "model_failure";
  }
  if (failedPhase === "e2e" || failedPhase === "values") {
    return "model_failure";
  }
  return "unknown";
}

function relativeArtifactPath(evaluation: EvaluationResult, filePath: string | undefined): string | null {
  if (!filePath) {
    return null;
  }
  return path.relative(evaluation.artifacts_path, filePath);
}

function formatScore(value: number): string {
  return value.toFixed(3);
}

function countSurvivedEditVersions(versions: TrajectoryVersionSummary[]): number {
  let survived = 0;
  for (const version of versions) {
    if (version.version_id === "v0") {
      continue;
    }
    if (version.status !== "passed") {
      break;
    }
    survived += 1;
  }
  return survived;
}

function renderTrajectoryReport(summary: TrajectorySummary): string {
  return [
    "# Trajectory Summary",
    "",
    `Trajectory: ${summary.trajectory_id}`,
    `Task: ${summary.task_id}`,
    `Model: ${summary.model_id}`,
    `Run type: ${summary.run_type}`,
    `Prompt: ${summary.user_prompt_id}`,
    `Versions requested: ${summary.total_versions_requested}`,
    `Survived versions: ${summary.survived_versions}`,
    `First failed version: ${summary.first_failed_version ?? "none"}`,
    "",
    "## Score Trend",
    "",
    ...summary.versions.map((version) => `- ${version.version_id}: ${version.score === null ? "unavailable" : formatScore(version.score)} (${version.status})`),
    "",
    "## Growth",
    "",
    `- LOC growth: ${summary.loc_growth}`,
    `- largest file growth: ${summary.largest_file_growth}`,
    `- files touched: ${summary.total_files_touched}`,
    `- lines added: ${summary.total_lines_added}`,
    `- lines deleted: ${summary.total_lines_deleted}`,
    `- repair attempts: ${summary.repair_attempts_total}`,
    `- repair successes: ${summary.repair_successes_total}`,
    "",
    "## Versions",
    "",
    ...summary.versions.map(
      (version) =>
        `- ${version.version_id}: ${version.failure_classification}, failed checks: ${version.failed_checks.join(", ") || "none"}, artifacts: ${version.artifacts_path}`
    ),
    ""
  ].join("\n");
}
