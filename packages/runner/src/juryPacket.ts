import { execFile } from "node:child_process";
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { copyDirFiltered, ensureDir, pathExists } from "./fs.js";
import { workspacePathForTrajectory } from "./workspace.js";
import type { TrajectorySummary } from "./artifacts.js";

const execFileAsync = promisify(execFile);

export type JuryPacketResult = {
  packetPath: string;
  files: string[];
};

export type JuryBlindMode = "none" | "light" | "strict";

export type JuryReviewImportResult = {
  reviewPath: string;
};

export async function exportJuryPacket(options: {
  rootDir: string;
  runDir: string;
  trajectoryId: string;
  outPath: string;
  blindMode: JuryBlindMode;
}): Promise<JuryPacketResult> {
  const trajectoryArtifactsPath = path.join(options.runDir, "artifacts", options.trajectoryId);
  const summary = JSON.parse(
    await readFile(path.join(trajectoryArtifactsPath, "trajectory-summary.json"), "utf8")
  ) as TrajectorySummary;
  const workspacePath = await workspacePathForTrajectory(options.runDir, options.trajectoryId);
  await ensureDir(options.outPath);
  await ensureDir(path.join(options.outPath, "diffs"));
  await ensureDir(path.join(options.outPath, "screenshots"));

  await writeFile(path.join(options.outPath, "README.md"), renderReadme(summary, options.blindMode), "utf8");
  await writeFile(path.join(options.outPath, "review-form.md"), renderReviewForm(), "utf8");
  await writeFile(path.join(options.outPath, "requirements.md"), await renderRequirements(options.rootDir, summary), "utf8");
  if (options.blindMode !== "strict") {
    await writeFile(path.join(options.outPath, "check-results-summary.md"), await renderCheckResults(summary), "utf8");
    await writeFile(path.join(options.outPath, "code-health-summary.md"), renderCodeHealth(summary), "utf8");
    await writeFile(path.join(options.outPath, "metadata-blind.json"), JSON.stringify(renderBlindMetadata(summary, options.blindMode), null, 2), "utf8");
  } else {
    await writeFile(path.join(options.outPath, "metadata-strict.json"), JSON.stringify({ schema_version: summary.schema_version, task_id: summary.task_id, versions: summary.versions.map((version) => version.version_id) }, null, 2), "utf8");
  }

  for (const version of summary.versions) {
    const versionArtifactsPath = path.join(trajectoryArtifactsPath, version.version_id);
    const diffSource = path.join(versionArtifactsPath, "git.diff");
    if (await pathExists(diffSource)) {
      await cp(diffSource, path.join(options.outPath, "diffs", `${version.version_id}.diff`));
    }
    await copyScreenshots(versionArtifactsPath, path.join(options.outPath, "screenshots", version.version_id));
    const repairDiffSource = path.join(versionArtifactsPath, "repair-1", "git.diff");
    if (await pathExists(repairDiffSource)) {
      await cp(repairDiffSource, path.join(options.outPath, "diffs", `${version.version_id}-repair-1.diff`));
    }
    await copyScreenshots(path.join(versionArtifactsPath, "repair-1"), path.join(options.outPath, "screenshots", `${version.version_id}-repair-1`));
  }

  await createSourceSnapshot(workspacePath, options.outPath);
  return {
    packetPath: options.outPath,
    files: await listFiles(options.outPath)
  };
}

export async function importJuryReview(options: {
  runDir: string;
  trajectoryId: string;
  reviewPath: string;
  reviewerId: string;
}): Promise<JuryReviewImportResult> {
  const reviewMarkdown = await readFile(options.reviewPath, "utf8");
  const importedAt = new Date().toISOString();
  const reviewId = [
    options.trajectoryId.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, ""),
    options.reviewerId.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, ""),
    importedAt.replace(/[^0-9]/g, "")
  ].join("__");
  const reviewDir = path.join(options.runDir, "jury-reviews");
  const outputPath = path.join(reviewDir, `${reviewId}.json`);
  await ensureDir(reviewDir);
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        schema_version: "0.1.0",
        trajectory_id: options.trajectoryId,
        reviewer_id: options.reviewerId,
        imported_at: importedAt,
        source_review_path: options.reviewPath,
        review_markdown: reviewMarkdown
      },
      null,
      2
    ),
    "utf8"
  );
  return {
    reviewPath: outputPath
  };
}

function renderReadme(summary: TrajectorySummary, blindMode: JuryBlindMode): string {
  return [
    "# Jury Packet",
    "",
    `Blind mode: ${blindMode}`,
    `Task: ${summary.task_id}`,
    `Versions evaluated: ${summary.versions.map((version) => version.version_id).join(", ")}`,
    ...(blindMode === "strict" ? [] : [`First failed version: ${summary.first_failed_version ?? "none"}`]),
    "",
    "This packet is intended for external review of behavior, regression preservation, and code maintainability."
  ].join("\n");
}

function renderReviewForm(): string {
  return [
    "# Review Form",
    "",
    "1. Does the app satisfy the requested behavior?",
    "2. Did the implementation preserve previous behavior?",
    "3. Is the codebase easy to change?",
    "4. Are there obvious duplicated or tangled areas?",
    "5. Did the agent ask appropriate clarification questions if needed?",
    "6. Which variant is better in pairwise comparison?",
    "",
    "## Reviewer Notes",
    "",
    "- Behavior:",
    "- Regressions:",
    "- Maintainability:",
    "- Overall decision:"
  ].join("\n");
}

