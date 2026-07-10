import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";
import { runOpenCode } from "./opencodeAdapter.js";
import { parseSimpleYaml } from "./simpleYaml.js";
import type { RunType } from "./artifacts.js";

export type NegotiationScenario = {
  id: string;
  version: string;
  request: string;
  expectedDecision: string;
  requiredFindings: string[];
  requiredQuestions: string[];
  prohibitedBehavior: string[];
  oracleAnswer: string;
};

export type AgentDecision = {
  decision: "proceed" | "clarify" | "already_exists" | "conflict" | "out_of_scope" | "unknown";
  confidence: number;
  reason: string;
  questions: string[];
  recommended_default: string;
  affected_areas: string[];
  will_edit: boolean;
};

export type NegotiationScore = {
  scenario_id: string;
  expected_decision: string;
  actual_decision: string;
  decision_accuracy: number;
  required_findings_recall: number;
  required_questions_recall: number;
  prohibited_behavior_violations: string[];
  clarification_score: number;
  oracle_answer_sent: boolean;
};

export async function loadNegotiationScenario(taskDir: string, scenarioId: string): Promise<NegotiationScenario> {
  const scenarioPath = path.join(taskDir, "negotiation", `${scenarioId}.yaml`);
  const parsed = parseSimpleYaml(await readFile(scenarioPath, "utf8"));
  return {
    id: readString(parsed, "id"),
    version: readString(parsed, "version"),
    request: readString(parsed, "request"),
    expectedDecision: normalizeExpectedDecision(readString(parsed, "expectedDecision")),
    requiredFindings: readStringArray(parsed, "requiredFindings"),
    requiredQuestions: readStringArray(parsed, "requiredQuestions"),
    prohibitedBehavior: readStringArray(parsed, "prohibitedBehavior"),
    oracleAnswer: readString(parsed, "oracleAnswer")
  };
}

export async function runNegotiationPreflight(options: {
  artifactsPath: string;
  scenario: NegotiationScenario;
  runType: RunType;
  providerModel: string;
  workspacePath: string;
  opencodeFormat: "json" | "default";
  autoApprove: boolean;
  timeoutMs: number;
  currentAppContext?: string;
}): Promise<{ decision: AgentDecision; score: NegotiationScore }> {
  await ensureDir(options.artifactsPath);
  const prompt = buildDecisionPrompt(options.scenario, options.currentAppContext);
  const promptPath = path.join(options.artifactsPath, "prompt.md");
  await writeFile(promptPath, prompt, "utf8");

  const decision =
    options.runType === "mock"
      ? mockDecision(options.scenario)
      : await runRealDecision({
          artifactsPath: options.artifactsPath,
          prompt,
          promptPath,
          providerModel: options.providerModel,
          workspacePath: options.workspacePath,
          opencodeFormat: options.opencodeFormat,
          autoApprove: options.autoApprove,
          timeoutMs: options.timeoutMs
        });
  const score = scoreNegotiationDecision(options.scenario, decision);
  const oracleAnswerSent = decision.decision === "clarify";
  const finalScore = {
    ...score,
    oracle_answer_sent: oracleAnswerSent
  };

  await writeFile(path.join(options.artifactsPath, "agent-decision.json"), JSON.stringify(decision, null, 2), "utf8");
  await writeFile(path.join(options.artifactsPath, "negotiation-score.json"), JSON.stringify(finalScore, null, 2), "utf8");
  if (oracleAnswerSent) {
    await writeFile(path.join(options.artifactsPath, "oracle-answer.md"), options.scenario.oracleAnswer, "utf8");
    await writeFile(path.join(options.artifactsPath, "implementation-prompt.md"), buildNegotiatedImplementationPrompt(options.scenario), "utf8");
  }

  return {
    decision,
    score: finalScore
  };
}

function buildDecisionPrompt(scenario: NegotiationScenario, currentAppContext?: string): string {
  return [
    "# Requirements Negotiation Preflight",
    "",
    "Return a single JSON decision object only. Do not edit files.",
    "",
    "Allowed decisions: proceed, clarify, already_exists, conflict, out_of_scope.",
    "",
    "Ask clarification only when ambiguity affects user-visible behavior, data model, persistence, migration, existing flows, or regression risk.",
    "",
    "Schema:",
    "{",
    '  "decision": "proceed | clarify | already_exists | conflict | out_of_scope",',
    '  "confidence": 0.0,',
    '  "reason": "",',
    '  "questions": [],',
    '  "recommended_default": "",',
    '  "affected_areas": [],',
    '  "will_edit": false',
    "}",
    "",
    "## Current App Snapshot",
    currentAppContext ?? "TodoMVC lifecycle app with create, complete, edit, delete, filters and localStorage persistence.",
    "",
    "## Scenario",
    `Scenario id: ${scenario.id}`,
    `Current version: ${scenario.version}`,
    `Request: ${scenario.request}`
  ].join("\n");
}

export function buildNegotiatedImplementationPrompt(scenario: NegotiationScenario): string {
  return [
    "# Negotiated Implementation Task",
    "",
    "Implement the clarified behavior. Preserve existing behavior and avoid unrelated changes.",
    "",
    "## Original Request",
    scenario.request,
    "",
    "## Oracle Answer",
    scenario.oracleAnswer
  ].join("\n");
}

