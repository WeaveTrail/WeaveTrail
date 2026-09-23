/**
 * The argument for the gate, kept as data so the page and its tests read the
 * same statements. Every sentence about a system outside this repository
 * carries either a published source or a mark saying it is the project's own
 * reading. Sentences about WeaveTrail itself describe implemented behaviour,
 * and anything not implemented is labelled planned where it is named.
 *
 * Every string here is explanatory prose, so the two languages say the same
 * things with the same scope and the same hedging. Korean is drafted from the
 * meaning rather than from the English sentence, but it may not narrow, widen
 * or firm up a claim the English makes, and neither may the English.
 */

import type { Language } from "../i18n/language";

/** One string per language. English is what a caller without a provider sees. */
export type Localized = Readonly<Record<Language, string>>;

export type SourceId =
  | "fss-surveillance-automation"
  | "fss-realtime-surveillance"
  | "fsc-ai-guideline"
  | "fss-ai-rmf";

export interface Source {
  readonly id: SourceId;
  readonly marker: string;
  readonly publisher: Localized;
  readonly title: Localized;
  readonly published: Localized;
  readonly href: string;
}

export type Statement =
  | { readonly text: Localized; readonly source: SourceId }
  | { readonly text: Localized; readonly reasoning: true };

export const OWN_REASONING_MARK: Localized = {
  en: "WeaveTrail's own reading",
  ko: "WeaveTrail의 해석",
};

const FSS: Localized = {
  en: "Financial Supervisory Service (금융감독원)",
  ko: "금융감독원",
};

export const sources: readonly Source[] = [
  {
    id: "fss-surveillance-automation",
    marker: "1",
    publisher: FSS,
    title: {
      en: "Automating the market surveillance process for virtual asset unfair trading with AI (AI기반 가상자산 불공정거래 시장감시 프로세스 자동화)",
      ko: "AI기반 가상자산 불공정거래 시장감시 프로세스 자동화",
    },
    published: { en: "20 August 2026", ko: "2026년 8월 20일" },
    href: "https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=223852&menuNo=200218",
  },
  {
    id: "fss-realtime-surveillance",
    marker: "2",
    publisher: FSS,
    title: {
      en: "Targeting virtual asset unfair trading with real-time surveillance and AI-based analysis (실시간 감시와 AI 기반 분석으로 가상자산 불공정거래 정조준)",
      ko: "실시간 감시와 AI 기반 분석으로 가상자산 불공정거래 정조준",
    },
    published: { en: "3 May 2026", ko: "2026년 5월 3일" },
    href: "https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=217521&menuNo=200218",
  },
  {
    id: "fsc-ai-guideline",
    marker: "3",
    publisher: {
      en: "Financial Services Commission (금융위원회)",
      ko: "금융위원회",
    },
    title: {
      en: "Financial sector AI guideline (금융분야 인공지능 가이드라인)",
      ko: "금융분야 인공지능 가이드라인",
    },
    published: {
      en: "announced 18 June 2026, in force 22 June 2026",
      ko: "2026년 6월 18일 발표, 2026년 6월 22일 시행",
    },
    href: "https://www.fsc.go.kr/no010101/87142",
  },
  {
    id: "fss-ai-rmf",
    marker: "4",
    publisher: FSS,
    title: {
      en: "Financial sector AI risk management framework (금융분야 AI 위험관리 프레임워크), announced with the guideline in the release above",
      ko: "금융분야 AI 위험관리 프레임워크. 위 보도자료에서 가이드라인과 함께 발표됐습니다",
    },
    published: { en: "June 2026", ko: "2026년 6월" },
    href: "https://www.fsc.go.kr/no010101/87142",
  },
];

/** The page lede. The fact the whole argument starts from. */
export const lede: Statement = {
  text: {
    en: "In August 2026 the Financial Supervisory Service described an AI process that carries virtual asset market surveillance from detecting abnormal trading, through identifying the suspected interval, to drafting the review report, in one automated pass.",
    ko: "2026년 8월, 금융감독원이 가상자산 시장감시에 쓸 AI 프로세스를 설명했습니다. 이상거래를 탐지하고, 혐의 구간을 특정하고, 심리 보고서 초안을 쓰는 데까지 한 번에 자동으로 잇는 과정입니다.",
  },
  source: "fss-surveillance-automation",
};

