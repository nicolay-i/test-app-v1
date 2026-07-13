export type UsageStatus = "complete" | "partial" | "unavailable" | "invalid";

export type AgentUsage = {
  status: UsageStatus;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  totalTokens: number | null;
  reportedCost: number | null;
  currency: string | null;
  source: "events" | "session_export" | "stats" | "unavailable";
};

export type OpenCodeUsage = AgentUsage;

export type ParsedOpenCodeResult = {
  sessionId: string | null;
  assistantText: string;
  finishStatus: string | null;
  usage: OpenCodeUsage;
  toolErrors: string[];
  malformedLines: number;
  unknownEventTypes: string[];
  streamStatus: "complete" | "partial" | "invalid";
  /** Individual model steps, retained to deduplicate same-session continuations. */
  stepUsageParts: Array<{ partId: string; usage: AgentUsage }>;
};

const unavailableUsage = (): AgentUsage => ({
  status: "unavailable",
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  totalTokens: null,
  reportedCost: null,
  currency: null,
  source: "unavailable",
});

/** Parses OpenCode's newline-delimited event stream without assuming one event schema. */
export function parseOpenCodeEvents(stream: string): ParsedOpenCodeResult {
  const texts: string[] = [];
  const toolErrors: string[] = [];
  const unknown = new Set<string>();
  let malformedLines = 0;
  let parsedEvents = 0;
  let sessionId: string | null = null;
  let finishStatus: string | null = null;
  let fallbackUsage = unavailableUsage();
  const stepUsage = emptyStepUsage();
  const seenStepPartIds = new Set<string>();
  const stepUsageParts: ParsedOpenCodeResult["stepUsageParts"] = [];

  for (const line of stream.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: unknown;
    try {
      event = JSON.parse(trimmed);
      parsedEvents += 1;
    } catch {
      malformedLines += 1;
      continue;
    }
    if (!isRecord(event)) {
      malformedLines += 1;
      continue;
    }

    const type = stringAt(event, "type") ?? stringAt(event, "event") ?? "unknown";
    if (!isRecognizedType(type)) unknown.add(type);
    sessionId ??= findString(event, ["sessionID", "sessionId", "session_id"]);
    finishStatus ??= findString(event, ["finish", "finishReason", "finish_reason", "status"]);
    const text = assistantText(event);
    if (text) texts.push(text);
    const toolError = findToolError(event, type);
    if (toolError) toolErrors.push(toolError);
    const step = findStepUsage(event, type);
    if (step && !seenStepPartIds.has(step.partId)) {
      seenStepPartIds.add(step.partId);
      addStepUsage(stepUsage, step);
      stepUsageParts.push({ partId: step.partId, usage: usageForStep(step) });
    }
    const eventUsage = findUsage(event);
    if (eventUsage) fallbackUsage = mergeUsage(fallbackUsage, eventUsage);
  }

  return {
    sessionId,
    assistantText: texts.join(""),
    finishStatus,
    usage: stepUsage.count > 0 ? finalizeStepUsage(stepUsage) : fallbackUsage,
    toolErrors,
    malformedLines,
    unknownEventTypes: [...unknown].sort(),
    streamStatus: parsedEvents === 0 ? "invalid" : malformedLines > 0 ? "partial" : "complete"
    ,stepUsageParts
  };
}

type StepUsage = {
  count: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reportedCost: number | null;
};

type ParsedStepUsage = Omit<StepUsage, "count" | "reportedCost"> & { partId: string; reportedCost: number | null };

function emptyStepUsage(): StepUsage {
  return {
    count: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reportedCost: null
  };
}

function findStepUsage(event: Record<string, unknown>, type: string): ParsedStepUsage | null {
  if (type !== "step_finish") return null;
  const part = recordAt(event, "part");
  if (!part) return null;
  const tokens = recordAt(part, "tokens");
  const partId = typeof part.id === "string" ? part.id : null;
  if (!tokens || !partId) return null;
  const inputTokens = numberAt(tokens, "input");
  const outputTokens = numberAt(tokens, "output");
  const reasoningTokens = numberAt(tokens, "reasoning") ?? 0;
  const cache = recordAt(tokens, "cache");
  const cacheReadTokens = cache ? numberAt(cache, "read") ?? 0 : 0;
  const cacheWriteTokens = cache ? numberAt(cache, "write") ?? 0 : 0;
  if (inputTokens === null || outputTokens === null) return null;
  return {
    partId,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reportedCost: numberAt(part, "cost")
  };
}

function addStepUsage(total: StepUsage, step: ParsedStepUsage): void {
  total.count += 1;
  total.inputTokens += step.inputTokens;
  total.outputTokens += step.outputTokens;
  total.reasoningTokens += step.reasoningTokens;
  total.cacheReadTokens += step.cacheReadTokens;
  total.cacheWriteTokens += step.cacheWriteTokens;
  if (step.reportedCost !== null) total.reportedCost = (total.reportedCost ?? 0) + step.reportedCost;
}

