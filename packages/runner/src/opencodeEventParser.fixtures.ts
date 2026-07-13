import { parseOpenCodeEvents } from "./opencodeEventParser.js";

export function verifyOpenCodeEventParserFixtures(): string[] {
  const cases = [
    { name: "multipart", stream: '{"type":"text.delta","sessionId":"s1","delta":"Hello "}\n{"type":"text.delta","delta":"world","usage":{"inputTokens":3,"outputTokens":2}}', text: "Hello world", status: "complete" },
    { name: "malformed", stream: '{"type":"text.delta","text":"ok"}\nnot-json', text: "ok", status: "partial" },
    { name: "tool-between-text", stream: '{"type":"text.delta","text":"before "}\n{"type":"tool.call","name":"read"}\n{"type":"text.delta","text":"after"}', text: "before after", status: "complete" },
    { name: "tool-error", stream: '{"type":"tool.error","error":"permission denied"}', text: "", status: "complete" },
    { name: "no-text", stream: '{"type":"session.completed","sessionId":"s2","status":"completed"}', text: "", status: "complete" },
    { name: "usage-absent", stream: '{"type":"text.delta","text":"ok"}', text: "ok", status: "complete" },
    { name: "multiple-json-objects", stream: '{"type":"text.delta","text":"a"}\n{"type":"text.delta","text":"b"}\n{"type":"session.completed","status":"completed"}', text: "ab", status: "complete" },
    { name: "empty", stream: '', text: "", status: "invalid" }
  ] as const;
  const failures: string[] = [];
  for (const item of cases) {
    const result = parseOpenCodeEvents(item.stream);
    if (result.assistantText !== item.text || result.streamStatus !== item.status) failures.push(item.name);
  }
  const usage = parseOpenCodeEvents('{"type":"usage","usage":{"inputTokens":7,"outputTokens":5,"cacheReadTokens":2,"cost":0.01}}');
  if (usage.usage.inputTokens !== 7 || usage.usage.outputTokens !== 5 || usage.usage.totalTokens !== 12 || usage.usage.reportedCost !== 0.01) failures.push("usage-present");
  const stepUsage = parseOpenCodeEvents([
    '{"type":"step_finish","part":{"id":"step-1","tokens":{"total":17,"input":3,"output":2,"reasoning":1,"cache":{"read":10,"write":1}},"cost":0}}',
    '{"type":"step_finish","part":{"id":"step-1","tokens":{"total":17,"input":3,"output":2,"reasoning":1,"cache":{"read":10,"write":1}},"cost":0}}',
    '{"type":"step_finish","part":{"id":"step-2","tokens":{"total":10,"input":4,"output":1,"reasoning":0,"cache":{"read":5,"write":0}},"cost":0}}'
  ].join("\n"));
  if (
    stepUsage.usage.status !== "complete" ||
    stepUsage.usage.inputTokens !== 7 ||
    stepUsage.usage.outputTokens !== 3 ||
    stepUsage.usage.reasoningTokens !== 1 ||
    stepUsage.usage.cacheReadTokens !== 15 ||
    stepUsage.usage.cacheWriteTokens !== 1 ||
    stepUsage.usage.totalTokens !== 27 ||
    stepUsage.usage.reportedCost !== 0
  ) failures.push("step-finish-usage");
  const toolError = parseOpenCodeEvents('{"type":"tool.error","error":"permission denied"}');
  if (!toolError.toolErrors.includes("permission denied")) failures.push("tool-error");
  return failures;
}
