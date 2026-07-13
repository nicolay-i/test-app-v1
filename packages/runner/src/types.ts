export type ModelConfig = {
  id: string;
  providerModel: string;
};

export type MatrixConfig = {
  id: string;
  seed: number;
  outputDir: string;
  opencode: {
    autoApprove: boolean;
    format: "json" | "default";
    attachUrl: string | null;
    timeoutMs: number;
    maxAttempts: number;
    maxContinuations: number;
  };
  clarification: {
    maxRounds: number;
    answerSource: "oracle" | "scenario" | "human";
  };
  scaffold: {
    id: string;
    path: string;
  };
  models: ModelConfig[];
  tasks: string[];
  prompts: {
    system: string[];
    user: string[];
    edit: string[];
  };
  runsPerCell: number;
  maxVersions: number;
  maxRepairAttempts: number;
  concurrency: number;
  randomizeOrder: boolean;
};

export type TrajectoryPlan = {
  trajectoryId: string;
  taskId: string;
  modelId: string;
  providerModel: string;
  systemPromptId: string;
  userPromptId: string;
  editPromptId: string;
  runNumber: number;
  versions: string[];
};

export type BenchEvent = {
  ts: string;
  level: "info" | "warn" | "error";
  matrix_id: string;
  trajectory_id?: string;
  version_id?: string;
  phase: string;
  event: string;
  data?: Record<string, unknown>;
};