export function scenarioEvolutionStepIndex(scenario: NegotiationScenario): number | undefined {
  if (scenario.id.startsWith("01-") || scenario.id.startsWith("02-")) {
    return undefined;
  }
  if (scenario.id.startsWith("03-")) {
    return 2;
  }
  if (scenario.id.startsWith("04-")) {
    return 3;
  }
  const versionNumber = Number(scenario.version.replace(/^v/, ""));
  return Number.isInteger(versionNumber) && versionNumber > 0 ? versionNumber - 1 : undefined;
}

function mockDecision(scenario: NegotiationScenario): AgentDecision {
  return {
    decision: scenario.expectedDecision as AgentDecision["decision"],
    confidence: 0.9,
    reason: scenario.requiredFindings.join(" "),
    questions: scenario.expectedDecision === "clarify" || scenario.requiredQuestions.length > 0 ? scenario.requiredQuestions : [],
    recommended_default: scenario.oracleAnswer,
    affected_areas: scenario.requiredFindings,
    will_edit: scenario.expectedDecision === "proceed"
  };
}

async function runRealDecision(options: {
  artifactsPath: string;
  prompt: string;
  promptPath: string;
  providerModel: string;
  workspacePath: string;
  opencodeFormat: "json" | "default";
  autoApprove: boolean;
  timeoutMs: number;
}): Promise<AgentDecision> {
  const result = await runOpenCode({
    model: options.providerModel,
    cwd: options.workspacePath,
    prompt: options.prompt,
    promptPath: options.promptPath,
    title: "negotiation-preflight",
    artifactsPath: options.artifactsPath,
    format: options.opencodeFormat,
    autoApprove: options.autoApprove,
    timeoutMs: options.timeoutMs
  });
  if (!result.ok) {
    return unknownDecision(`OpenCode failed with exit code ${result.exitCode}`);
  }
  await writeFile(path.join(options.artifactsPath, "agent-decision.raw.txt"), result.parsed.assistantText, "utf8");
  return parseDecision(result.parsed.assistantText);
}

export function parseDecision(raw: string): AgentDecision {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return unknownDecision("No JSON decision found.");
  }
  try {
    const parsed = JSON.parse(jsonText) as Partial<AgentDecision>;
    return {
      decision: normalizeDecision(parsed.decision),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      questions: Array.isArray(parsed.questions) ? parsed.questions.filter((item): item is string => typeof item === "string") : [],
      recommended_default: typeof parsed.recommended_default === "string" ? parsed.recommended_default : "",
      affected_areas: Array.isArray(parsed.affected_areas)
        ? parsed.affected_areas.filter((item): item is string => typeof item === "string")
        : [],
      will_edit: typeof parsed.will_edit === "boolean" ? parsed.will_edit : false
    };
  } catch {
    return unknownDecision("Invalid JSON decision.");
  }
}

function scoreNegotiationDecision(scenario: NegotiationScenario, decision: AgentDecision): NegotiationScore {
  const reasonAndAreas = [decision.reason, ...decision.affected_areas, ...decision.questions].join(" ").toLowerCase();
  const findingsRecall = recall(scenario.requiredFindings, reasonAndAreas);
  const questionsRecall = scenario.requiredQuestions.length === 0 ? 1 : recall(scenario.requiredQuestions, decision.questions.join(" ").toLowerCase());
  const violations = scenario.prohibitedBehavior.filter((item) => reasonAndAreas.includes(item.toLowerCase()));
  const decisionAccuracy = decision.decision === scenario.expectedDecision ? 1 : acceptableDecision(scenario.expectedDecision, decision.decision) ? 0.5 : 0;
  const clarificationScore = 0.5 * decisionAccuracy + 0.25 * findingsRecall + 0.25 * questionsRecall - violations.length * 0.25;

  return {
    scenario_id: scenario.id,
    expected_decision: scenario.expectedDecision,
    actual_decision: decision.decision,
    decision_accuracy: decisionAccuracy,
    required_findings_recall: findingsRecall,
    required_questions_recall: questionsRecall,
    prohibited_behavior_violations: violations,
    clarification_score: Math.max(0, Math.min(1, clarificationScore)),
    oracle_answer_sent: false
  };
}

function recall(required: string[], haystack: string): number {
  if (required.length === 0) {
    return 1;
  }
  const matched = required.filter((item) => tokenOverlap(item, haystack) >= 0.5).length;
  return matched / required.length;
}

function tokenOverlap(needle: string, haystack: string): number {
  const tokens = needle.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  if (tokens.length === 0) {
    return 1;
  }
  return tokens.filter((token) => haystack.includes(token)).length / tokens.length;
}

function acceptableDecision(expected: string, actual: string): boolean {
  return expected === "clarify" && actual === "proceed";
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return raw.slice(start, end + 1);
}

function normalizeExpectedDecision(value: string): string {
  if (value === "clarify_or_assume_with_default") {
    return "clarify";
  }
  return value;
}

function normalizeDecision(value: unknown): AgentDecision["decision"] {
  return value === "proceed" ||
    value === "clarify" ||
    value === "already_exists" ||
    value === "conflict" ||
    value === "out_of_scope"
    ? value
    : "unknown";
}

function unknownDecision(reason: string): AgentDecision {
  return {
    decision: "unknown",
    confidence: 0,
    reason,
    questions: [],
    recommended_default: "",
    affected_areas: [],
    will_edit: false
  };
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Scenario field "${key}" must be a string`);
  }
  return value;
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
