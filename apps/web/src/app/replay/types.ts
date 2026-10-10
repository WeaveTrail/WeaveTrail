import type {
  CaseManifestProposal,
  ReplayRequest,
  ReplayScenario,
  SchemaMappingProposal,
  SourceProvenance,
} from "@weavetrail/contracts";

import type { Language } from "../i18n/language";
import type { MappingReviewResponse } from "./mapping-review-messages";

export type Mutation = "baseline" | "shuffle" | "duplicate";

/** Every source the surface offers is synthetic (ADR 0056). */
export type SyntheticProvenance = Extract<
  SourceProvenance,
  { kind: "synthetic" }
>;

export type ReplayScenarioOption = {
  value: ReplayScenario;
  label: string;
  purpose: "REVIEWER_FACING" | "ENGINE_REGRESSION";
  sourceArtifactHash: string;
  rows: ReplayRequest["rows"];
  availableMutations: readonly Mutation[];
  manifest?: CaseManifestProposal;
  provenance?: SyntheticProvenance;
  mappingRequestRequired?: boolean;
};

export type CaseReplayProps = {
  providerMode: "fixture";
  proposals: Record<string, SchemaMappingProposal>;
  scenarios: ReplayScenarioOption[];
  guided?: boolean;
  mappingExample?: boolean;
  onMappingApprovalChange?: (approved: boolean) => void;
  onGuideComplete?: () => void;
  /** English unless a language-aware caller supplies otherwise. */
  language?: Language;
};

/**
 * Why the surface stopped. The copy for each kind is chosen when it is shown,
 * so switching language also changes a refusal already on screen. A server's
 * own refusal message is shown as returned.
 */
export type ReplayError =
  | { readonly kind: "approval-hash" }
  | { readonly kind: "mapping-unavailable" }
  | { readonly kind: "mapping-review"; readonly review: MappingReviewResponse }
  | { readonly kind: "refused"; readonly message: string }
  | { readonly kind: "failed" };