/** What the product is, stated before anything is drawn. */
export const POSITION: Localized = {
  en: "It does not detect. A verification gate sits between that process's conclusion and a person's sign-off.",
  ko: "탐지는 하지 않습니다. 프로세스의 결론과 사람이 서명할 판단 사이에서 한 번 더 검증합니다.",
};

/** The diagram is the project's own design, not a figure from a published source. */
export const diagramAttribution: Statement = {
  text: {
    en: "The diagram is the project's own design for that gate, not a figure taken from a published source; only the upper band describes something that exists outside this repository.",
    ko: "이 다이어그램은 그 게이트를 이 프로젝트가 직접 그린 것이지, 공표된 자료에서 가져온 그림이 아닙니다. 이 저장소 밖에 실재하는 것을 그린 부분은 맨 위 띠뿐입니다.",
  },
  reasoning: true,
};

/** Section one: what the layer above the gate already does. */
export const upstreamStatements: readonly Statement[] = [
  {
    text: {
      en: "That process combines generative AI with machine learning: it detects manipulation and wash-trading patterns in real time across large transaction sets, scans public online material for front-running and posts inciting misconduct, and runs from a suspected anomaly through to a drafted report as one pass.",
      ko: "그 프로세스는 생성형 AI와 머신러닝을 함께 씁니다. 대량의 거래에서 시세조종과 가장매매 패턴을 실시간으로 탐지하고, 온라인에 공개된 글에서 선행매매와 불공정거래를 부추기는 게시물을 훑고, 이상 징후부터 보고서 초안까지 한 번에 처리합니다.",
    },
    source: "fss-surveillance-automation",
  },
  {
    text: {
      en: "It rests on real-time monitoring that collects and analyses domestic and overseas exchange data through public APIs, and on analysis that identifies suspected groups and narrows their suspected intervals to the second.",
      ko: "그 바탕에는 두 가지가 있습니다. 공개 API로 국내외 거래소 데이터를 모아 분석하는 실시간 모니터링, 그리고 혐의 그룹을 추려 혐의 구간을 초 단위까지 좁히는 분석입니다.",
    },
    source: "fss-realtime-surveillance",
  },
  {
    text: {
      en: "The financial sector AI guideline reaches financial investment firms, and reaches any company whose AI output affects the provision of a financial service directly or indirectly.",
      ko: "금융분야 AI 가이드라인은 금융투자업자에게 적용됩니다. AI 산출물이 금융서비스 제공에 직접이든 간접이든 영향을 주는 회사라면 어디에나 적용됩니다.",
    },
    source: "fsc-ai-guideline",
  },
  {
    text: {
      en: "Detection is already fast, analytical and supervised. This gate replaces none of it.",
      ko: "탐지는 이미 빠르고 분석적이며 감독 범위 안에 있습니다. 이 단계는 그 기능을 대체하지 않습니다.",
    },
    reasoning: true,
  },
];

/** Section two: the decision that layer still hands to a person. */
export const handoverStatements: readonly Statement[] = [
  {
    text: {
      en: "In the same year, the financial authorities set the auxiliary-role principle among the guideline's seven principles: AI is a support tool, the final decision and the responsibility that follows it are carried out by the firm's own officers and employees, and human intervention is a stated principle.",
      ko: "같은 해, 금융당국은 가이드라인의 일곱 원칙 가운데 보조적 역할 원칙을 두었습니다. AI는 보조 도구이고, 최종 판단과 그에 따르는 책임은 회사의 임직원이 지며, 사람의 개입은 원칙으로 명시돼 있습니다.",
    },
    source: "fsc-ai-guideline",
  },
  {
    text: {
      en: "The supervisory AI risk management framework issued alongside the guideline develops its governance principle into governance, risk assessment and risk control across an AI system's life cycle.",
      ko: "가이드라인과 함께 나온 금융분야 AI 위험관리 프레임워크는 그 거버넌스 원칙을 AI 시스템의 생애주기 전반에 걸친 거버넌스와 위험 평가, 위험 통제로 풀어냅니다.",
    },
    source: "fss-ai-rmf",
  },
  {
    text: {
      en: "The further AI reaches into an investigation, the firmer the grounds the person who signs the judgement needs. A drafted report is a conclusion; what that person answers for is the reasoning under it.",
      ko: "AI가 조사 안쪽으로 들어올수록, 판단에 서명하는 사람에게는 더 단단한 근거가 필요합니다. 보고서 초안은 결론입니다. 그 사람이 책임지는 것은 결론 아래의 근거입니다.",
    },
    reasoning: true,
  },
  {
    text: {
      en: "An automated pass names a candidate and a suspected interval. It does not, by itself, leave the executions, the field mapping and the rule version a second person would need to reach the same conclusion.",
      ko: "자동으로 한 번 돌린 결과는 후보와 혐의 구간을 짚어줍니다. 그것만으로는 체결 내역도, 필드 매핑도, 규칙 버전도 남지 않습니다. 다른 사람이 같은 결론에 이르려면 그 셋이 필요합니다.",
    },
    reasoning: true,
  },
];

