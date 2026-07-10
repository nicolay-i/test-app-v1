import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./fs.js";

export type VerificationResult = { ok: boolean; errors: string[]; files: number };

export async function verifyExecution(executionPath: string): Promise<VerificationResult> {
  const errors: string[] = [];
  const manifestPath = path.join(executionPath, "execution-manifest.json");
  if (!(await pathExists(manifestPath))) return { ok: false, errors: ["missing execution-manifest.json"], files: 0 };
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { execution_id?: string; run_type?: string };
  if (!manifest.execution_id || !manifest.run_type) errors.push("invalid execution manifest identity");
  const artifactsRoot = path.join(executionPath, "artifacts");
  const trajectories = await readdir(artifactsRoot, { withFileTypes: true }).catch(() => []);
  let files = 0;
  for (const trajectory of trajectories.filter((entry) => entry.isDirectory())) {
    const trajectoryPath = path.join(artifactsRoot, trajectory.name);
    const summaryPath = path.join(trajectoryPath, "trajectory-summary.json");
    if (!(await pathExists(summaryPath))) { errors.push(`${trajectory.name}: missing trajectory-summary.json`); continue; }
    const summary = JSON.parse(await readFile(summaryPath, "utf8")) as { run_type?: string; versions?: Array<{ version_id: string; status: string; score: number | null; repair_attempts: number }> };
    if (summary.run_type !== manifest.run_type) errors.push(`${trajectory.name}: run_type differs from execution`);
    for (const version of summary.versions ?? []) {
      const versionPath = path.join(trajectoryPath, version.version_id);
      const required = ["prompt.md", "run-metadata.json", "opencode.stdout.log", "opencode.stderr.log", "opencode.events.jsonl", "opencode-result.json", "assistant-response.md", "git.diff", "failure-summary.json", "report.md"];
      for (const name of required) if (!(await pathExists(path.join(versionPath, name)))) errors.push(`${trajectory.name}/${version.version_id}: missing ${name}`); else files += 1;
      if (version.status !== "passed" && !(await pathExists(path.join(versionPath, "failure-summary.json")))) errors.push(`${trajectory.name}/${version.version_id}: failed version has no failure summary`);
      const metadataPath = path.join(versionPath, "run-metadata.json");
      if (await pathExists(metadataPath)) {
        const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as { execution_id?: string; run_type?: string };
        if (metadata.execution_id !== manifest.execution_id) errors.push(`${trajectory.name}/${version.version_id}: execution_id differs from manifest`);
        if (metadata.run_type !== manifest.run_type) errors.push(`${trajectory.name}/${version.version_id}: metadata run_type differs from manifest`);
      }
      if (version.score === undefined) errors.push(`${trajectory.name}/${version.version_id}: score is absent`);
      if (version.repair_attempts > 0 && !(await pathExists(path.join(versionPath, "repair-1")))) errors.push(`${trajectory.name}/${version.version_id}: repair artifacts missing`);
    }
  }
  return { ok: errors.length === 0, errors, files };
}

export async function createArtifactManifest(executionPath: string): Promise<{ path: string; sha256: string; size: number }[]> {
  const files: string[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const item = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(item); else if (entry.isFile()) files.push(item);
    }
  }
  await walk(path.join(executionPath, "artifacts"));
  return Promise.all(files.sort().map(async (file) => {
    const data = await readFile(file);
    return { path: path.relative(executionPath, file), sha256: createHash("sha256").update(data).digest("hex"), size: data.length };
  }));
}
