import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";
import { loadTaskEvolution, type TaskEvolutionStep } from "./task.js";
import type { TrajectoryPlan } from "./types.js";

export type CompilePromptOptions = {
  rootDir: string;
  trajectory: TrajectoryPlan;
  versionId: string;
  artifactsPath: string;
};

export async function compileV0Prompt(options: CompilePromptOptions): Promise<{ prompt: string; promptPath: string }> {
  const taskDir = path.join(options.rootDir, "tasks", options.trajectory.taskId);
  const systemPrompt = await readText(path.join(options.rootDir, "prompts", "system", `${options.trajectory.systemPromptId}.md`));
  const userPrompt = await readText(path.join(options.rootDir, "prompts", "user", `${options.trajectory.userPromptId}.md`));
  const taskSpec = await readText(path.join(taskDir, "reference", "spec.md"));
  const acceptanceCriteria = await readText(path.join(taskDir, "reference", "acceptance-criteria.md"));
  const semanticUi = await readText(path.join(taskDir, "reference", "semantic-ui.xml"));
  const expectedValues = await readText(path.join(taskDir, "reference", "expected-values.json"));

  const prompt = [
    "# System Prompt",
    systemPrompt,
    "# User Prompt Arm",
    userPrompt,
    "# Task",
    `Task id: ${options.trajectory.taskId}`,
    `Version: ${options.versionId}`,
    "# Product Spec",
    taskSpec,
    "# Acceptance Criteria",
    acceptanceCriteria,
    "# Semantic UI Reference",
    "```xml",
    semanticUi,
    "```",
    "# Expected Values",
    "```json",
    expectedValues,
    "```",
    "# Implementation Constraints",
    "- Use the current project in this directory.",
    "- Do not create a nested project.",
    "- Keep scripts runnable with pnpm dev, pnpm build and pnpm test:e2e.",
    "- Do not delete task/reference/test files if they are present.",
    "- Use React and TypeScript.",
    "- Use localStorage for persistence.",
    "- Do not add backend services, auth providers, paid APIs or heavy dependencies without a task need.",
    "- Keep changes maintainable and avoid rewriting unrelated scaffold files.",
    "# Deliverable",
    "Implement the TodoMVC app in the existing Vite React TypeScript scaffold."
  ].join("\n\n");

  const promptPath = path.join(options.artifactsPath, "prompt.md");
  await ensureDir(path.dirname(promptPath));
  await writeFile(promptPath, prompt, "utf8");

  return {
    prompt,
    promptPath
  };
}

export type CompileEditPromptOptions = CompilePromptOptions & {
  evolutionStep: TaskEvolutionStep;
  currentVersionId: string;
  knownFailures?: string[];
};

export async function compileEditPrompt(
  options: CompileEditPromptOptions
): Promise<{ prompt: string; promptPath: string; compiledEditPromptPath: string }> {
  const taskDir = path.join(options.rootDir, "tasks", options.trajectory.taskId);
  const editPrompt = await readText(path.join(options.rootDir, "prompts", "edit", `${options.trajectory.editPromptId}.md`));
  const baseAcceptanceCriteria = await readText(path.join(taskDir, "reference", "acceptance-criteria.md"));
  const changeRequest = await readText(path.join(taskDir, options.evolutionStep.prompt));
  const previousSteps = await loadTaskEvolution(taskDir);
  const currentStepIndex = previousSteps.findIndex((step) => step.id === options.evolutionStep.id);
  const previousChangeSummary = previousSteps
    .slice(0, currentStepIndex === -1 ? 0 : currentStepIndex)
    .map((step) => `- ${step.id}: ${step.prompt}`)
    .join("\n");
  const knownFailures =
    options.knownFailures && options.knownFailures.length > 0
      ? options.knownFailures.map((failure) => `- ${failure}`).join("\n")
      : "- none";

  const prompt = [
    "# Benchmark Edit Task",
    "",
    "You are editing an existing generated app.",
    "",
    "# Edit Prompt Arm",
    editPrompt,
    "",
    "## Current App",
    `This workspace already contains a generated implementation of ${options.currentVersionId}.`,
    "",
    "## Requested Change",
    changeRequest,
    "",
    "## New Acceptance Criteria",
    changeRequest,
    "",
    "## Previous Acceptance Criteria",
    baseAcceptanceCriteria,
    "",
    "## Previous Evolution Steps",
    previousChangeSummary.length > 0 ? previousChangeSummary : "- none",
    "",
    "## Regression Requirements",
    "Preserve all previously tested behavior unless the requested change explicitly replaces it.",
    "",
    "## Constraints",
    "- Keep the implementation simple.",
    "- Avoid duplicating logic.",
    "- Prefer localized changes.",
    "- Do not rewrite the entire app unless necessary.",
    "- Do not add unrelated features.",
    "- Keep scripts runnable with pnpm dev, pnpm build and pnpm test:e2e.",
    "",
    "## Known Current Failures",
    knownFailures,
    "",
    "## Deliverable",
    "Modify the existing app in this workspace."
  ].join("\n");

  const compiledEditPromptPath = path.join(options.artifactsPath, "compiled-edit-prompt.md");
  await ensureDir(path.dirname(compiledEditPromptPath));
  await writeFile(compiledEditPromptPath, prompt, "utf8");
  await writeFile(path.join(options.artifactsPath, "prompt.md"), prompt, "utf8");

  return {
    prompt,
    promptPath: compiledEditPromptPath,
    compiledEditPromptPath
  };
}

export type CompileRepairPromptOptions = CompilePromptOptions & {
  failedVersionId: string;
  failedChecks: string[];
  failureMessages: string[];
  artifactPaths: Record<string, string | null>;
};

export async function compileRepairPrompt(
  options: CompileRepairPromptOptions
): Promise<{ prompt: string; promptPath: string }> {
  const failedChecks =
    options.failedChecks.length > 0 ? options.failedChecks.map((check) => `- ${check}`).join("\n") : "- none";
  const failureMessages =
    options.failureMessages.length > 0
      ? options.failureMessages.map((message) => `- ${message}`).join("\n")
      : "- none";
  const artifactPaths = Object.entries(options.artifactPaths)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  const prompt = [
    "# Repair Task",
    "",
    "The previous implementation failed benchmark checks.",
    "",
    "## Failed Version",
    options.failedVersionId,
    "",
    "## Failed Checks",
    failedChecks,
    "",
    "## Failure Messages",
    failureMessages,
    "",
    "## Relevant Artifacts",
    artifactPaths.length > 0 ? artifactPaths : "- none",
    "",
    "## Requirement",
    "Fix only the failures needed to pass the benchmark.",
    "Preserve all existing behavior.",
    "Avoid unrelated rewrites.",
    "Do not remove benchmark tests or task reference files.",
    "",
    "## Deliverable",
    "Modify the existing app in this workspace."
  ].join("\n");

  const promptPath = path.join(options.artifactsPath, "prompt.md");
  await ensureDir(path.dirname(promptPath));
  await writeFile(promptPath, prompt, "utf8");

  return {
    prompt,
    promptPath
  };
}

async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}
