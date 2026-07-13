import { createHash } from "node:crypto";
import { symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./command.js";
import { copyDirFiltered, ensureDir, pathExists } from "./fs.js";
import type { TrajectoryPlan } from "./types.js";

export type WorkspaceResult = {
  workspacePath: string;
  metadataPath: string;
  created: boolean;
};

export async function prepareWorkspace(options: {
  rootDir: string;
  runDir: string;
  scaffoldPath: string;
  trajectory: TrajectoryPlan;
  executionId: string;
}): Promise<WorkspaceResult> {
  const workspacePath = await workspacePathForTrajectory(options.runDir, options.trajectory.trajectoryId);
  const metadataPath = path.join(workspacePath, ".ape-trajectory.json");

  if (await pathExists(metadataPath)) {
    return {
      workspacePath,
      metadataPath,
      created: false
    };
  }

  if (await pathExists(workspacePath)) {
    throw new Error(`Workspace already exists without metadata: ${workspacePath}`);
  }

  await ensureDir(path.dirname(workspacePath));
  await copyDirFiltered(options.scaffoldPath, workspacePath);
  if (process.env.APE_REUSE_SCAFFOLD_NODE_MODULES === "true") {
    const sourceNodeModules = path.join(options.scaffoldPath, "node_modules");
    const targetNodeModules = path.join(workspacePath, "node_modules");
    if (await pathExists(sourceNodeModules)) {
      await symlink(sourceNodeModules, targetNodeModules, process.platform === "win32" ? "junction" : "dir");
    }
  }
  await writeFile(path.join(workspacePath, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        execution_id: options.executionId,
        trajectory_id: options.trajectory.trajectoryId,
        task_id: options.trajectory.taskId,
        model_id: options.trajectory.modelId,
        provider_model: options.trajectory.providerModel,
        system_prompt_arm_id: options.trajectory.systemPromptId,
        user_prompt_arm_id: options.trajectory.userPromptId,
        edit_prompt_arm_id: options.trajectory.editPromptId,
        run_number: options.trajectory.runNumber,
        created_at: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );

  await runCommand("git", ["init"], workspacePath, path.join(workspacePath, ".ape-git-init.log"), 30000);
  await runCommand("git", ["config", "user.email", "ape-benchmark@example.local"], workspacePath, path.join(workspacePath, ".ape-git-config-email.log"), 30000);
  await runCommand("git", ["config", "user.name", "APE Benchmark"], workspacePath, path.join(workspacePath, ".ape-git-config-name.log"), 30000);
  await runCommand("git", ["add", "."], workspacePath, path.join(workspacePath, ".ape-git-add.log"), 30000);
  await runCommand("git", ["commit", "-m", "scaffold"], workspacePath, path.join(workspacePath, ".ape-git-commit.log"), 30000);

  return {
    workspacePath,
    metadataPath,
    created: true
  };
}

/** Keeps nested pnpm paths under Windows' executable path limit. */
export async function workspacePathForTrajectory(runDir: string, trajectoryId: string): Promise<string> {
  const compact = path.join(runDir, "workspaces", `w-${createHash("sha256").update(trajectoryId).digest("hex").slice(0, 16)}`);
  if (await pathExists(compact)) return compact;
  const legacy = path.join(runDir, "workspaces", trajectoryId);
  return (await pathExists(legacy)) ? legacy : compact;
}

export async function captureGitDiff(workspacePath: string, outputPath: string): Promise<void> {
  const result = await runCommand("git", ["diff", "--", "."], workspacePath, `${outputPath}.log`, 30000);
  await ensureDir(path.dirname(outputPath));
  await writeFile(outputPath, result.stdout, "utf8");
}

export async function commitWorkspaceVersion(
  workspacePath: string,
  versionId: string,
  artifactsPath: string
): Promise<void> {
  await runCommand("git", ["add", "."], workspacePath, path.join(artifactsPath, `git-add-${versionId}.log`), 30000);
  const diffResult = await runCommand(
    "git",
    ["diff", "--cached", "--quiet"],
    workspacePath,
    path.join(artifactsPath, `git-diff-cached-${versionId}.log`),
    30000
  );

  if (diffResult.exitCode === 0) {
    return;
  }

  await runCommand(
    "git",
    ["commit", "-m", versionId],
    workspacePath,
    path.join(artifactsPath, `git-commit-${versionId}.log`),
    30000
  );
}
