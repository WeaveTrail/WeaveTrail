import { actorlessMultiInstrumentScenario } from "./actorless-multi-instrument";
import {
  concentratedBuyDialectARows,
  concentratedBuyDialectBRows,
} from "./source-rows";
import {
  concentratedBuyDialectAMapping,
  concentratedBuyDialectBMapping,
  concentratedBuyDialectAProposal,
  concentratedBuyDialectBProposal,
} from "./source-mappings";
import { rapidPriceLiftScenarios } from "./rapid-price-lift-scenarios";
import { publishedExecutionSchemaScenario } from "./published-execution-schema";
import { syntheticSourceProvenanceByArtifact } from "./source-provenance";

const syntheticScenarios = {
  "actorless-multi-instrument-quotes.jsonl": actorlessMultiInstrumentScenario,
  "concentrated-buy-dialect-a.csv": {
    label: "Dialect A · CSV",
    sourceArtifactHash: concentratedBuyDialectAMapping.sourceArtifactHash,
    constants: concentratedBuyDialectAProposal.constants,
    columns: concentratedBuyDialectAProposal.fields.map(
      ({ sourceColumn }) => sourceColumn,
    ),
    rows: concentratedBuyDialectARows,
  },
  "concentrated-buy-dialect-b.jsonl": {
    label: "Dialect B · JSON Lines",
    sourceArtifactHash: concentratedBuyDialectBMapping.sourceArtifactHash,
    constants: concentratedBuyDialectBProposal.constants,
    columns: concentratedBuyDialectBProposal.fields.map(
      ({ sourceColumn }) => sourceColumn,
    ),
    rows: concentratedBuyDialectBRows,
  },
  "published-execution-fix44.csv": publishedExecutionSchemaScenario.fix,
  "published-execution-fix44-conflicting-evidence.csv":
    publishedExecutionSchemaScenario.conflict,
  "published-execution-h0stcnt0.jsonl":
    publishedExecutionSchemaScenario.h0stcnt0,
  ...rapidPriceLiftScenarios,
} as const;

export const committedReplayScenarios = Object.fromEntries(
  Object.entries(syntheticScenarios).map(([name, scenario]) => [
    name,
    {
      ...scenario,
      provenance:
        syntheticSourceProvenanceByArtifact[
          name as keyof typeof syntheticSourceProvenanceByArtifact
        ],
    },
  ]),
) as {
  [
    Name in keyof typeof syntheticScenarios
  ]: (typeof syntheticScenarios)[Name] & {
    provenance: (typeof syntheticSourceProvenanceByArtifact)[Name];
  };
};

export type ReplayScenarioPurpose = "REVIEWER_FACING" | "ENGINE_REGRESSION";

export type ReplayScenarioMutation = "baseline" | "shuffle" | "duplicate";

type ScenarioCatalogEntry = {
  purpose: ReplayScenarioPurpose;
  availableInCaseReplay: boolean;
  availableMutations: readonly ReplayScenarioMutation[];
};

const syntheticMutations = ["baseline", "shuffle", "duplicate"] as const;

/**
 * Classification stays beside the synthetic registry. Published-schema
 * projections are reviewer-facing. Placeholder sources remain engine regression
 * fixtures; the not-supported fallback stays selectable until a grounded source
 * reproduces that declared result meaning.
 */
export const replayScenarioCatalog = {
  "actorless-multi-instrument-quotes.jsonl": {
    purpose: "ENGINE_REGRESSION",
    availableInCaseReplay: false,
    availableMutations: syntheticMutations,
  },
  "concentrated-buy-dialect-a.csv": {
    purpose: "ENGINE_REGRESSION",
    availableInCaseReplay: false,
    availableMutations: syntheticMutations,
  },
  "concentrated-buy-dialect-b.jsonl": {
    purpose: "ENGINE_REGRESSION",
    availableInCaseReplay: false,
    availableMutations: syntheticMutations,
  },
  "published-execution-fix44.csv": {
    purpose: "REVIEWER_FACING",
    availableInCaseReplay: true,
    availableMutations: syntheticMutations,
  },
  "published-execution-fix44-conflicting-evidence.csv": {
    purpose: "REVIEWER_FACING",
    availableInCaseReplay: true,
    availableMutations: syntheticMutations,
  },
  "published-execution-h0stcnt0.jsonl": {
    purpose: "REVIEWER_FACING",
    availableInCaseReplay: true,
    availableMutations: syntheticMutations,
  },
  "rapid-price-lift-supported.csv": {
    purpose: "ENGINE_REGRESSION",
    availableInCaseReplay: false,
    availableMutations: syntheticMutations,
  },
  "rapid-price-lift-broad-participation.csv": {
    purpose: "ENGINE_REGRESSION",
    availableInCaseReplay: true,
    availableMutations: syntheticMutations,
  },
  "rapid-price-lift-insufficient-evidence.csv": {
    purpose: "REVIEWER_FACING",
    availableInCaseReplay: true,
    availableMutations: syntheticMutations,
  },
} as const satisfies Record<
  keyof typeof committedReplayScenarios,
  ScenarioCatalogEntry
>;

export const reviewerFacingReplayScenarios = {
  "published-execution-fix44.csv":
    committedReplayScenarios["published-execution-fix44.csv"],
  "published-execution-fix44-conflicting-evidence.csv":
    committedReplayScenarios[
      "published-execution-fix44-conflicting-evidence.csv"
    ],
  "published-execution-h0stcnt0.jsonl":
    committedReplayScenarios["published-execution-h0stcnt0.jsonl"],
  "rapid-price-lift-broad-participation.csv":
    committedReplayScenarios["rapid-price-lift-broad-participation.csv"],
  "rapid-price-lift-insufficient-evidence.csv":
    committedReplayScenarios["rapid-price-lift-insufficient-evidence.csv"],
} as const;