/** Section three: what this project adds to the layer above it. */
export const additionStatements: readonly Statement[] = [
  {
    text: {
      en: "So the speed and the analytical reach of the existing surveillance are kept, and one gate is added before its result becomes an investigative judgement: a person confirms the scope the AI proposed, and versioned code re-verifies against that fixed scope.",
      ko: "그래서 기존 감시의 속도와 분석력은 그대로 두고, 그 결과가 조사 판단이 되기 전에 단계 하나를 넣습니다. 사람이 AI가 제안한 범위를 확인하고, 버전이 고정된 코드가 그 범위 그대로 다시 검증합니다.",
    },
    reasoning: true,
  },
  {
    text: {
      en: "The approved scope, the verification result and the executions it rests on are recorded together, so a different reviewer, or the same one later, can check the same grounds again rather than take the earlier conclusion on trust.",
      ko: "승인된 범위와 검증 결과, 그 근거가 된 체결 내역을 함께 기록합니다. 그래서 앞선 결론을 그냥 믿고 넘어가지 않아도 됩니다. 다른 검토자든, 시간이 지난 뒤의 같은 사람이든, 같은 근거를 다시 확인할 수 있습니다.",
    },
    reasoning: true,
  },
  {
    text: {
      en: "Nothing here proposes a faster detector or a better one. The gap this addresses is not finding the candidate; it is what a successor can re-derive from the candidate that was found.",
      ko: "여기서 더 빠른 탐지기나 더 나은 탐지기를 제안하는 것은 아닙니다. 이 프로젝트가 다루는 빈틈은 다른 데 있습니다. 후보를 찾는 일이 아니라, 찾아낸 후보에서 다음 사람이 무엇을 다시 도출할 수 있느냐입니다.",
    },
    reasoning: true,
  },
];

/** Section three: the three declared inputs the gate asks an upstream for. */
export const gateInputs: readonly (readonly [Localized, Localized])[] = [
  [
    { en: "Source executions", ko: "원본 체결 내역" },
    {
      en: "The rows the alert's number rests on, submitted as committed artifacts and compared against the stored rows before anything is computed.",
      ko: "알림의 숫자가 딛고 선 행입니다. 커밋된 아티팩트로 제출하고, 계산을 시작하기 전에 저장된 행과 대조합니다.",
    },
  ],
  [
    { en: "An approved review scope", ko: "승인된 검토 범위" },
    {
      en: "A field mapping a person approved, bound to that exact proposal's artifact hash. An unapproved or altered proposal never reaches the deterministic core.",
      ko: "사람이 승인한 필드 매핑입니다. 그 제안의 아티팩트 해시에 정확히 묶입니다. 승인되지 않았거나 손댄 제안은 결정론적 core에 닿지 못합니다.",
    },
  ],
  [
    { en: "A hypothesis and its thresholds", ko: "가설과 임계값" },
    {
      en: "A versioned pattern with its gates, its thresholds and its abstention reasons declared before the run. The canonical result hash covers the engine version, the canonical events and the evaluation; the approved manifest and its approval records sit beside the result rather than inside that hash.",
      ko: "버전이 붙은 패턴입니다. gate와 임계값, 판단 보류 사유를 실행 전에 선언합니다. 정본 결과 해시는 엔진 버전과 정본 이벤트, 평가를 덮습니다. 승인된 manifest와 그 승인 기록은 이 해시 안이 아니라 결과 옆에 놓입니다.",
    },
  ],
];

