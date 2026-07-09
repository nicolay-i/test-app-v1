import { access, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeFileIfMissing(filePath: string, content: string): Promise<boolean> {
  if (await pathExists(filePath)) {
    return false;
  }

  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
  return true;
}

export function resolveFromRoot(rootDir: string, maybeRelative: string): string {
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.resolve(rootDir, maybeRelative);
}

export async function copyDirFiltered(source: string, destination: string): Promise<void> {
  await cp(source, destination, {
    recursive: true,
    errorOnExist: false,
    force: false,
    filter: (entry) => {
      const name = path.basename(entry);
      return (
        !["node_modules", "dist", ".git", "coverage", "playwright-report"].includes(name) &&
        !name.startsWith(".ape-") &&
        !name.endsWith(".tsbuildinfo")
      );
    }
  });
}
