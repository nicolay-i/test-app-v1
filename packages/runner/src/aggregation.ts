import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists } from "./fs.js";
import type { TrajectorySummary } from "./artifacts.js";

export type AggregationResult = {
  trajectoryCount: number;
  versionCount: number;
  outputs: {
    trajectoryResultsJsonl: string;
    versionResultsJsonl: string;
    scoresCsv: string;
    leaderboardMd: string;
  };
};

export async function aggregateRun(runDir: string): Promise<AggregationResult> {
  const artifactsDir = path.join(runDir, "artifacts");
  await ensureDir(runDir);
  const summaries = await readTrajectorySummaries(artifactsDir);
  const trajectoryResultsJsonl = path.join(runDir, "trajectory-results.jsonl");
  const versionResultsJsonl = path.join(runDir, "version-results.jsonl");
  const scoresCsv = path.join(runDir, "scores.csv");
  const leaderboardMd = path.join(runDir, "leaderboard.md");
  const versionRows = summaries.flatMap((summary) =>
    summary.versions.map((version) => ({
      run_type: summary.run_type,
      task_id: summary.task_id,
      model_id: summary.model_id,
      system_prompt_id: summary.system_prompt_id,
      user_prompt_id: summary.user_prompt_id,
      edit_prompt_id: summary.edit_prompt_id,
      run_number: summary.run_number,
      version_id: version.version_id,
      status: version.status,
      score: version.score,
      failure_classification: version.failure_classification,
      failed_checks: version.failed_checks.join("|"),
      repair_attempts: version.repair_attempts ?? 0,
      repair_success: version.repair_success ?? false,
      loc_total: version.loc_total,
      largest_file_loc: version.largest_file_loc,
      files_touched: version.diff.files_touched,
      lines_added: version.diff.lines_added,
      lines_deleted: version.diff.lines_deleted,
      eligible_for_leaderboard: summary.run_type === "real"
    }))
  );

  await writeFile(trajectoryResultsJsonl, summaries.map((summary) => JSON.stringify(summary)).join("\n") + "\n", "utf8");
  await writeFile(versionResultsJsonl, versionRows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  await writeFile(scoresCsv, renderScoresCsv(summaries), "utf8");
  await writeFile(leaderboardMd, renderLeaderboard(summaries), "utf8");

  return {
    trajectoryCount: summaries.length,
    versionCount: versionRows.length,
    outputs: {
      trajectoryResultsJsonl,
      versionResultsJsonl,
      scoresCsv,
      leaderboardMd
    }
  };
}

async function readTrajectorySummaries(artifactsDir: string): Promise<TrajectorySummary[]> {
  const entries = await readdir(artifactsDir, { withFileTypes: true }).catch(() => []);
  const summaries: TrajectorySummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const summaryPath = path.join(artifactsDir, entry.name, "trajectory-summary.json");
    if (!(await pathExists(summaryPath))) {
      continue;
    }
    summaries.push(JSON.parse(await readFile(summaryPath, "utf8")) as TrajectorySummary);
  }

  return summaries.sort((left, right) => left.trajectory_id.localeCompare(right.trajectory_id));
}

function renderScoresCsv(summaries: TrajectorySummary[]): string {
  const header = [
    "run_type",
    "task_id",
    "model_id",
    "system_prompt_id",
    "user_prompt_id",
    "edit_prompt_id",
    "run_number",
    "versions_requested",
    "versions_survived",
    "v0_score",
    "final_score",
    "mean_score",
    "regression_failures",
    "repair_attempts",
    "loc_growth",
    "largest_file_growth",
    "eligible_for_leaderboard"
  ];
  const rows = summaries.map((summary) => {
    const scores = summary.versions.map((version) => version.score);
    const v0Score = summary.score_by_version.v0 ?? "";
    const finalScore = scores.length > 0 ? scores[scores.length - 1] : "";
    const meanScore = scores.length > 0 ? scores.reduce((total, score) => total + score, 0) / scores.length : "";
    return [
      summary.run_type,
      summary.task_id,
      summary.model_id,
      summary.system_prompt_id,
      summary.user_prompt_id,
      summary.edit_prompt_id,
      summary.run_number,
      summary.total_versions_requested,
      summary.survived_versions,
      v0Score,
      finalScore,
      meanScore,
      summary.regression_failures_total,
      summary.repair_attempts_total ?? 0,
      summary.loc_growth,
      summary.largest_file_growth,
      summary.run_type === "real"
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderLeaderboard(summaries: TrajectorySummary[]): string {
  const realSummaries = summaries.filter((summary) => summary.run_type === "real");
  const infraFailures = realSummaries.filter((summary) =>
    summary.versions.some((version) => version.failure_classification === "infra_failure")
  );
  const eligible = summaries.filter(
    (summary) =>
      summary.run_type === "real" &&
      !summary.versions.some((version) => version.failure_classification === "infra_failure")
  );
  const grouped = new Map<string, TrajectorySummary[]>();
  for (const summary of eligible) {
    const key = [summary.task_id, summary.model_id, summary.system_prompt_id, summary.user_prompt_id, summary.edit_prompt_id].join(" / ");
    grouped.set(key, [...(grouped.get(key) ?? []), summary]);
  }
  const rows = [...grouped.entries()]
    .map(([key, group]) => {
      const finalScores = group.map((summary) => summary.versions.at(-1)?.score ?? 0);
      const meanFinalScore = finalScores.reduce((total, score) => total + score, 0) / finalScores.length;
      const meanSurvived = group.reduce((total, summary) => total + summary.survived_versions, 0) / group.length;
      return {
        key,
        runs: group.length,
        meanFinalScore,
        meanSurvived,
        sampleArtifactsPath: group[0]?.versions.at(-1)?.artifacts_path ?? group[0]?.versions[0]?.artifacts_path ?? ""
      };
    })
    .sort((left, right) => right.meanFinalScore - left.meanFinalScore || right.meanSurvived - left.meanSurvived);

  return [
    "# Leaderboard",
    "",
    "Only real runs are included. Mock runs and trajectories with infra failures are excluded from ranking.",
    "",
    "| Rank | Task / Model / Prompts | Runs | Mean Final Score | Mean Survived Versions | Sample Artifacts |",
    "| ---: | --- | ---: | ---: | ---: | --- |",
    ...(rows.length > 0
      ? rows.map(
          (row, index) =>
            `| ${index + 1} | ${row.key} | ${row.runs} | ${row.meanFinalScore.toFixed(3)} | ${row.meanSurvived.toFixed(2)} | ${row.sampleArtifactsPath} |`
        )
      : ["| n/a | No eligible real runs yet | 0 | 0.000 | 0.00 | n/a |"]),
    "",
    "## Excluded Infra Failures",
    "",
    infraFailures.length > 0
      ? "| Trajectory | First Failed Version | Failed Checks | Artifacts |\n| --- | --- | --- | --- |\n" +
          infraFailures
            .map((summary) => {
              const failed = summary.versions.find((version) => version.failure_classification === "infra_failure");
              return `| ${summary.trajectory_id} | ${failed?.version_id ?? "unknown"} | ${failed?.failed_checks.join(", ") || "unknown"} | ${failed?.artifacts_path ?? "n/a"} |`;
            })
            .join("\n")
      : "No real trajectories were excluded for infra failures.",
    ""
  ].join("\n");
}

function csvCell(value: unknown): string {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