async function renderRequirements(rootDir: string, summary: TrajectorySummary): Promise<string> {
  const taskDir = path.join(rootDir, "tasks", summary.task_id);
  const baseSpec = await readOptional(path.join(taskDir, "reference", "spec.md"));
  const acceptance = await readOptional(path.join(taskDir, "reference", "acceptance-criteria.md"));
  const evolutionFiles = await readdir(path.join(taskDir, "evolution")).catch(() => []);
  const evolution = await Promise.all(
    evolutionFiles
      .filter((file) => file.endsWith(".md"))
      .sort()
      .map(async (file) => [`## ${file}`, await readOptional(path.join(taskDir, "evolution", file))].join("\n\n"))
  );
  return ["# Requirements", "", "## Base Spec", baseSpec, "", "## Acceptance Criteria", acceptance, "", ...evolution].join("\n");
}

async function renderCheckResults(summary: TrajectorySummary): Promise<string> {
  const lines = ["# Check Results Summary", ""];
  for (const version of summary.versions) {
    lines.push(`## ${version.version_id}`);
    lines.push(`Status: ${version.status}`);
    lines.push(`Score: ${version.score === null ? "unavailable" : version.score.toFixed(3)}`);
    lines.push(`Failure classification: ${version.failure_classification}`);
    lines.push(`Failed checks: ${version.failed_checks.join(", ") || "none"}`);
    lines.push(`Repair attempts: ${version.repair_attempts}`);
    lines.push(`Repair success: ${version.repair_success}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderCodeHealth(summary: TrajectorySummary): string {
  return [
    "# Code Health Summary",
    "",
    `LOC growth: ${summary.loc_growth}`,
    `Largest file growth: ${summary.largest_file_growth}`,
    `Total files touched: ${summary.total_files_touched}`,
    `Total lines added: ${summary.total_lines_added}`,
    `Total lines deleted: ${summary.total_lines_deleted}`,
    "",
    "## Versions",
    "",
    ...summary.versions.map(
      (version) =>
        `- ${version.version_id}: LOC ${version.loc_total}, largest file LOC ${version.largest_file_loc}, files touched ${version.diff.files_touched}, +${version.diff.lines_added}/-${version.diff.lines_deleted}`
    )
  ].join("\n");
}

function renderBlindMetadata(summary: TrajectorySummary, blindMode: JuryBlindMode): Record<string, unknown> {
  return {
    schema_version: summary.schema_version,
    task_id: summary.task_id,
    ...(blindMode === "none" ? { run_type: summary.run_type } : {}),
    total_versions_requested: summary.total_versions_requested,
    survived_versions: summary.survived_versions,
    first_failed_version: summary.first_failed_version,
    regression_failures_total: summary.regression_failures_total,
    repair_attempts_total: summary.repair_attempts_total,
    repair_successes_total: summary.repair_successes_total,
    score_by_version: summary.score_by_version,
    versions: summary.versions.map((version) => ({
      version_id: version.version_id,
      status: version.status,
      score: version.score,
      failure_classification: version.failure_classification,
      failed_checks: version.failed_checks,
      repair_attempts: version.repair_attempts,
      repair_success: version.repair_success,
      loc_total: version.loc_total,
      largest_file_loc: version.largest_file_loc,
      diff: version.diff
    }))
  };
}

async function copyScreenshots(sourceDir: string, destinationDir: string): Promise<void> {
  if (!(await pathExists(sourceDir))) {
    return;
  }
  const files = (await listFiles(sourceDir)).filter((file) => file.endsWith(".png"));
  if (files.length === 0) {
    return;
  }
  await ensureDir(destinationDir);
  for (const file of files) {
    await cp(path.join(sourceDir, file), path.join(destinationDir, path.basename(file)));
  }
}

async function createSourceSnapshot(workspacePath: string, outPath: string): Promise<void> {
  const snapshotDir = path.join(outPath, "source-snapshot");
  await copyDirFiltered(workspacePath, snapshotDir);
  await rm(path.join(snapshotDir, ".ape-trajectory.json"), { force: true });
  await rm(path.join(snapshotDir, ".ape-git-init.log"), { force: true });
  await rm(path.join(snapshotDir, ".ape-git-config-email.log"), { force: true });
  await rm(path.join(snapshotDir, ".ape-git-config-name.log"), { force: true });
  await rm(path.join(snapshotDir, ".ape-git-add.log"), { force: true });
  await rm(path.join(snapshotDir, ".ape-git-commit.log"), { force: true });
  try {
    await execFileAsync("zip", ["-qr", "source-snapshot.zip", "source-snapshot"], { cwd: outPath, timeout: 120000 });
    await rm(snapshotDir, { recursive: true, force: true });
  } catch {
    await writeFile(path.join(outPath, "source-snapshot.txt"), (await listFiles(snapshotDir)).join("\n"), "utf8");
  }
}

async function listFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      for (const child of await listFiles(fullPath)) {
        files.push(path.join(entry.name, child));
      }
      continue;
    }
    files.push(entry.name);
  }
  return files.sort();
}

async function readOptional(filePath: string): Promise<string> {
  return readFile(filePath, "utf8").catch(() => "");
}
