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
  return aggregateRuns([runDir], runDir);
}

export async function aggregateRuns(runDirs: string[], outputDir: string): Promise<AggregationResult> {
  await ensureDir(outputDir);
  const summaries = (await Promise.all(runDirs.map((runDir) => readTrajectorySummaries(path.join(runDir, "artifacts"))))).flat();
  const trajectoryResultsJsonl = path.join(outputDir, "trajectory-results.jsonl");
  const versionResultsJsonl = path.join(outputDir, "version-results.jsonl");
  const scoresCsv = path.join(outputDir, "scores.csv");
  const leaderboardMd = path.join(outputDir, "leaderboard.md");
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
    const scores = summary.versions.map((version) => version.score).filter((score): score is number => score !== null);
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
  const reliabilityRows = [...grouped.entries()]
    .map(([key, group]) => {
      const meanSurvived = group.reduce((total, summary) => total + summary.survived_versions, 0) / group.length;
      const meanSurvivalRate = group.reduce((total, summary) => total + (summary.survival_rate ?? summary.survived_versions / Math.max(1, summary.total_versions_requested)), 0) / group.length;
      const regressionFreeRate = group.reduce((total, summary) => total + ((summary.regression_free_versions ?? summary.versions.filter((version) => !version.failed_checks.some((check) => check === "e2e" || check === "values")).length) / Math.max(1, summary.versions.length)), 0) / group.length;
      const repairFreeRate = group.reduce((total, summary) => total + ((summary.repair_free_versions ?? summary.versions.filter((version) => version.repair_attempts === 0).length) / Math.max(1, summary.versions.length)), 0) / group.length;
      return {
        key,
        runs: group.length,
        meanSurvived,
        meanSurvivalRate,
        regressionFreeRate,
        repairFreeRate,
        firstFailed: group.map((summary) => summary.first_failed_version ?? "none").join(", "),
        sampleArtifactsPath: group[0]?.versions.at(-1)?.artifacts_path ?? group[0]?.versions[0]?.artifacts_path ?? ""
      };
    })
    .sort((left, right) => right.meanSurvivalRate - left.meanSurvivalRate || right.meanSurvived - left.meanSurvived || right.regressionFreeRate - left.regressionFreeRate);
  const qualityRows = [...grouped.entries()]
    .map(([key, group]) => {
      const scores = group.flatMap((summary) => summary.versions.filter((version) => version.evaluation_completed && version.score !== null).map((version) => version.score!));
      const finalScores = group.map((summary) => [...summary.versions].reverse().find((version) => version.evaluation_completed && version.score !== null)?.score).filter((score): score is number => score !== undefined && score !== null);
      const slopes = group.map((summary) => summary.quality_degradation_slope).filter((value): value is number => value !== null && value !== undefined);
      return { key, runs: group.length, evaluated: scores.length, meanQuality: mean(scores), finalQuality: mean(finalScores), minQuality: scores.length ? Math.min(...scores) : null, degradationSlope: mean(slopes) };
    })
    .filter((row) => row.evaluated > 0)
    .sort((left, right) => (right.meanQuality ?? -Infinity) - (left.meanQuality ?? -Infinity));
  const efficiencyRows = [...grouped.entries()]
    .map(([key, group]) => {
      const rows = group.filter((summary) => typeof summary.lifecycle_tokens === "number");
      return { key, runs: rows.length, tokensPerPassingVersion: mean(rows.map((summary) => summary.tokens_per_passing_version).filter((value): value is number => typeof value === "number")), qualityAdjustedSurvivalPerToken: null as number | null };
    })
    .filter((row) => row.runs > 0);

  return [
    "# Lifecycle Leaderboards",
    "",
    "Only real runs are included. Infra/harness failures are excluded from model rankings and reported separately. Mock runs are never eligible.",
    "",
    "## Reliability",
    "",
    "Ordered by survival rate, survived versions, regression-free rate, then repair-free rate.",
    "",
    "| Rank | Task / Model / Prompts | Runs | Survival Rate | Mean Survived | Regression-Free | Repair-Free | First Failed | Sample Artifacts |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...(reliabilityRows.length > 0
      ? reliabilityRows.map(
          (row, index) =>
            `| ${index + 1} | ${row.key} | ${row.runs} | ${row.meanSurvivalRate.toFixed(3)} | ${row.meanSurvived.toFixed(2)} | ${row.regressionFreeRate.toFixed(3)} | ${row.repairFreeRate.toFixed(3)} | ${row.firstFailed} | ${row.sampleArtifactsPath} |`
        )
      : ["| n/a | No eligible real runs yet | 0 | 0.000 | 0.00 | 0.000 | 0.000 | n/a | n/a |"]),
    "",
    "## Conditional Quality",
    "",
    "Only fully evaluated versions contribute; unavailable evaluation is not converted to zero.",
    "",
    "| Task / Model / Prompts | Evaluated Versions | Mean Quality | Final Evaluated Quality | Minimum Quality | Quality Degradation Slope |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...(qualityRows.length > 0 ? qualityRows.map((row) => `| ${row.key} | ${row.evaluated} | ${formatMetric(row.meanQuality)} | ${formatMetric(row.finalQuality)} | ${formatMetric(row.minQuality)} | ${formatMetric(row.degradationSlope)} |`) : ["| No fully evaluated real versions yet | 0 | n/a | n/a | n/a | n/a |"]),
    "",
    "## Efficiency",
    "",
    "Usage is provider-dependent. Rows appear only when lifecycle token usage is available.",
    "",
    "| Task / Model / Prompts | Runs With Usage | Tokens per Passing Version | Quality-Adjusted Survival per Token |",
    "| --- | ---: | ---: | ---: |",
    ...(efficiencyRows.length > 0 ? efficiencyRows.map((row) => `| ${row.key} | ${row.runs} | ${formatMetric(row.tokensPerPassingVersion)} | ${formatMetric(row.qualityAdjustedSurvivalPerToken)} |`) : ["| Usage unavailable | 0 | n/a | n/a |"]),
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

function mean(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function formatMetric(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(3);
}

function csvCell(value: unknown): string {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
