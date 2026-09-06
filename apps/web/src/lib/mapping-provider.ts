import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import {
  FixtureSchemaMappingProvider,
  type MappingInput,
} from "@weavetrail/ai-harness";
import {
  ConfiguredSchemaMappingProvider,
  configuredModeRequested,
  readProviderConfiguration,
  ProviderReviewRequired,
  validateConfiguredProposal,
  type ProviderConfiguration,
  type ProviderTrace,
} from "@weavetrail/ai-harness/server";
import {
  SchemaMappingProposalSchema,
  type MappingResponse,
  type ReplayScenario,
} from "@weavetrail/contracts";
import { committedReplaySources } from "./replay-sources";

// Closed artifact allowlist, independent of source values and provider output.
const eligibleScenarios: ReadonlySet<ReplayScenario> = new Set([
  "concentrated-buy-dialect-a.csv",
  "concentrated-buy-dialect-b.jsonl",
]);
const receiptLifetimeMs = 30 * 60 * 1000;
const receiptPurpose = Buffer.from("weavetrail/mapping-receipt/1");

export function mappingRequestRequired(scenario: ReplayScenario) {
  return (
    eligibleScenarios.has(scenario) && configuredModeRequested(process.env)
  );
}

function mappingInput(scenario: ReplayScenario): MappingInput {
  const source = committedReplaySources[scenario];
  return {
    sourceArtifactHash: source.sourceArtifactHash,
    constants: source.constants,
    columns: [...source.columns],
    sampleRows: source.rows.map((row) => row.values),
  };
}

function receiptKey(configuration: ProviderConfiguration) {
  return Buffer.from(
    hkdfSync(
      "sha256",
      configuration.apiKey,
      configuration.baseUrl,
      receiptPurpose,
      32,
    ),
  );
}

type RecordedProposal = {
  proposal: ReturnType<typeof SchemaMappingProposalSchema.parse>;
  trace: ProviderTrace;
};

function seal(record: RecordedProposal, configuration: ProviderConfiguration) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", receiptKey(configuration), iv);
  cipher.setAAD(receiptPurpose);
  const ciphertext = Buffer.concat([
    cipher.update(
      JSON.stringify({ ...record, expiresAt: Date.now() + receiptLifetimeMs }),
      "utf8",
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64url",
  );
}

function unseal(
  receipt: string,
  input: MappingInput,
  configuration: ProviderConfiguration,
): RecordedProposal {
  try {
    const bytes = Buffer.from(receipt, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      receiptKey(configuration),
      bytes.subarray(0, 12),
    );
    decipher.setAAD(receiptPurpose);
    decipher.setAuthTag(bytes.subarray(12, 28));
    const record = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (
      !Number.isSafeInteger(record.expiresAt) ||
      record.expiresAt <= Date.now() ||
      record.trace?.mode !== "ai" ||
      record.trace.model !== configuration.model ||
      typeof record.trace.promptVersion !== "string"
    )
      throw new ProviderReviewRequired();
    return {
      proposal: validateConfiguredProposal(record.proposal, input),
      trace: record.trace,
    };
  } catch {
    throw new ProviderReviewRequired();
  }
}

export async function proposeMapping(
  scenario: ReplayScenario,
): Promise<MappingResponse> {
  const input = mappingInput(scenario);
  if (!mappingRequestRequired(scenario)) {
    const record = await fixtureRecord(input);
    return { mode: "fixture", proposal: record.proposal };
  }
  const configuration = readProviderConfiguration(process.env);
  const provider = new ConfiguredSchemaMappingProvider(configuration);
  const proposal = await provider.propose(input);
  return {
    mode: "ai",
    proposal,
    mappingReceipt: seal({ proposal, trace: provider.trace }, configuration),
  };
}

async function fixtureRecord(input: MappingInput): Promise<RecordedProposal> {
  const provider = new FixtureSchemaMappingProvider();
  return {
    proposal: SchemaMappingProposalSchema.parse(await provider.propose(input)),
    trace: provider.trace,
  };
}

export async function replayMapping(
  scenario: ReplayScenario,
  receipt?: string,
): Promise<RecordedProposal> {
  const input = mappingInput(scenario);
  if (!mappingRequestRequired(scenario)) {
    if (receipt !== undefined) throw new ProviderReviewRequired();
    return fixtureRecord(input);
  }
  const configuration = readProviderConfiguration(process.env);
  if (!receipt) throw new ProviderReviewRequired();
  return unseal(receipt, input, configuration);
}
