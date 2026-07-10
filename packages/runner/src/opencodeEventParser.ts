export type OpenCodeUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  totalTokens: number | null;
  reportedCost: number | null;
  source: "events" | "stats" | "unavailable";
  complete: boolean;
};

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

const unavailableUsage = (): OpenCodeUsage => ({
  inputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  totalTokens: null,
  reportedCost: null,
  source: "unavailable",
  complete: false
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

function findUsage(event: Record<string, unknown>): Partial<OpenCodeUsage> | null {
  const input = findNumber(event, ["inputTokens", "input_tokens", "prompt_tokens"]);
  const output = findNumber(event, ["outputTokens", "output_tokens", "completion_tokens"]);
  const cacheRead = findNumber(event, ["cacheReadTokens", "cache_read_tokens"]);
  const cacheWrite = findNumber(event, ["cacheWriteTokens", "cache_write_tokens"]);
  const total = findNumber(event, ["totalTokens", "total_tokens"]);
  const cost = findNumber(event, ["cost", "reportedCost", "reported_cost"]);
  if ([input, output, cacheRead, cacheWrite, total, cost].every((value) => value === null)) return null;
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    totalTokens: total ?? (input !== null && output !== null ? input + output : null),
    reportedCost: cost,
    source: "events",
    complete: input !== null && output !== null
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

function mergeUsage(current: OpenCodeUsage, next: Partial<OpenCodeUsage>): OpenCodeUsage {
  return {
    inputTokens: next.inputTokens ?? current.inputTokens,
    outputTokens: next.outputTokens ?? current.outputTokens,
    cacheReadTokens: next.cacheReadTokens ?? current.cacheReadTokens,
    cacheWriteTokens: next.cacheWriteTokens ?? current.cacheWriteTokens,
    totalTokens: next.totalTokens ?? current.totalTokens,
    reportedCost: next.reportedCost ?? current.reportedCost,
    source: next.source ?? current.source,
    complete: Boolean(next.complete ?? current.complete)
  };
}

function isRecognizedType(type: string): boolean {
  return /message|text|session|step|tool|error|usage|finish|complete|status/i.test(type);
}
