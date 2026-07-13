import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";

export type CommandResult = {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  logPath: string;
};

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  logPath: string,
  timeoutMs: number
): Promise<CommandResult> {
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";

  await ensureDir(path.dirname(logPath));

  const exitCode = await new Promise<number | null>((resolve) => {
    let settled = false;
    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(code);
    };
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CI: process.env.CI ?? "true"
      }
    });

    const timeout = setTimeout(() => {
      stderr += `\nTimed out after ${timeoutMs}ms\n`;
      terminateProcessTree(child);
      // On Windows a killed pnpm.cmd may never emit close. The evaluator must
      // still return a classified timeout rather than hang forever.
      finish(null);
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      finish(null);
    });

    child.on("close", (code) => {
      finish(code);
    });
  });

  const durationMs = Date.now() - startedAt;
  const rendered = [
    `$ ${command} ${args.join(" ")}`,
    `cwd: ${cwd}`,
    `exitCode: ${exitCode}`,
    `durationMs: ${durationMs}`,
    "",
    "## stdout",
    stdout.trimEnd(),
    "",
    "## stderr",
    stderr.trimEnd(),
    ""
  ].join("\n");

  await writeFile(logPath, rendered, "utf8");

  return {
    command,
    args,
    cwd,
    exitCode,
    durationMs,
    stdout,
    stderr,
    logPath
  };
}

function terminateProcessTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (process.platform !== "win32") {
    child.kill("SIGTERM");
    return;
  }
  // pnpm.cmd spawns nested cmd/node processes. Killing only the launcher leaves
  // installs running forever and prevents the command's close event.
  const taskkill = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  taskkill.once("error", () => child.kill("SIGTERM"));
}