export const CONCLUSION_NOT_METHOD: Localized = {
  en: "The gate is positioned to inspect an upstream's conclusion, not an upstream's method: it reads no detection model, no parameters and no scoring, and it does not search for candidates.",
  ko: "이 단계는 상류의 결론을 살피는 자리이지, 상류의 방법을 살피는 자리가 아닙니다. 탐지 모델도, 파라미터도, 스코어링도 읽지 않고, 후보를 직접 찾지도 않습니다.",
};

export const NO_UPSTREAM_INTEGRATION: Localized = {
  en: "No upstream integration is implemented. A replay request carries a committed scenario, its rows, the approvals and an optional authored manifest, and has no alert, referral or score field, so an alert reaches the gate today only as the executions and the scope a person submits.",
  ko: "상류 연동은 구현돼 있지 않습니다. 리플레이 요청에는 커밋된 시나리오와 그 행, 승인, 그리고 선택적으로 직접 작성한 manifest가 담기고, 알림이나 통보, 스코어 필드는 없습니다. 그래서 지금 알림은 사람이 제출하는 체결 내역과 범위의 형태로만 이 단계에 도착합니다.",
};

export interface LayerAuthority {
  readonly name: Localized;
  readonly may: Localized;
  readonly mayNot: Localized;
  readonly status?: Localized;
}

/** Section four: one authority per layer, and the edge of each. */
export const layerAuthorities: readonly LayerAuthority[] = [
  {
    name: { en: "L1 · Interpret", ko: "L1 · 해석" },
    may: {
      en: "Propose one target field and one allowlisted transform per source column, each with a confidence and the evidence behind it.",
      ko: "소스 열마다 대상 필드 하나와 허용된 변환 하나를 제안합니다. 각각에 확신도와 근거가 붙습니다.",
    },
    mayNot: {
      en: "Edit a source row, compute a metric, or decide a result. Its output is untrusted until a contract and a person clear it.",
      ko: "소스 행을 고치거나, 지표를 계산하거나, 결과를 정하지 못합니다. 계약과 사람이 통과시키기 전까지 그 출력은 신뢰하지 않습니다.",
    },
    status: {
      en: "A deterministic fixture is the default. Explicitly configured mapping for two synthetic dialects has mocked transport checks; a bounded case proposer is planned.",
      ko: "기본값은 결정론적 fixture입니다. 합성 방언 두 개에 대해서는 설정을 명시한 매핑이 있고, 전송 검사는 아직 모킹입니다. 한정된 사례 제안기는 계획입니다.",
    },
  },
  {
    name: { en: "L2 · Approve", ko: "L2 · 승인" },
    may: {
      en: "Approve that exact proposal, bound to its artifact hash, and clear a flagged field with a justified override.",
      ko: "그 제안을 아티팩트 해시에 묶어 그대로 승인하고, 표시된 필드는 사유를 적은 override로 통과시킵니다.",
    },
    mayNot: {
      en: "Edit a computed result, or widen the scope the approval fixed. Approval sets what runs, never what the run returns.",
      ko: "계산된 결과를 고치거나, 승인이 고정한 범위를 넓히지 못합니다. 승인이 정하는 것은 무엇을 실행할지이지, 실행이 무엇을 돌려줄지가 아닙니다.",
    },
  },
  {
    name: { en: "L3 · Decide", ko: "L3 · 판정" },
    may: {
      en: "Order, deduplicate, compare exact decimals and evaluate the versioned rule across its declared gates. A gate that does not pass reports NOT_SUPPORTED, and declared inputs that are insufficient report INCONCLUSIVE; both are results.",
      ko: "정렬하고, 중복을 거르고, 소수를 정확히 비교하고, 선언된 gate에 걸쳐 버전이 붙은 규칙을 평가합니다. 통과하지 못한 gate는 NOT_SUPPORTED를 내고, 선언된 입력이 부족하면 INCONCLUSIVE를 냅니다. 둘 다 결과입니다.",
    },
    mayNot: {
      en: "Read anything outside the approved scope, or widen the scope it was given. It cannot return a review state as an outcome: a review state is a pre-replay validation or approval failure, never an engine verdict.",
      ko: "승인된 범위 밖을 읽거나, 받은 범위를 넓히지 못합니다. 검토 상태를 결과로 돌려줄 수도 없습니다. 검토 상태는 리플레이 이전의 검증 실패나 승인 실패이지, 엔진의 판정이 아닙니다.",
    },
  },
  {
    name: { en: "L4 · Evidence", ko: "L4 · 증거" },
    may: {
      en: "Resolve every finding to its canonical event identifiers, raw row hashes, artifact coordinates and unchanged source values.",
      ko: "모든 발견을 정본 이벤트 식별자와 원본 행 해시, 아티팩트 좌표, 손대지 않은 원본 값까지 되짚습니다.",
    },
    mayNot: {
      en: "Display a finding whose lineage cannot be resolved; that is refused. An INCONCLUSIVE result carries no finding evidence.",
      ko: "계보를 되짚지 못하는 발견은 보여주지 않고 거부합니다. INCONCLUSIVE 결과에는 발견 증거가 없습니다.",
    },
    status: {
      en: "Byte-backed Evidence Bundle assembly and independent verification are implemented; browser export is planned.",
      ko: "원본 바이트 기반 증거 번들 조립과 독립 검증은 구현되어 있고, 브라우저 내보내기는 계획입니다.",
    },
  },
];

