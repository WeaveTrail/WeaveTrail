import { z } from "zod";
import {
  MAPPING_RUN_RECORD_VERSION,
  MappingRunRecordSchema,
  type MappingRunRecord,
} from "@weavetrail/contracts";
import {
  ConfiguredSchemaMappingProvider,
  MAPPING_ADAPTER_VERSION,
  MAPPING_OUTPUT_SCHEMA_VERSION,
  MAPPING_PROMPT_VERSION,
  MAPPING_VALIDATOR_VERSION,
  ProviderReviewRequired,
  validateProviderConfiguration,
  type ProviderConfiguration,
  type ProviderEnvironment,
} from "@weavetrail/ai-harness/server";
import type { MappingInput } from "@weavetrail/ai-harness";

const ModelList = z
  .array(
    z
      .object({
        provider: z.string().trim().min(1).max(256),
        baseUrl: z.string(),
        model: z.string(),
        apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
      })
      .strict(),
  )
  .min(1)
  .max(32);

export type EvaluationModel = ProviderConfiguration & { provider: string };
export type MappingRunContext = Pick<
  MappingRunRecord,
  "evaluationSet" | "dialectId" | "repeat"
>;

// Pure configuration parsing: never selects a model or starts a call.
export function readEvaluationModels(
  env: ProviderEnvironment,
): EvaluationModel[] {
  try {
    return ModelList.parse(JSON.parse(env.AI_EVALUATION_MODELS ?? "")).map(
      (entry) => {
        const configuration = validateProviderConfiguration({
          baseUrl: entry.baseUrl,
          model: entry.model,
          apiKey: env[entry.apiKeyEnv] ?? "",
        });
        if (entry.provider.includes(configuration.apiKey))
          throw new ProviderReviewRequired();
        return { provider: entry.provider, ...configuration };
      },
    );
  } catch {
    throw new ProviderReviewRequired();
  }
}

export function requireLiveMappingCommand(
  args: string[],
  env: ProviderEnvironment,
): void {
  if (!args.includes("--live") || env.CI !== undefined)
    throw new Error("Live mapping requires --live and is disabled in CI.");
}

/** Same adapter as the web path, with only commit-safe observations retained. */
export async function runConfiguredMapping(
  model: EvaluationModel,
  input: MappingInput,
  context: MappingRunContext,
  transport?: typeof fetch,
): Promise<MappingRunRecord> {
  const base = {
    ...context,
    schemaVersion: MAPPING_RUN_RECORD_VERSION,
    provider: model.provider,
    requestedModel: model.model,
    adapterVersion: MAPPING_ADAPTER_VERSION,
    promptVersion: MAPPING_PROMPT_VERSION,
    outputSchemaVersion: MAPPING_OUTPUT_SCHEMA_VERSION,
    validatorVersion: MAPPING_VALIDATOR_VERSION,
    temperature: "0",
  };
  if (model.apiKey && JSON.stringify(base).includes(model.apiKey))
    throw new ProviderReviewRequired();
  // Validate operator context before spending a request.
  MappingRunRecordSchema.parse({
    ...base,
    outcome: "PROVIDER_FAILED",
    failureClass: "UNKNOWN_PROVIDER_FAILURE",
    reportedModel: null,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
    validatorReasons: [],
    parsedOutput: null,
  });
  const result = await new ConfiguredSchemaMappingProvider(
    model,
    transport,
  ).attempt(input);
  return MappingRunRecordSchema.parse({
    ...base,
    outcome: result.outcome,
    failureClass: result.failureClass,
    validatorReasons: result.validatorReasons,
    parsedOutput: result.parsedOutput,
    reportedModel: result.reportedModel,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
    httpStatus: result.httpStatus,
  });
}
