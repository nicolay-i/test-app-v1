import { appendFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";
import type { BenchEvent } from "./types.js";

export class EventLogger {
  private readonly eventsPath: string;
  private readonly matrixId: string;

  constructor(runDir: string, matrixId: string) {
    this.eventsPath = path.join(runDir, "events.jsonl");
    this.matrixId = matrixId;
  }

  async write(event: Omit<BenchEvent, "ts" | "matrix_id">): Promise<void> {
    await ensureDir(path.dirname(this.eventsPath));

    const fullEvent: BenchEvent = {
      ts: new Date().toISOString(),
      matrix_id: this.matrixId,
      ...event
    };

    await appendFile(this.eventsPath, `${JSON.stringify(fullEvent)}\n`, "utf8");
  }
}