export const NON_AFFILIATION: Localized = {
  en: "No affiliation, endorsement, integration or connection exists with any system, venue, vendor or authority named on this page.",
  ko: "이 페이지에 이름이 나오는 시스템·거래소·업체·기관과 제휴, 보증, 연동, 연결 관계가 없습니다.",
};

/** Section five: the boundary of the argument above. */
export const notClaimed: readonly Localized[] = [
  NON_AFFILIATION,
  {
    en: "Layer separation is one way to carry out inside a single investigation what the guideline asks. It is a design alignment, not a certification, an approval, or an endorsement, and no authority named here has reviewed, assessed or approved this project.",
    ko: "가이드라인이 요구하는 것을 조사 하나 안에서 실행하는 방법은 여럿입니다. 계층 분리는 그중 하나입니다. 설계상의 정합일 뿐 인증도, 승인도, 보증도 아닙니다. 여기 이름이 나오는 어떤 기관도 이 프로젝트를 검토하거나 평가하거나 승인한 적이 없습니다.",
  },
  {
    en: "No system named here uses this project or has evaluated it. Naming a published source describes where the gate would sit, not a relationship.",
    ko: "여기 이름이 나오는 시스템이 이 프로젝트를 쓰거나 이를 기준으로 평가한 적은 없습니다. 공표 자료는 이 단계가 놓일 자리를 설명할 뿐, 관계를 뜻하지 않습니다.",
  },
  {
    en: "The surveillance process cited here covers virtual assets. This repository's committed sources are synthetic equity executions and published KOSPI daily quotations, so what is described is the shape of a position, not a connection to that process or coverage of that market.",
    ko: "여기 인용한 감시 프로세스는 가상자산을 다룹니다. 이 저장소가 커밋한 소스는 합성 주식 체결 내역과 공표된 KOSPI 일별 시세입니다. 그래서 여기 적은 것은 자리의 모양이지, 그 프로세스와의 연결이나 그 시장에 대한 커버리지가 아닙니다.",
  },
  {
    en: "A result is support for a versioned technical pattern. It is not a finding of guilt, a legal conclusion, a causal claim, investment advice, an automated trading decision, or real-time surveillance.",
    ko: "결과는 버전이 붙은 기술적 패턴을 데이터가 지지하는 정도입니다. 유죄 판단도, 법적 결론도, 인과 주장도, 투자 조언도, 자동 매매 결정도, 실시간 감시도 아닙니다.",
  },
  {
    en: "The repository runs deterministic fixtures over committed synthetic cases and licensed published quotations. It is not a production market-surveillance system, and its rule thresholds are illustrative per-case configuration rather than calibrated market thresholds.",
    ko: "이 저장소는 커밋된 합성 사례와 이용이 허락된 공표 시세 위에서 결정론적 fixture를 돌립니다. 운영용 시장감시 시스템이 아니고, 규칙 임계값은 사례마다 예시로 설정한 값이지 시장에 맞춰 보정한 값이 아닙니다.",
  },
  {
    en: "Every statement here about anything outside this repository carries a source or the mark that says it is the project's own reading. A marked statement is a premise this project works from, not a published finding.",
    ko: "이 저장소 밖의 무엇인가를 말하는 문장에는 전부 출처가 붙거나, 이 프로젝트의 해석이라는 표시가 붙습니다. 표시가 붙은 문장은 이 프로젝트가 전제로 삼는 것이지, 공표된 사실이 아닙니다.",
  },
];
