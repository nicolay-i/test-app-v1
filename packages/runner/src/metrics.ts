import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";

export type MetricSnapshot = {
  version_id: string;
  code_health: {
    loc_total: number;
    file_count: number;
    largest_file: {
      path: string;
      loc: number;
    };
    duplicate_ratio: number;
    dependency_cycles: number;
    max_cyclomatic_complexity: number;
    normalized: {
      duplication_score: number;
      complexity_score: number;
      dependency_health_score: number;
    };
  };
};

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const ignoredDirs = new Set(["node_modules", "dist", ".git", "coverage", "playwright-report"]);

export async function collectMetrics(
  workspacePath: string,
  versionId: string,
  artifactsPath: string
): Promise<MetricSnapshot> {
  const srcPath = path.join(workspacePath, "src");
  const files = await listSourceFiles(srcPath);
  let locTotal = 0;
  let largestFile = {
    path: "",
    loc: 0
  };
  const contents = new Map<string, string>();

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    contents.set(filePath, content);
    const loc = countLoc(content);
    locTotal += loc;

    if (loc > largestFile.loc) {
      largestFile = {
        path: path.relative(workspacePath, filePath),
        loc
      };
    }
  }

  const snapshot: MetricSnapshot = {
    version_id: versionId,
    code_health: {
      loc_total: locTotal,
      file_count: files.length,
      largest_file: largestFile
      ,duplicate_ratio: duplicateRatio([...contents.values()])
      ,dependency_cycles: dependencyCycleCount(files, contents)
      ,max_cyclomatic_complexity: Math.max(0, ...[...contents.values()].map(cyclomaticComplexity))
      ,normalized: {
        duplication_score: 0,
        complexity_score: 0,
        dependency_health_score: 0
      }
    }
  };
  snapshot.code_health.normalized = {
    duplication_score: clamp01(1 - snapshot.code_health.duplicate_ratio / 0.15),
    complexity_score: clamp01(1 - Math.max(0, snapshot.code_health.max_cyclomatic_complexity - 10) / 30),
    dependency_health_score: snapshot.code_health.dependency_cycles === 0 ? 1 : 0
  };

  await ensureDir(artifactsPath);
  await writeFile(path.join(artifactsPath, "metrics.json"), JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}

async function listSourceFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...(await listSourceFiles(fullPath)));
      }
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function countLoc(content: string): number {
  return content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function duplicateRatio(contents: string[]): number {
  const lines = contents.flatMap((content) => content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 12 && !line.startsWith("//")));
  if (lines.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  const duplicateLines = [...counts.values()].filter((count) => count > 1).reduce((total, count) => total + count, 0);
  return duplicateLines / lines.length;
}

function cyclomaticComplexity(content: string): number {
  const decisions = content.match(/\b(if|for|while|case|catch)\b|\?|&&|\|\|/g)?.length ?? 0;
  return 1 + decisions;
}

function dependencyCycleCount(files: string[], contents: Map<string, string>): number {
  const byRelative = new Map(files.map((file) => [path.resolve(file), file]));
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const imports = [...(contents.get(file)?.matchAll(/from\s+["'](\.[^"']+)["']/g) ?? [])]
      .map((match) => resolveImport(file, match[1]!, byRelative))
      .filter((target): target is string => target !== null);
    graph.set(file, imports);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycles = 0;
  const visit = (file: string): void => {
    if (visiting.has(file)) { cycles += 1; return; }
    if (visited.has(file)) return;
    visiting.add(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
    visiting.delete(file);
    visited.add(file);
  };
  for (const file of files) visit(file);
  return cycles;
}

function resolveImport(from: string, specifier: string, files: Map<string, string>): string | null {
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    const resolved = files.get(candidate);
    if (resolved) return resolved;
  }
  return null;
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
