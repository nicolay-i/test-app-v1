import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveLifecycleClarification, runLifecyclePreflight } from "./lifecyclePreflight.js";

export async function verifyLifecyclePreflightFixture(rootDir: string): Promise<string[]> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ape-lifecycle-preflight-"));
  const artifactsPath = path.join(root, "v3");
  const failures: string[] = [];
  try {
    const initial = await runLifecyclePreflight({
      rootDir,
      taskId: "todomvc",
      versionId: "v3",
      request: "Add tags to todos.",
      artifactsPath,
      workspacePath: root,
      providerModel: "fixture/model",
      runType: "mock",
      opencodeFormat: "json",
      autoApprove: true,
      timeoutMs: 1_000,
      maxAttempts: 2,
      maxContinuations: 1,
      scenarioId: "03-underspecified-tags"
    });
    if (initial.decision.decision !== "clarify" || initial.decision.questions.length === 0) failures.push("initial-clarify");
    const clarification = await resolveLifecycleClarification({
      rootDir,
      taskId: "todomvc",
      scenarioId: initial.scenarioId,
      answerSource: "oracle",
      artifactsPath,
      round: 1,
      questions: initial.decision.questions
    });
    const resumed = await runLifecyclePreflight({
      rootDir,
      taskId: "todomvc",
      versionId: "v3",
      request: "Add tags to todos.",
      artifactsPath,
      workspacePath: root,
      providerModel: "fixture/model",
      runType: "mock",
      opencodeFormat: "json",
      autoApprove: true,
      timeoutMs: 1_000,
      maxAttempts: 2,
      maxContinuations: 1,
      scenarioId: "03-underspecified-tags",
      resolvedAnswer: clarification.answer,
      purpose: "clarification",
      round: 1
    });
    if (resumed.decision.decision !== "proceed") failures.push("proceed-after-answer");
    const [question, answer, result] = await Promise.all([
      readFile(path.join(artifactsPath, "clarification-1", "question.md"), "utf8"),
      readFile(path.join(artifactsPath, "clarification-1", "answer.md"), "utf8"),
      readFile(path.join(artifactsPath, "clarification-1", "result.json"), "utf8")
    ]);
    if (!question.includes("single vs multiple tags") || !answer.includes("Work, Personal, Urgent") || !result.includes("oracle_answer")) failures.push("clarification-artifacts");
    if (!(await readFile(path.join(artifactsPath, "preflight", "agent-decision.json"), "utf8")).includes("clarify")) failures.push("preflight-artifacts");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  return failures;
}
