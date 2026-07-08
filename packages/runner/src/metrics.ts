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

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
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
    }
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