function finalizeStepUsage(usage: StepUsage): AgentUsage {
  return {
    status: "complete",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    totalTokens: usage.inputTokens + usage.outputTokens + usage.reasoningTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
    reportedCost: usage.reportedCost,
    currency: null,
    source: "events"
  };
}

function usageForStep(step: ParsedStepUsage): AgentUsage {
  return {
    status: "complete",
    inputTokens: step.inputTokens,
    outputTokens: step.outputTokens,
    reasoningTokens: step.reasoningTokens,
    cacheReadTokens: step.cacheReadTokens,
    cacheWriteTokens: step.cacheWriteTokens,
    totalTokens: step.inputTokens + step.outputTokens + step.reasoningTokens + step.cacheReadTokens + step.cacheWriteTokens,
    reportedCost: step.reportedCost,
    currency: null,
    source: "events"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return isRecord(value[key]) ? value[key] : null;
}

function numberAt(value: Record<string, unknown>, key: string): number | null {
  return typeof value[key] === "number" ? value[key] : null;
}

function stringAt(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === "string" ? value[key] : null;
}

function findString(value: unknown, keys: string[]): string | null {
  if (!isRecord(value)) return null;
  for (const key of keys) if (typeof value[key] === "string") return value[key];
  for (const child of Object.values(value)) {
    const found = findString(child, keys);
    if (found) return found;
  }
  return null;
}

function assistantText(event: Record<string, unknown>): string {
  const type = (stringAt(event, "type") ?? stringAt(event, "event") ?? "").toLowerCase();
  const role = findString(event, ["role"]);
  if (!type.includes("text") && !type.includes("message") && role !== "assistant") return "";
  const candidate = findString(event, ["text", "delta", "content"]);
  return candidate ?? "";
}

function findToolError(event: Record<string, unknown>, type: string): string | null {
  const error = findString(event, ["error", "message"]);
  return error && (type.toLowerCase().includes("tool") || type.toLowerCase().includes("error")) ? error : null;
}

function findUsage(event: Record<string, unknown>): Partial<AgentUsage> | null {
  const input = findNumber(event, ["inputTokens", "input_tokens", "prompt_tokens"]);
  const output = findNumber(event, ["outputTokens", "output_tokens", "completion_tokens"]);
  const reasoning = findNumber(event, ["reasoningTokens", "reasoning_tokens"]);
  const cacheRead = findNumber(event, ["cacheReadTokens", "cache_read_tokens"]);
  const cacheWrite = findNumber(event, ["cacheWriteTokens", "cache_write_tokens"]);
  const total = findNumber(event, ["totalTokens", "total_tokens"]);
  const cost = findNumber(event, ["cost", "reportedCost", "reported_cost"]);
  if ([input, output, cacheRead, cacheWrite, total, cost].every((value) => value === null)) return null;
  const totalTokens = total ?? (input !== null && output !== null ? input + output : null);
  return {
    status: input !== null && output !== null && totalTokens !== null ? "complete" : "partial",
    inputTokens: input,
    outputTokens: output,
    reasoningTokens: reasoning,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    totalTokens,
    reportedCost: cost,
    currency: findString(event, ["currency"]),
    source: "events",
  };
}

function findNumber(value: unknown, keys: string[]): number | null {
  if (!isRecord(value)) return null;
  for (const key of keys) if (typeof value[key] === "number") return value[key];
  for (const child of Object.values(value)) {
    const found = findNumber(child, keys);
    if (found !== null) return found;
  }
  return null;
}

function mergeUsage(current: AgentUsage, next: Partial<AgentUsage>): AgentUsage {
  const inputTokens = next.inputTokens ?? current.inputTokens;
  const outputTokens = next.outputTokens ?? current.outputTokens;
  const totalTokens = next.totalTokens ?? current.totalTokens;
  return {
    status: inputTokens !== null && outputTokens !== null && totalTokens !== null ? "complete" : next.status === "invalid" ? "invalid" : "partial",
    inputTokens,
    outputTokens,
    reasoningTokens: next.reasoningTokens ?? current.reasoningTokens,
    cacheReadTokens: next.cacheReadTokens ?? current.cacheReadTokens,
    cacheWriteTokens: next.cacheWriteTokens ?? current.cacheWriteTokens,
    totalTokens,
    reportedCost: next.reportedCost ?? current.reportedCost,
    currency: next.currency ?? current.currency,
    source: next.source ?? current.source,
  };
}

function isRecognizedType(type: string): boolean {
  return /message|text|session|step|tool|error|usage|finish|complete|status/i.test(type);
}
