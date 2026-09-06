/**
 * The argument for the gate, kept as data so the page and its tests read the
 * same statements. Every sentence about a system outside this repository
 * carries either a published source or a mark saying it is the project's own
 * reading. Sentences about WeaveTrail itself describe implemented behaviour,
 * and anything not implemented is labelled planned where it is named.
 */

export type SourceId = "fsc-ai-guideline" | "fss-ai-rmf";

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
    id: "fsc-ai-guideline",
    marker: "1",
    publisher: "Financial Services Commission (\uae08\uc735\uc704\uc6d0\ud68c)",
    title:
      "Financial sector AI guideline (\uae08\uc735\ubd84\uc57c \uc778\uacf5\uc9c0\ub2a5 \uac00\uc774\ub4dc\ub77c\uc778)",
    published: "announced 18 June 2026, in force 22 June 2026",
    href: "https://www.fsc.go.kr/no010101/87142",
  },
  {
    id: "fss-ai-rmf",
    marker: "2",
    publisher: "Financial Supervisory Service (\uae08\uc735\uac10\ub3c5\uc6d0)",
    title:
      "Financial sector AI risk management framework (\uae08\uc735\ubd84\uc57c AI \uc704\ud5d8\uad00\ub9ac \ud504\ub808\uc784\uc6cc\ud06c), announced with the guideline in the release above",
    published: "June 2026",
    href: "https://www.fsc.go.kr/no010101/87142",
  },
];

/** The page lede. An outside claim, so it carries a source like the rest. */
export const lede: Statement = {
  text: "Korea's financial sector AI guideline has been in force since 22 June 2026, and it reaches financial investment firms and any company whose AI output affects the provision of a financial service.",
  source: "fsc-ai-guideline",
};

/** The diagram is the project's own sketch, not a figure from a published source. */
export const diagramAttribution: Statement = {
  text: "The upper band is the project's own sketch of the layer it assumes, not a figure taken from a published source; the two bands beneath it describe this repository.",
  reasoning: true,
};

/** Section one: what the layer above the gate already does. */
export const upstreamStatements: readonly Statement[] = [
  {
    text: "The release announcing the guideline describes AI in finance being put to work catching signs of financial crime, naming voice phishing among them.",
    source: "fsc-ai-guideline",
  },
  {
    text: "The guideline applies across banks, insurers, card and capital companies and financial investment firms, and reaches non-financial companies too wherever an AI system's output affects a financial service directly or indirectly.",
    source: "fsc-ai-guideline",
  },
  {
    text: "So the layer above the gate, the systems that watch trading and raise a candidate, is both increasingly AI-assisted and inside that scope. WeaveTrail assumes that layer and replaces no part of it.",
    reasoning: true,
  },
  {
    text: "This page makes no measurement of any detection system, and states nothing about how one scores, ranks or escalates.",
    reasoning: true,
  },
];

/** Section two: the decision that layer still hands to a person. */
export const handoverStatements: readonly Statement[] = [
  {
    text: "The guideline sets seven principles for using AI in finance: governance, legality, the auxiliary role of AI, reliability, financial stability, good faith and security.",
    source: "fsc-ai-guideline",
  },
  {
    text: "Under the auxiliary-role principle, AI at this stage is a support tool: the final decision and the responsibility that follows it are carried out by the firm's own officers and employees, and human intervention is a stated principle.",
    source: "fsc-ai-guideline",
  },
  {
    text: "The supervisory AI risk management framework issued alongside the guideline develops its governance principle into governance, risk assessment and risk control across an AI system's life cycle.",
    source: "fss-ai-rmf",
  },
  {
    text: "An alert names a candidate. It does not record which executions produced its number, under which field mapping, or under which rule version.",
    reasoning: true,
  },
  {
    text: "So the person who carries that decision has to reconstruct it first, and a second person has to be able to reach the same conclusion from the same executions. That reconstruction is the only work WeaveTrail does.",
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
    "A versioned pattern with its gates, its thresholds and its abstention reasons declared before the run. The canonical result hash covers the engine version, the canonical events and the evaluation; the approved manifest and its approval records sit beside the result rather than inside that hash.",
  ],
];

export const CONCLUSION_NOT_METHOD =
  "The gate is positioned to inspect an upstream's conclusion, not an upstream's method: it reads no detection model, no parameters and no scoring, and it does not search for candidates.";

export const NO_UPSTREAM_INTEGRATION =
  "No upstream integration is implemented. A replay request carries a committed scenario, its rows, the approvals and an optional authored manifest, and has no alert, referral or score field, so an alert reaches the gate today only as the executions and the scope a person submits.";

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
    may: "Order, deduplicate, compare exact decimals and evaluate the versioned rule across its declared gates. A gate that does not pass reports NOT_SUPPORTED, and declared inputs that are insufficient report INCONCLUSIVE; both are results.",
    mayNot:
      "Read anything outside the approved scope, or widen the scope it was given. It cannot return a review state as an outcome: a review state is a pre-replay validation or approval failure, never an engine verdict.",
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
  "Layer separation is one way to carry out inside a single investigation what the guideline asks. It is a design alignment, not a certification, an approval, or an endorsement, and no authority named here has reviewed, assessed or approved this project.",
  "No system named here uses WeaveTrail, and WeaveTrail has not been evaluated against one. Naming a published source describes where the gate would sit, not a relationship with anyone.",
  "A result is support for a versioned technical pattern. It is not a finding of guilt, a legal conclusion, a causal claim, investment advice, an automated trading decision, or real-time surveillance.",
  "The repository runs deterministic fixtures over committed synthetic cases and licensed published quotations. It is not a production market-surveillance system, and its rule thresholds are illustrative per-case configuration rather than calibrated market thresholds.",
  "Every statement here about anything outside this repository carries a source or the mark that says it is the project's own reading. A marked statement is a premise this project works from, not a published finding.",
];
