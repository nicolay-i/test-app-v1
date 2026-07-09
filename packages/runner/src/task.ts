import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./fs.js";
import { parseSimpleYaml } from "./simpleYaml.js";

export type TaskValidationResult = {
  taskId: string;
  taskDir: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type TaskEvolutionStep = {
  id: string;
  prompt: string;
  tests: string[];
  disabledTests: string[];
};

export async function loadTaskEvolution(taskDir: string): Promise<TaskEvolutionStep[]> {
  const parsed = parseSimpleYaml(await readFile(path.join(taskDir, "task.yaml"), "utf8"));
  const evolution = parsed.evolution;
  if (!Array.isArray(evolution)) {
    return [];
  }

  return evolution
    .filter(isRecord)
    .map((step) => ({
      id: typeof step.id === "string" ? step.id : "",
      prompt: typeof step.prompt === "string" ? step.prompt : "",
      tests: Array.isArray(step.tests) ? step.tests.filter((item): item is string => typeof item === "string") : [],
      disabledTests: Array.isArray(step.disabledTests)
        ? step.disabledTests.filter((item): item is string => typeof item === "string")
        : []
    }))
    .filter((step) => step.id.length > 0 && step.prompt.length > 0);
}

export async function validateTask(taskDir: string): Promise<TaskValidationResult> {
  const taskYamlPath = path.join(taskDir, "task.yaml");
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await pathExists(taskYamlPath))) {
    return {
      taskId: path.basename(taskDir),
      taskDir,
      ok: false,
      errors: [`Missing ${taskYamlPath}`],
      warnings
    };
  }

  const parsed = parseSimpleYaml(await readFile(taskYamlPath, "utf8"));
  const taskId = stringField(parsed, "id", errors) ?? path.basename(taskDir);

  for (const key of ["name", "version", "kind", "scaffold", "license_status"]) {
    stringField(parsed, key, errors);
  }

  validateReferencePaths(parsed, taskDir, errors);
  validateCheckPaths(parsed, taskDir, errors);
  validateScoring(parsed, taskDir, errors);
  validateEvolution(parsed, taskDir, errors, warnings);

  return {
    taskId,
    taskDir,
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function validateCheckPaths(
  parsed: Record<string, unknown>,
  taskDir: string,
  errors: string[]
): void {
  const checks = recordField(parsed, "checks", errors);
  if (!checks) {
    return;
  }

  for (const key of ["e2e", "values", "visual"]) {
    const value = checks[key];
    if (value === undefined) {
      continue;
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      errors.push(`Field "checks.${key}" must be a string array`);
      continue;
    }
    for (const relativePath of value) {
      addMissingPathError(path.join(taskDir, relativePath), errors);
    }
  }
}

function validateReferencePaths(
  parsed: Record<string, unknown>,
  taskDir: string,
  errors: string[]
): void {
  const reference = recordField(parsed, "reference", errors);
  if (!reference) {
    return;
  }

  for (const key of ["spec", "acceptanceCriteria", "semanticUi", "expectedValues"]) {
    const relativePath = stringField(reference, key, errors);
    if (relativePath) {
      addMissingPathError(path.join(taskDir, relativePath), errors);
    }
  }
}

function validateScoring(parsed: Record<string, unknown>, taskDir: string, errors: string[]): void {
  const scoring = recordField(parsed, "scoring", errors);
  if (!scoring) {
    return;
  }

  const weightsPath = stringField(scoring, "weights", errors);
  if (weightsPath) {
    addMissingPathError(path.join(taskDir, weightsPath), errors);
  }
}

function validateEvolution(
  parsed: Record<string, unknown>,
  taskDir: string,
  errors: string[],
  warnings: string[]
): void {
  const evolution = parsed.evolution;
  if (evolution === undefined) {
    errors.push('Missing field "evolution"');
    return;
  }

  if (!Array.isArray(evolution)) {
    errors.push('Field "evolution" must be an array');
    return;
  }

  const ids = new Set<string>();
  for (const [index, step] of evolution.entries()) {
    if (!isRecord(step)) {
      errors.push(`Evolution step ${index} must be an object`);
      continue;
    }

    const id = stringField(step, "id", errors);
    if (id) {
      if (ids.has(id)) {
        errors.push(`Duplicate evolution id "${id}"`);
      }
      ids.add(id);
    }

    const prompt = stringField(step, "prompt", errors);
    if (prompt) {
      addMissingPathError(path.join(taskDir, prompt), errors);
    }

    const tests = step.tests;
    if (tests === undefined) {
      warnings.push(`Evolution step "${id ?? index}" has no tests`);
    } else if (!Array.isArray(tests) || tests.some((item) => typeof item !== "string")) {
      errors.push(`Evolution step "${id ?? index}" tests must be a string array`);
    } else {
      for (const testPath of tests) {
        addMissingPathError(path.join(taskDir, testPath), errors);
      }
    }

    const disabledTests = step.disabledTests;
    if (disabledTests !== undefined) {
      if (!Array.isArray(disabledTests) || disabledTests.some((item) => typeof item !== "string")) {
        errors.push(`Evolution step "${id ?? index}" disabledTests must be a string array`);
      } else {
        for (const testPath of disabledTests) {
          addMissingPathError(path.join(taskDir, testPath), errors);
        }
      }
    }
  }
}

function addMissingPathError(filePath: string, errors: string[]): void {
  // Async path checks are collected by validateTask callers through this sync placeholder.
  // The actual check is performed lazily via a promise wrapper below.
  errors.push(`__PATH_CHECK__${filePath}`);
}

async function normalizePathChecks(result: TaskValidationResult): Promise<TaskValidationResult> {
  const errors: string[] = [];

  for (const error of result.errors) {
    if (!error.startsWith("__PATH_CHECK__")) {
      errors.push(error);
      continue;
    }

    const filePath = error.slice("__PATH_CHECK__".length);
    if (!(await pathExists(filePath))) {
      errors.push(`Missing ${path.relative(result.taskDir, filePath)}`);
    }
  }

  return {
    ...result,
    ok: errors.length === 0,
    errors
  };
}

export async function validateTaskWithPathChecks(taskDir: string): Promise<TaskValidationResult> {
  return normalizePathChecks(await validateTask(taskDir));
}

function stringField(
  source: Record<string, unknown>,
  key: string,
  errors: string[]
): string | undefined {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`Field "${key}" must be a non-empty string`);
    return undefined;
  }
  return value;
}

function recordField(
  source: Record<string, unknown>,
  key: string,
  errors: string[]
): Record<string, unknown> | undefined {
  const value = source[key];
  if (!isRecord(value)) {
    errors.push(`Field "${key}" must be an object`);
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
