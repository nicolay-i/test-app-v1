import type { MatrixConfig, TrajectoryPlan } from "./types.js";

export function buildTrajectoryPlan(config: MatrixConfig): TrajectoryPlan[] {
  const trajectories: TrajectoryPlan[] = [];
  const versions = Array.from({ length: config.maxVersions + 1 }, (_, index) => `v${index}`);

  for (const taskId of config.tasks) {
    for (const model of config.models) {
      for (const systemPromptId of config.prompts.system) {
        for (const userPromptId of config.prompts.user) {
          for (const editPromptId of config.prompts.edit) {
            for (let runNumber = 1; runNumber <= config.runsPerCell; runNumber += 1) {
              const trajectoryId = [
                taskId,
                model.id,
                systemPromptId,
                userPromptId,
                editPromptId,
                `r${runNumber}`
              ].join("__");

              trajectories.push({
                trajectoryId,
                taskId,
                modelId: model.id,
                providerModel: model.providerModel,
                systemPromptId,
                userPromptId,
                editPromptId,
                runNumber,
                versions
              });
            }
          }
        }
      }
    }
  }

  return config.randomizeOrder ? deterministicShuffle(trajectories, config.seed) : trajectories;
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  let state = seed || 1;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const swapIndex = state % (index + 1);
    const current = shuffled[index];
    const replacement = shuffled[swapIndex];
    if (current === undefined || replacement === undefined) {
      continue;
    }
    shuffled[index] = replacement;
    shuffled[swapIndex] = current;
  }

  return shuffled;
}
