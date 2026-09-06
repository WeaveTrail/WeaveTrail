/**
 * The argument for the gate, kept as data so the page and its tests read the
 * same statements. Every sentence about a system outside this repository
 * carries either a published source or a mark saying it is the project's own
 * reading. Sentences about WeaveTrail itself describe implemented behaviour,
 * and anything not implemented is labelled planned where it is named.
 */

export type SourceId =
  | "fss-surveillance-automation"
  | "fss-realtime-surveillance"
  | "fsc-ai-guideline"
  | "fss-ai-rmf";

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

const FSS = "Financial Supervisory Service (금융감독원)";

export const sources: readonly Source[] = [
  {
    id: "fss-surveillance-automation",
    marker: "1",
    publisher: FSS,
    title:
      "Automating the market surveillance process for virtual asset unfair trading with AI (AI기반 가상자산 불공정거래 시장감시 프로세스 자동화)",
    published: "20 August 2026",
    href: "https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=223852&menuNo=200218",
  },
  {
    id: "fss-realtime-surveillance",
    marker: "2",
    publisher: FSS,
    title:
      "Targeting virtual asset unfair trading with real-time surveillance and AI-based analysis (실시간 감시와 AI 기반 분석으로 가상자산 불공정거래 정조준)",
    published: "3 May 2026",
    href: "https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=217521&menuNo=200218",
  },
  {
    id: "fsc-ai-guideline",
    marker: "3",
    publisher: "Financial Services Commission (금융위원회)",
    title: "Financial sector AI guideline (금융분야 인공지능 가이드라인)",
    published: "announced 18 June 2026, in force 22 June 2026",
    href: "https://www.fsc.go.kr/no010101/87142",
  },
  {
    id: "fss-ai-rmf",
    marker: "4",
    publisher: FSS,
    title:
      "Financial sector AI risk management framework (금융분야 AI 위험관리 프레임워크), announced with the guideline in the release above",
    published: "June 2026",
    href: "https://www.fsc.go.kr/no010101/87142",
  },
];

/** The page lede. The fact the whole argument starts from. */
export const lede: Statement = {
  text: "In August 2026 the Financial Supervisory Service described an AI process that carries virtual asset market surveillance from detecting abnormal trading, through identifying the suspected interval, to drafting the review report, in one automated pass.",
  source: "fss-surveillance-automation",
};

/** What the product is, stated before anything is drawn. */
export const POSITION =
  "WeaveTrail does not detect. It adds one verification gate between what a process like that concludes and what a person signs.";

/** The diagram is the project's own design, not a figure from a published source. */
export const diagramAttribution: Statement = {
  text: "The diagram is the project's own design for that gate, not a figure taken from a published source; only the upper band describes something that exists outside this repository.",
  reasoning: true,
};

/** Section one: what the layer above the gate already does. */
export const upstreamStatements: readonly Statement[] = [
  {
    text: "That process combines generative AI with machine learning: it detects manipulation and wash-trading patterns in real time across large transaction sets, scans public online material for front-running and posts inciting misconduct, and runs from a suspected anomaly through to a drafted report as one pass.",
    source: "fss-surveillance-automation",
  },
  {
    text: "It rests on real-time monitoring that collects and analyses domestic and overseas exchange data through public APIs, and on analysis that identifies suspected groups and narrows their suspected intervals to the second.",
    source: "fss-realtime-surveillance",
  },
  {
    text: "The financial sector AI guideline reaches financial investment firms, and reaches any company whose AI output affects the provision of a financial service directly or indirectly.",
    source: "fsc-ai-guideline",
  },
  {
    text: "So detection is already fast, already analytical, and already inside a supervised scope. WeaveTrail assumes that layer and replaces no part of it.",
    reasoning: true,
  },
];

/** Section two: the decision that layer still hands to a person. */
export const handoverStatements: readonly Statement[] = [
  {
    text: "In the same year, the financial authorities set the auxiliary-role principle among the guideline's seven principles: AI is a support tool, the final decision and the responsibility that follows it are carried out by the firm's own officers and employees, and human intervention is a stated principle.",
    source: "fsc-ai-guideline",
  },
  {
    text: "The supervisory AI risk management framework issued alongside the guideline develops its governance principle into governance, risk assessment and risk control across an AI system's life cycle.",
    source: "fss-ai-rmf",
  },
  {
    text: "The further AI reaches into an investigation, the firmer the grounds the person who signs the judgement needs. A drafted report is a conclusion; what that person answers for is the reasoning under it.",
    reasoning: true,
  },
  {
    text: "An automated pass names a candidate and a suspected interval. It does not, by itself, leave the executions, the field mapping and the rule version a second person would need to reach the same conclusion.",
    reasoning: true,
  },
];

/** Section three: what this project adds to the layer above it. */
export const additionStatements: readonly Statement[] = [
  {
    text: "So the speed and the analytical reach of the existing surveillance are kept, and one gate is added before its result becomes an investigative judgement: a person confirms the scope the AI proposed, and versioned code re-verifies against that fixed scope.",
    reasoning: true,
  },
  {
    text: "The approved scope, the verification result and the executions it rests on are recorded together, so a different reviewer, or the same one later, can check the same grounds again rather than take the earlier conclusion on trust.",
    reasoning: true,
  },
  {
    text: "Nothing here proposes a faster detector or a better one. The gap this addresses is not finding the candidate; it is what a successor can re-derive from the candidate that was found.",
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
  "The surveillance process cited here covers virtual assets. This repository's committed sources are synthetic equity executions and published KOSPI daily quotations, so what is described is the shape of a position, not a connection to that process or coverage of that market.",
  "A result is support for a versioned technical pattern. It is not a finding of guilt, a legal conclusion, a causal claim, investment advice, an automated trading decision, or real-time surveillance.",
  "The repository runs deterministic fixtures over committed synthetic cases and licensed published quotations. It is not a production market-surveillance system, and its rule thresholds are illustrative per-case configuration rather than calibrated market thresholds.",
  "Every statement here about anything outside this repository carries a source or the mark that says it is the project's own reading. A marked statement is a premise this project works from, not a published finding.",
];
