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
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CI: process.env.CI ?? "true"
      }
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      clearTimeout(timeout);
      resolve(null);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
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
