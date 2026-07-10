import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseSimpleYaml } from "./simpleYaml.js";
import type { MatrixConfig, ModelConfig } from "./types.js";

export async function loadMatrixConfig(configPath: string): Promise<MatrixConfig> {
  const raw = await readFile(configPath, "utf8");
  const parsed = parseSimpleYaml(raw);
  const config = normalizeMatrixConfig(parsed);

  return {
    ...config,
    scaffold: {
      ...config.scaffold,
      path: path.normalize(config.scaffold.path)
    }
  };
}

function normalizeMatrixConfig(value: Record<string, unknown>): MatrixConfig {
  const prompts = requiredRecord(value, "prompts");
  const opencode = requiredRecord(value, "opencode");
  const scaffold = requiredRecord(value, "scaffold");

  return {
    id: requiredString(value, "id"),
    seed: optionalNumber(value, "seed", 42),
    outputDir: optionalString(value, "outputDir", "runs"),
    opencode: {
      autoApprove: optionalBoolean(opencode, "autoApprove", true),
      format: optionalEnum(opencode, "format", ["json", "default"], "json"),
      attachUrl: optionalNullableString(opencode, "attachUrl", null),
      timeoutMs: optionalNumber(opencode, "timeoutMs", 900000),
      maxAttempts: optionalNumber(opencode, "maxAttempts", 2)
    },
    scaffold: {
      id: requiredString(scaffold, "id"),
      path: requiredString(scaffold, "path")
    },
    models: requiredModels(value, "models"),
    tasks: requiredStringArray(value, "tasks"),
    prompts: {
      system: requiredStringArray(prompts, "system"),
      user: requiredStringArray(prompts, "user"),
      edit: requiredStringArray(prompts, "edit")
    },
    runsPerCell: optionalNumber(value, "runsPerCell", 1),
    maxVersions: optionalNumber(value, "maxVersions", 0),
    maxRepairAttempts: optionalNumber(value, "maxRepairAttempts", 0),
    concurrency: optionalNumber(value, "concurrency", 1),
    randomizeOrder: optionalBoolean(value, "randomizeOrder", false)
  };
}

function requiredModels(source: Record<string, unknown>, key: string): ModelConfig[] {
  const value = source[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Config field "${key}" must be a non-empty array`);
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Config field "${key}[${index}]" must be an object`);
    }
    return {
      id: requiredString(item, "id"),
      providerModel: requiredString(item, "providerModel")
    };
  });
}

function requiredRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  if (!isRecord(value)) {
    throw new Error(`Config field "${key}" must be an object`);
  }
  return value;
}

function requiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Config field "${key}" must be a non-empty string`);
  }
  return value;
}

function requiredStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string")) {
    throw new Error(`Config field "${key}" must be a non-empty string array`);
  }
  return value as string[];
}

function optionalString(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Config field "${key}" must be a string`);
  }
  return value;
}

function optionalNullableString(
  source: Record<string, unknown>,
  key: string,
  fallback: string | null
): string | null {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Config field "${key}" must be a string or null`);
  }
  return value;
}

function optionalNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Config field "${key}" must be a finite number`);
  }
  return value;
}

function optionalBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Config field "${key}" must be a boolean`);
  }
  return value;
}

function optionalEnum<const T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const value = source[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Config field "${key}" must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
