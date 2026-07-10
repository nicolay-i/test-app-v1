import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ensureDir, pathExists } from "./fs.js";
import type { RunType } from "./artifacts.js";
import type { MatrixConfig, TrajectoryPlan } from "./types.js";

const execFileAsync = promisify(execFile);

export type ExecutionManifest = {
  schema_version: "0.2.0";
  execution_id: string;
  run_type: RunType;
  matrix_id: string;
  source_commit: string | null;
  config_hash: string;
  task_hashes: Record<string, string>;
  prompt_hashes: Record<string, string>;
  scaffold_hash: string;
  requested_versions: number;
  mock_profile: string | null;
  trajectory_ids: string[];
  node_version: string;
  pnpm_version: string | null;
  opencode_version: string | null;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed";
};

export type ExecutionContext = {
  executionId: string;
  rootPath: string;
  manifestPath: string;
  manifest: ExecutionManifest;
  resumed: boolean;
};

export async function createOrResumeExecution(options: {
  rootDir: string;
  matrixRoot: string;
  configPath: string;
  config: MatrixConfig;
  trajectories: TrajectoryPlan[];
  runType: RunType;
  requestedVersions: number;
  mockProfile: string | null;
  resumeExecutionId?: string;
  allowTrajectorySubset?: boolean;
}): Promise<ExecutionContext> {
  const expected = await buildManifest(options);
  const executionId = options.resumeExecutionId ?? newExecutionId(options.runType);
  const rootPath = path.join(options.matrixRoot, "executions", executionId);
  const manifestPath = path.join(rootPath, "execution-manifest.json");
  if (options.resumeExecutionId) {
    if (!(await pathExists(manifestPath))) throw new Error(`Execution not found: ${options.resumeExecutionId}`);
    const actual = JSON.parse(await readFile(manifestPath, "utf8")) as ExecutionManifest;
    assertResumeCompatible(actual, expected, options.allowTrajectorySubset ?? false);
    return { executionId, rootPath, manifestPath, manifest: actual, resumed: true };
  }
  await ensureDir(rootPath);
  await writeFile(manifestPath, JSON.stringify({ ...expected, execution_id: executionId }, null, 2), "utf8");
  return { executionId, rootPath, manifestPath, manifest: { ...expected, execution_id: executionId }, resumed: false };
}

export async function finalizeExecution(context: ExecutionContext, status: "completed" | "failed"): Promise<void> {
  const manifest = { ...context.manifest, status, completed_at: new Date().toISOString() };
  await writeFile(context.manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  context.manifest = manifest;
}

function newExecutionId(runType: RunType): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${runType}-${randomBytes(3).toString("hex")}`;
}

async function buildManifest(options: Omit<Parameters<typeof createOrResumeExecution>[0], "resumeExecutionId">): Promise<ExecutionManifest> {
  const root = options.rootDir;
  const taskHashes = Object.fromEntries(await Promise.all(options.config.tasks.map(async (taskId) => [taskId, await hashTree(path.join(root, "tasks", taskId))])));
  const promptIds = new Set(options.trajectories.flatMap((item) => [item.systemPromptId, item.userPromptId, item.editPromptId]));
  const promptHashes = Object.fromEntries(await Promise.all([...promptIds].map(async (id) => [id, await hashPrompt(root, id)])));
  return {
    schema_version: "0.2.0",
    execution_id: "pending",
    run_type: options.runType,
    matrix_id: options.config.id,
    source_commit: await commandOutput("git", ["rev-parse", "HEAD"]),
    config_hash: await hashFile(options.configPath),
    task_hashes: taskHashes,
    prompt_hashes: promptHashes,
    scaffold_hash: await hashTree(path.resolve(root, options.config.scaffold.path)),
    requested_versions: options.requestedVersions,
    mock_profile: options.mockProfile,
    trajectory_ids: options.trajectories.map((item) => item.trajectoryId).sort(),
    node_version: process.version,
    pnpm_version: await commandOutput("pnpm", ["--version"]),
    opencode_version: await commandOutput("opencode", ["--version"]),
    started_at: new Date().toISOString(),
    completed_at: null,
    status: "running"
  };
}

function assertResumeCompatible(actual: ExecutionManifest, expected: ExecutionManifest, allowTrajectorySubset: boolean): void {
  const fields: Array<keyof ExecutionManifest> = ["run_type", "matrix_id", "source_commit", "config_hash", "scaffold_hash", "requested_versions", "mock_profile"];
  for (const field of fields) if (JSON.stringify(actual[field]) !== JSON.stringify(expected[field])) throw new Error(`Cannot resume ${actual.execution_id}: ${field} differs`);
  for (const [task, hash] of Object.entries(expected.task_hashes)) if (actual.task_hashes[task] !== hash) throw new Error(`Cannot resume ${actual.execution_id}: task hash differs for ${task}`);
  for (const [prompt, hash] of Object.entries(expected.prompt_hashes)) if (actual.prompt_hashes[prompt] !== hash) throw new Error(`Cannot resume ${actual.execution_id}: prompt hash differs for ${prompt}`);
  if (allowTrajectorySubset) {
    for (const trajectoryId of expected.trajectory_ids) if (!actual.trajectory_ids.includes(trajectoryId)) throw new Error(`Cannot resume ${actual.execution_id}: trajectory ${trajectoryId} is not part of execution`);
  } else if (JSON.stringify(actual.trajectory_ids) !== JSON.stringify(expected.trajectory_ids)) {
    throw new Error(`Cannot resume ${actual.execution_id}: trajectory definition differs`);
  }
}

async function hashPrompt(root: string, id: string): Promise<string> {
  for (const section of ["system", "user", "edit"]) {
    const candidate = path.join(root, "prompts", section, `${id}.md`);
    if (await pathExists(candidate)) return hashFile(candidate);
  }
  throw new Error(`Prompt file not found for ${id}`);
}

async function hashTree(root: string): Promise<string> {
  const { readdir } = await import("node:fs/promises");
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const item = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(item); else if (entry.isFile()) files.push(item);
    }
  }
  await walk(root);
  const hash = createHash("sha256");
  for (const file of files.sort()) { hash.update(path.relative(root, file)); hash.update(await readFile(file)); }
  return hash.digest("hex");
}

async function hashFile(file: string): Promise<string> { return createHash("sha256").update(await readFile(file)).digest("hex"); }
async function commandOutput(command: string, args: string[]): Promise<string | null> {
  try { return (await execFileAsync(command, args, { cwd: process.cwd(), timeout: 30000 })).stdout.trim() || null; } catch { return null; }
}
