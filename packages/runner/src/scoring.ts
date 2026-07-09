import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvaluationResult } from "./evaluator.js";

export type VersionScore = {
  version_id: string;
  scores: {
    build_runtime_score: number;
    e2e_score: number;
    value_score: number;
    visual_score: number;
    prompt_adherence_score: number;
    version_quality: number;
    maintainability_score: number;
    overengineering_penalty: number;
  };
  status: "passed" | "failed";
  notes: string[];
};

export async function scoreV0(evaluation: EvaluationResult, artifactsPath: string): Promise<VersionScore> {
  const buildRuntimeScore =
    evaluation.checks.install.status === "passed" &&
    evaluation.checks.build.status === "passed" &&
    evaluation.checks.runtimeSmoke.status === "passed"
      ? 1
      : 0;
  const maintainabilityScore = scoreMaintainability(evaluation.metrics.code_health.largest_file.loc);
  const e2eScore = ratio(evaluation.checks.e2e.passed, evaluation.checks.e2e.total);
  const valueScore = ratio(evaluation.checks.values.passed, evaluation.checks.values.total);
  const visualScore = ratio(evaluation.checks.visual.passed, evaluation.checks.visual.total);
  const promptAdherenceScore = buildRuntimeScore;
  const versionQuality =
    0.25 * buildRuntimeScore +
    0.35 * e2eScore +
    0.15 * valueScore +
    0.15 * visualScore +
    0.1 * promptAdherenceScore;

  const score: VersionScore = {
    version_id: evaluation.version_id,
    scores: {
      build_runtime_score: buildRuntimeScore,
      e2e_score: e2eScore,
      value_score: valueScore,
      visual_score: visualScore,
      prompt_adherence_score: promptAdherenceScore,
      version_quality: versionQuality,
      maintainability_score: maintainabilityScore,
      overengineering_penalty: 0
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
  const notes: string[] = [];
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
