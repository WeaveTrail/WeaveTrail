/**
 * The argument for the gate, kept as data so the page and its tests read the
 * same statements. Every sentence about a system outside this repository
 * carries either a published source or a mark saying it is the project's own
 * reading. Sentences about WeaveTrail itself describe implemented behaviour,
 * and anything not implemented is labelled planned where it is named.
 */

export type SourceId = "iosco-2013" | "iosco-2025" | "fsc-ai-guideline";

export interface Source {
  readonly id: SourceId;
  readonly marker: string;
  readonly publisher: string;
  readonly title: string;
  readonly published: string;
  readonly href: string;
}

export type Statement =
  | { readonly text: string; readonly source: SourceId }
  | { readonly text: string; readonly reasoning: true };

export const OWN_REASONING_MARK = "WeaveTrail's own reading";

export const sources: readonly Source[] = [
  {
    id: "iosco-2013",
    marker: "1",
    publisher: "IOSCO",
    title:
      "Technological Challenges to Effective Market Surveillance: Issues and Regulatory Tools",
    published: "2013",
    href: "https://www.iosco.org/library/pubdocs/pdf/ioscopd412.pdf",
  },
  {
    id: "iosco-2025",
    marker: "2",
    publisher: "IOSCO",
    title:
      "Thematic Review on Technological Challenges to Effective Market Surveillance",
    published: "19 February 2025",
    href: "https://www.iosco.org/library/pubdocs/pdf/IOSCOPD786.pdf",
  },
  {
    id: "fsc-ai-guideline",
    marker: "3",
    publisher: "Financial Services Commission, Korea",
    title: "Financial AI guideline",
    published: "June 2026",
    href: "https://www.fsc.go.kr/no010101/87142",
  },
];

/** Section one: what the layer above the gate already does. */
export const upstreamStatements: readonly Statement[] = [
  {
    text: "IOSCO's 2013 report on technological challenges to market surveillance treats surveillance tools such as the audit trail system as one of the more significant problems facing markets as execution speed and order volume rise.",
    source: "iosco-2013",
  },
  {
    text: "The same report records that order information from away markets may not reach a regulator electronically within a reasonable time.",
    source: "iosco-2013",
  },
  {
    text: "IOSCO's 2025 thematic review of those recommendations reports that most market authorities have implemented them and made significant progress, while some regulators still lack the organisational and technical capabilities to surveil their markets effectively.",
    source: "iosco-2025",
  },
  {
    text: "That review also records difficulties collecting and comparing data across multiple trading venues, and that most market authorities have not mapped their cross-border surveillance capabilities.",
    source: "iosco-2025",
  },
  {
    text: "Detection, then, is a layer that already exists, is already supervised, and already produces candidates. WeaveTrail assumes that layer and replaces no part of it.",
    reasoning: true,
  },
];

/** Section two: the decision that layer still hands to a person. */
export const handoverStatements: readonly Statement[] = [
  {
    text: "Korea's financial AI guideline holds that AI at this stage is a support tool: the final decision, and the responsibility for it, stay with the person making it.",
    source: "fsc-ai-guideline",
  },
  {
    text: "An alert names a candidate. It does not record which executions produced its number, under which field mapping, or under which rule version.",
    reasoning: true,
  },
  {
    text: "So whoever picks the alert up has to reconstruct that before a candidate becomes a finding, and a second person has to be able to reach the same conclusion from the same executions.",
    reasoning: true,
  },
  {
    text: "That reconstruction is the work between a detection system and a decision. It is the only work WeaveTrail does.",
    reasoning: true,
  },
];

/** Section three: the three declared inputs the gate asks an upstream for. */
export const gateInputs: readonly (readonly [string, string])[] = [
  [
    "Source executions",
    "The rows the alert's number rests on, submitted as committed artifacts and compared against the stored rows before anything is computed.",
  ],
  [
    "An approved review scope",
    "A field mapping a person approved, bound to that exact proposal's artifact hash. An unapproved or altered proposal never reaches the deterministic core.",
  ],
  [
    "A hypothesis and its thresholds",
    "A versioned pattern with its gates, its thresholds and its abstention reasons declared before the run, so the result carries the conditions it is true under.",
  ],
];

export const CONCLUSION_NOT_METHOD =
  "The gate inspects an upstream's conclusion, not an upstream's method. It never reads a detection model, its parameters or its scoring, and it never searches for candidates.";

export interface LayerAuthority {
  readonly name: string;
  readonly may: string;
  readonly mayNot: string;
  readonly status?: string;
}

/** Section four: one authority per layer, and the edge of each. */
export const layerAuthorities: readonly LayerAuthority[] = [
  {
    name: "L1 · Interpret",
    may: "Propose one target field and one allowlisted transform per source column, each with a confidence and the evidence behind it.",
    mayNot:
      "Edit a source row, compute a metric, or decide a result. Its output is untrusted until a contract and a person clear it.",
    status:
      "A deterministic fixture provider today. Live model adapters and a bounded case proposer are planned.",
  },
  {
    name: "L2 · Approve",
    may: "Approve that exact proposal, bound to its artifact hash, and clear a flagged field with a justified override.",
    mayNot:
      "Edit a computed result, or widen the scope the approval fixed. Approval sets what runs, never what the run returns.",
  },
  {
    name: "L3 · Decide",
    may: "Order, deduplicate, compare exact decimals and evaluate the versioned rule across its declared gates.",
    mayNot:
      "Read anything outside the approved scope, or return a result when a required gate cannot be satisfied. It returns a review state instead.",
  },
  {
    name: "L4 · Evidence",
    may: "Resolve every finding to its canonical event identifiers, raw row hashes, artifact coordinates and unchanged source values.",
    mayNot:
      "Display a finding whose lineage cannot be resolved; that is refused. An INCONCLUSIVE result carries no finding evidence.",
    status:
      "Independent Evidence Bundle assembly and verification are planned.",
  },
];

export const NON_AFFILIATION =
  "WeaveTrail is not affiliated with, endorsed by, integrated with, or connected to any system, venue, vendor or authority named on this page.";

/** Section five: the boundary of the argument above. */
export const notClaimed: readonly string[] = [
  NON_AFFILIATION,
  "No system named here uses WeaveTrail, and WeaveTrail has not been evaluated against one. Naming a published source describes where the gate would sit, not a relationship with anyone.",
  "A result is support for a versioned technical pattern. It is not a finding of guilt, a legal conclusion, a causal claim, investment advice, an automated trading decision, or real-time surveillance.",
  "The repository runs deterministic fixtures over committed synthetic cases and licensed published quotations. It is not a production market-surveillance system, and its rule thresholds are illustrative per-case configuration rather than calibrated market thresholds.",
  "Sentences on this page about systems outside this repository carry a source. Sentences that are the project's reading of those sources are marked as such, and are not published findings.",
];
