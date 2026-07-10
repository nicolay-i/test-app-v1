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
  let usage = unavailableUsage();

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
    const eventUsage = findUsage(event);
    if (eventUsage) usage = mergeUsage(usage, eventUsage);
  }

  return {
    sessionId,
    assistantText: texts.join(""),
    finishStatus,
    usage,
    toolErrors,
    malformedLines,
    unknownEventTypes: [...unknown].sort(),
    streamStatus: parsedEvents === 0 ? "invalid" : malformedLines > 0 ? "partial" : "complete"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
