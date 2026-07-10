import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunType } from "./artifacts.js";
import type { EvaluationResult } from "./evaluator.js";

export type VersionScore = {
  version_id: string;
  run_type: RunType;
  eligible_for_leaderboard: boolean;
  scores: {
    build_runtime_score: number;
    e2e_score: number;
    value_score: number;
    visual_smoke_score: number;
    visual_similarity_score: number | null;
    requirement_adherence_score: number | null;
    version_quality_smoke_score: number;
    benchmark_quality_score: number | null;
    jury_quality_score: number | null;
    maintainability_score: number;
    overengineering_penalty: number;
    runtime_error_penalty: number;
  };
  status: "passed" | "failed";
  notes: string[];
};

export async function scoreV0(
  evaluation: EvaluationResult,
  artifactsPath: string,
  runType: RunType = "real"
): Promise<VersionScore> {
  const buildRuntimeScore =
    evaluation.checks.install.status === "passed" &&
    evaluation.checks.build.status === "passed" &&
    evaluation.checks.runtimeSmoke.status === "passed"
      ? 1
      : 0;
  const maintainabilityScore = scoreMaintainability(evaluation.metrics.code_health.largest_file.loc);
  const e2eScore = ratio(evaluation.checks.e2e.passed, evaluation.checks.e2e.total);
  const valueScore = ratio(evaluation.checks.values.passed, evaluation.checks.values.total);
  const visualSmokeScore = ratio(evaluation.checks.visual.passed, evaluation.checks.visual.total);
  const requirementAdherenceScore = evaluation.requirement_adherence.requirement_adherence_score;
  const runtimeErrorPenalty = scoreRuntimeErrorPenalty(evaluation);
  const versionQualityBeforePenalty =
    0.25 * buildRuntimeScore +
    0.35 * e2eScore +
    0.15 * valueScore +
    0.15 * visualSmokeScore +
    0.1 * (requirementAdherenceScore ?? 0);
  const versionQuality = Math.max(0, versionQualityBeforePenalty - runtimeErrorPenalty);

  const score: VersionScore = {
    version_id: evaluation.version_id,
    run_type: runType,
    eligible_for_leaderboard: runType === "real",
    scores: {
      build_runtime_score: buildRuntimeScore,
      e2e_score: e2eScore,
      value_score: valueScore,
      visual_smoke_score: visualSmokeScore,
      visual_similarity_score: null,
      requirement_adherence_score: requirementAdherenceScore,
      version_quality_smoke_score: versionQuality,
      benchmark_quality_score: null,
      jury_quality_score: null,
      maintainability_score: maintainabilityScore,
      overengineering_penalty: 0,
      runtime_error_penalty: runtimeErrorPenalty
    },
    status: evaluation.status === "passed" ? "passed" : "failed",
    notes: buildNotes(evaluation)
  };

  await writeFile(path.join(artifactsPath, "score.json"), JSON.stringify(score, null, 2), "utf8");
  return score;
}

function ratio(passed: number | undefined, total: number | undefined): number {
  if (!total || total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, (passed ?? 0) / total));
}

function buildNotes(evaluation: EvaluationResult): string[] {
  const notes: string[] = [
    "version_quality_smoke_score is a deterministic smoke indicator, not a benchmark quality score",
    "visual_smoke_score means screenshot capture passed; no baseline similarity scoring is configured yet",
    "benchmark_quality_score remains null until a validated composite formula is approved"
  ];
  for (const [name, check] of Object.entries(evaluation.checks)) {
    if (check.status === "failed") {
      notes.push(`${name} failed${check.message ? `: ${check.message}` : ""}`);
    }
    if (check.status === "skipped") {
      notes.push(`${name} skipped${check.message ? `: ${check.message}` : ""}`);
    }
  }
  if (notes.length === 0) {
    notes.push("All configured MVP checks passed.");
  }
  return notes;
}

function scoreMaintainability(largestFileLoc: number): number {
  if (largestFileLoc <= 250) {
    return 1;
  }
  if (largestFileLoc >= 750) {
    return 0;
  }
  return 1 - (largestFileLoc - 250) / 500;
}

function scoreRuntimeErrorPenalty(evaluation: EvaluationResult): number {
  const runtimeErrors =
    (evaluation.checks.e2e.runtime_errors ?? 0) +
    (evaluation.checks.values.runtime_errors ?? 0) +
    (evaluation.checks.visual.runtime_errors ?? 0);
  return Math.min(0.2, runtimeErrors * 0.05);
}
