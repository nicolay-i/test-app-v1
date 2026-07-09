import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";
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

async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}
