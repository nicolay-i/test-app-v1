import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";
import { loadNegotiationScenario, parseDecision, type AgentDecision, type NegotiationScenario } from "./negotiation.js";
import { runOpenCode } from "./opencodeAdapter.js";
import { unavailableAgentUsage, type RunType } from "./artifacts.js";
import type { AgentUsage } from "./opencodeEventParser.js";

export type LifecyclePreflightResult = {
  decision: AgentDecision;
  usage: AgentUsage;
  artifactsPath: string;
  scenarioId: string | null;
};

export async function runLifecyclePreflight(options: {
  rootDir: string;
  taskId: string;
  versionId: string;
  request: string;
  artifactsPath: string;
  workspacePath: string;
  providerModel: string;
  runType: RunType;
  opencodeFormat: "json" | "default";
  autoApprove: boolean;
  timeoutMs: number;
  maxAttempts: number;
  maxContinuations: number;
  scenarioId?: string;
  resolvedAnswer?: string;
  purpose?: "preflight" | "clarification";
  round?: number;
}): Promise<LifecyclePreflightResult> {
  const artifactsPath = options.purpose === "clarification"
    ? path.join(options.artifactsPath, `clarification-${options.round ?? 1}`)
    : path.join(options.artifactsPath, "preflight");
  await ensureDir(artifactsPath);
  const scenario = options.scenarioId
    ? await loadNegotiationScenario(path.join(options.rootDir, "tasks", options.taskId), options.scenarioId)
    : null;
  const prompt = buildLifecyclePreflightPrompt({ versionId: options.versionId, request: options.request, scenario, ...(options.resolvedAnswer ? { resolvedAnswer: options.resolvedAnswer } : {}) });
  const promptPath = path.join(artifactsPath, "prompt.md");
  await writeFile(promptPath, prompt, "utf8");
  await writeFile(path.join(artifactsPath, "request.json"), JSON.stringify({ version_id: options.versionId, request: options.request, scenario_id: scenario?.id ?? null }, null, 2), "utf8");

  if (options.runType === "mock") {
    const decision = mockDecision(scenario, options.resolvedAnswer);
    await writeFile(path.join(artifactsPath, "agent-decision.json"), JSON.stringify(decision, null, 2), "utf8");
    return { decision, usage: unavailableAgentUsage(), artifactsPath, scenarioId: scenario?.id ?? null };
  }

  const result = await runOpenCode({
    model: options.providerModel,
    cwd: options.workspacePath,
    prompt,
    promptPath,
    title: `lifecycle-preflight:${options.versionId}`,
    artifactsPath,
    format: options.opencodeFormat,
    autoApprove: options.autoApprove,
    timeoutMs: options.timeoutMs,
    maxAttempts: Math.min(options.maxAttempts, options.maxContinuations + 1),
    purpose: options.purpose ?? "preflight"
  });
  const decision = result.ok ? parseDecision(result.parsed.assistantText) : unknownDecision(`OpenCode failed with exit code ${result.exitCode}`);
  await writeFile(path.join(artifactsPath, "agent-decision.json"), JSON.stringify(decision, null, 2), "utf8");
  return { decision, usage: result.parsed.usage, artifactsPath, scenarioId: scenario?.id ?? null };
}

export async function resolveLifecycleClarification(options: {
  rootDir: string;
  taskId: string;
  scenarioId: string | null;
  answerSource: "oracle" | "scenario" | "human";
  humanAnswer?: string;
  artifactsPath: string;
  round: number;
  questions: string[];
}): Promise<{ answer: string; source: "oracle_answer" | "scenario_answer" | "human_answer"; artifactsPath: string }> {
  const artifactsPath = path.join(options.artifactsPath, `clarification-${options.round}`);
  await ensureDir(artifactsPath);
  let answer: string;
  let source: "oracle_answer" | "scenario_answer" | "human_answer";
  if (options.answerSource === "human") {
    if (!options.humanAnswer) throw new Error("Clarification requires a human answer, but --clarification-answer was not provided");
    answer = options.humanAnswer;
    source = "human_answer";
  } else {
    if (!options.scenarioId) throw new Error("Clarification requires an oracle/scenario answer, but this version has no mapped negotiation scenario");
    const scenario = await loadNegotiationScenario(path.join(options.rootDir, "tasks", options.taskId), options.scenarioId);
    answer = scenario.oracleAnswer;
    source = options.answerSource === "oracle" ? "oracle_answer" : "scenario_answer";
  }
  await writeFile(path.join(artifactsPath, "question.md"), options.questions.join("\n\n"), "utf8");
  await writeFile(path.join(artifactsPath, "answer.md"), answer, "utf8");
  await writeFile(path.join(artifactsPath, "result.json"), JSON.stringify({ source, questions: options.questions, answer }, null, 2), "utf8");
  return { answer, source, artifactsPath };
}

export function appendClarificationToImplementationPrompt(prompt: string, answer: string, source: string): string {
  return `${prompt}\n\n## Clarification Answer\nSource: ${source}\n\n${answer}\n`;
}

function buildLifecyclePreflightPrompt(options: { versionId: string; request: string; scenario: NegotiationScenario | null; resolvedAnswer?: string }): string {
  return [
    "# Requirements Preflight",
    "",
    "Return one JSON object only. Do not edit files, run commands that modify files, or implement the request.",
    "",
    'Schema: {"decision":"proceed | clarify | conflict | already_exists","reason":"","questions":[],"affected_areas":[]}',
    "",
    `Version: ${options.versionId}`,
    "## Requested Change",
    options.request,
    ...(options.scenario ? ["", `Scenario id: ${options.scenario.id}`, "## Benchmark Oracle Context", options.scenario.requiredFindings.join("\n")] : []),
    ...(options.resolvedAnswer ? ["", "## Resolved Clarification", options.resolvedAnswer] : [])
  ].join("\n");
}

function mockDecision(scenario: NegotiationScenario | null, resolvedAnswer?: string): AgentDecision {
  if (resolvedAnswer) return { decision: "proceed", confidence: 1, reason: "Clarification answer resolved the requirements.", questions: [], recommended_default: "", affected_areas: [], will_edit: true };
  if (!scenario) return { decision: "proceed", confidence: 1, reason: "Requirements are sufficiently specified.", questions: [], recommended_default: "", affected_areas: [], will_edit: true };
  return {
    decision: scenario.expectedDecision as AgentDecision["decision"],
    confidence: 1,
    reason: scenario.requiredFindings.join(" "),
    questions: scenario.expectedDecision === "clarify" ? scenario.requiredQuestions : [],
    recommended_default: scenario.oracleAnswer,
    affected_areas: scenario.requiredFindings,
    will_edit: scenario.expectedDecision === "proceed"
  };
}

function unknownDecision(reason: string): AgentDecision {
  return { decision: "unknown", confidence: 0, reason, questions: [], recommended_default: "", affected_areas: [], will_edit: false };
}
