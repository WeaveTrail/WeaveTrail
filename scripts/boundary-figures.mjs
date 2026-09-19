/**
 * The boundary figures the design documents are drawn with.
 *
 * One entry is one figure: the text it draws, the document it belongs to, and
 * a short title in both languages. `figureSvg` lays the text out in the
 * committed monospace grid, so a figure cannot drift from its words, and the
 * same file serves both languages because the text is identifiers, contract
 * vocabulary and arrows rather than sentences.
 *
 * Run `pnpm figures:build` after changing anything here; `pnpm figures:check`
 * fails when a committed file no longer matches what this module renders.
 */

/** @typedef {{ id: string, doc: string, title: { en: string, ko: string }, lines: string[] }} BoundaryFigure */

/** @type {BoundaryFigure[]} */
export const BOUNDARY_FIGURES = [
  {
    id: "entry-routes",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "Entry routes and where each one leads",
      ko: "진입 경로와 각 경로가 여는 것",
    },
    lines: [
      "/                     → /why → /architecture · /replay?mode=guided",
      "/replay               guided ──hand off──► working      one server loader, one client surface",
      "/case-2026-09-03      approve scope ──► POST /api/case-2026-09-03",
      "                                          └─► CROSS_MARKET_SESSION_REVERSAL 1.0",
      "",
      "scenarios ─────────┐                             ┌─ REVIEWER_FACING  → Case Replay picker",
      "                   ├─► src/lib/replay-sources.ts ┤",
      "published-data ────┘                             └─ ENGINE_REGRESSION → engine, provider, API, contracts",
    ],
  },
  {
    id: "guided-steps",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "What a guided step shows and what completes the walkthrough",
      ko: "안내 단계가 보여 주는 것과 완료 조건",
    },
    lines: [
      "guided step rail    position · title · imperative · unmet condition · the one advancing control",
      "                    then, in its own scroll region: why · authority · step list",
      "                    below the rail breakpoint: action block fixed to the viewport bottom",
      "completion          explicit mapping and case approvals → REPLAYED with evaluation and",
      "                    sourceTrace → open a finding's disclosure → repeat the same approved case",
      "                    → string equality between the baseline hash and the later hash",
    ],
  },
  {
    id: "published-case-run",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "The published case: approve the scope, then the rule runs on the server",
      ko: "공개 사례: 범위를 승인해야 서버에서 규칙이 돈다",
    },
    lines: [
      "published prices (artifact, labelled as published)",
      "  → visitor approves scope in the browser",
      "  → POST /api/case-2026-09-03 → server rebuilds scope from committed artifacts",
      "      approval hash does not cover it            → refuse",
      "      committed mapping approval pins differ     → mapping review stop",
      "  → CROSS_MARKET_SESSION_REVERSAL 1.0 → rank in approved baseline · per-leg reversal",
      "      and multiple · canonicalResultHash",
      "candidate selection: STATED_DATE_ONLY_NO_CANDIDATE_SCAN",
    ],
  },
  {
    id: "acquisition-scopes",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "The two acquisition scopes and what they never reach",
      ko: "두 취득 범위와 그것이 닿지 않는 곳",
    },
    lines: [
      "bounded-window   first page, unchanged (existing FSC window)",
      "complete-series  closed identity/family/date selector fixed before retrieval",
      "                 → every returned page retained in order",
      "                 → row count == unchanged publisher total",
      "                 refused: value predicate · incomplete pagination",
      "acquisition scope ──✗──► canonical events · approval hashes",
      "network transport ──✗──► tests · CI · builds · runtime",
    ],
  },
  {
    id: "layer-authority",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "Four layers, one authority each, and the refusal path out of any of them",
      ko: "네 층위와 각 층의 권한, 그리고 어디서나 가능한 거부 경로",
    },
    lines: [
      "          proposal        approval         result          lineage",
      "L1 interpret ──► L2 approve ──► L3 decide ──► L4 evidence",
      "     ▲                │              │",
      "     │                └── cannot compute",
      "     └── cannot approve               └── cannot widen its own scope",
      "",
      "any layer ──► REVIEW_REQUIRED (no result, no result hash)",
      "HTTP boundary: validates every input before L1 acts; not one of the layers",
    ],
  },
  {
    id: "interpretation-boundary",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "Provider output becomes a proposal only after strict validation",
      ko: "공급자 출력은 엄격한 검증을 통과해야 제안이 된다",
    },
    lines: [
      "provider output (untrusted data)",
      "  → columns: existing source columns only · transforms: fixed allowlist",
      "  → strict 1.4 validation",
      "      invalid shape | low confidence | unknown column | unsupported transform",
      "        → REVIEW_REQUIRED",
      "  → proposal (not an approval)",
      "browser (Web Crypto) ─┬─ one runtime-neutral canonical serializer ─┬─► same proposal hash",
      "server (recompute)  ──┘                                            └─► required overrides enforced",
    ],
  },
  {
    id: "replay-pipeline",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "The mapping and replay endpoints and the five server steps between them",
      ko: "항목 연결과 재현 엔드포인트, 그 사이 서버 다섯 단계",
    },
    lines: [
      "POST /api/mapping { scenario }",
      "  → provider from server configuration + closed artifact eligibility registry",
      "      eligible: the two synthetic source dialects; all others keep fixture mappings",
      "  → strict mapping validation",
      "  → { mode, proposal, mappingReceipt? }        provider failure → 422 mapping review",
      "  receipt: model id + prompt version recorded server-side, encrypted, expires 30 min,",
      "           revalidated before the approval gate; neither receipt nor model output approves",
      "",
      "POST /api/replay { scenario, mutation, rows 1..64, mappingApproval?, mappingReceipt?, caseManifest? (approved CaseManifest) }",
      "  1 obtain the scenario proposal            caller-authored canonical events → rejected",
      "  2 verify the approval against that exact proposal",
      "  3 derive the executable mapping as a pure projection",
      "  4 compare every submitted row with the server-owned committed row at the same coordinate",
      "      missing coordinate | differing column → fail closed, never substituted",
      "  5 derive events, preserving submitted order",
      "  → no case manifest: stops at MAPPING_APPROVED, no sourceTrace",
      "  → approved case:    REPLAYED + closed rule result + 5 gate findings (conclusive)",
      "                      + mechanical sensitivity comparison + sourceTrace",
    ],
  },
  {
    id: "row-mutations",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "The three source-row mutations and what the server never does",
      ko: "세 가지 원본 행 변형과 서버가 하지 않는 것",
    },
    lines: [
      "baseline   committed order",
      "shuffle    caller permutes parsed rows before submission",
      "           working mode: browser-local Fisher–Yates, swap the first two if the draw",
      "           matches the previous submitted order; ≥2 rows differ from the previous",
      "           submission; history starts at committed order, resets on source change",
      "           or guided re-entry",
      "duplicate  committed order, then repeat the first derived event after mapping",
      "server     adds no randomness, substitutes no stored row, rejects repeated coordinates",
    ],
  },
  {
    id: "review-responses",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "Which failing stage selects which review state",
      ko: "어느 단계가 실패하면 어떤 검토 상태가 되는가",
    },
    lines: [
      "HTTP 422  { status: REVIEW_REQUIRED, issues[{ code, path, message }], workflowState }",
      "  input | canonicalization ambiguity     → INPUT_REVIEW_REQUIRED",
      "  mapping gate                           → MAPPING_REVIEW_REQUIRED",
      "  case approval | profile | rule config  → CASE_REVIEW_REQUIRED",
      "  never: a replay result or canonical result hash",
      "HTTP 500  reserved for defects outside these declared input failures",
    ],
  },
  {
    id: "source-trace",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "What one source-trace entry carries",
      ko: "원본 추적 항목 하나가 담는 것",
    },
    lines: [
      'sourceTrace.traceVersion "1.0"',
      "  entries: exactly one per distinct finding event, in canonical replay order",
      "    event     schemaVersion · eventId · sourceEventId · datasetId · venueId · eventTime",
      "              · instrumentId · eventType · rawRowHash",
      "              + sequence · side · actorId · counterpartyId · orderId · price · quantity when present",
      "    sourceRow coordinate { sourceArtifactHash, rowNumber } + unchanged string values",
      "              CSV rowNumber starts at 2 after the header; JSON Lines starts at 1",
      "INCONCLUSIVE → no findings, empty trace",
    ],
  },
  {
    id: "approval-states",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "The executed approval state machine",
      ko: "실행되는 승인 상태기계",
    },
    lines: [
      "UPLOADED -> MAPPING_PROPOSED -> MAPPING_REVIEW_REQUIRED",
      "                           \\-> MAPPING_APPROVED -> CASE_PROPOSED",
      "CASE_PROPOSED -> CASE_REVIEW_REQUIRED",
      "             \\-> CASE_APPROVED -> REPLAYED -> EXPORTED",
    ],
  },
  {
    id: "dataset-profile",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "Case validation stays inside the dataset profile",
      ko: "사례 검증은 데이터셋 프로파일 안에 머문다",
    },
    lines: [
      "canonical events → DatasetProfile { canonicalDatasetHash, instruments[], actors[], timeBounds }",
      "case validation ⊆ profile facts                    (validation cannot widen them)",
      "reviewer identity · approval time → audit metadata (outside the semantic result hash)",
    ],
  },
  {
    id: "decision-boundary",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "What the replay engine owns and what it never does",
      ko: "재현 엔진이 소유하는 것과 절대 하지 않는 것",
    },
    lines: [
      "replay engine owns  ordering · deduplication · decimal arithmetic · window aggregation",
      "                    · rule evaluation · mechanical sensitivity comparison · canonical hashes",
      "replay engine never executes code written by a model",
    ],
  },
  {
    id: "evidence-scopes",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "Lineage from a finding to its source row, and what each hash covers",
      ko: "판단 항목에서 원본 행까지의 계보와 각 해시의 범위",
    },
    lines: [
      "finding ──► eventId ──► rawRowHash ──► committed source row",
      "canonicalResultHash ⊇ engineVersion · canonical event projection · evaluation when present",
      "                    ⊉ mapping · manifest · approval hash        (does not bind case scope)",
      "bundleHash          ⊇ every 1.3 field except itself, including complete proposals,",
      "                      supplied approvals, source-artifact declarations, collection metadata",
      "excluded from the semantic hashes: receivedAt · rawRowHash · workflowState · audit metadata",
    ],
  },
  {
    id: "bundle-13",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "What Evidence Bundle 1.3 declares, assembles and verifies",
      ko: "증거 번들 1.3이 선언·조립·검증하는 것",
    },
    lines: [
      "EvidenceBundleV13Schema (strict, separate)   used by the byte-backed assembler and verifier",
      "  source-artifact declarations · complete mapping/case proposals · supplied approvals",
      "  · workflowState · replay?",
      "      replay          canonical events · engineVersion · dataset/result hashes · evaluation?",
      "      evaluation      reused as produced: finding gate · INCONCLUSIVE reason · empty findings",
      "                      · null sensitivity",
      "  no normalization        → omit replay",
      "  no rule result          → omit replay.evaluation only",
      "EvidenceBundleSchema validates 1.2 only; no implicit conversion",
      "",
      "assembleEvidenceBundle  exact CSV/JSON Lines bytes → hash → parse → declaration",
      "verifyBundle            separately supplied bytes → normalization → approval binding",
      "                        → evaluation → hash calculation",
      "                        multi-mapping declaration → fail closed (multi-source replay undefined)",
    ],
  },
  {
    id: "dependency-direction",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "Every workspace dependency edge, by tier",
      ko: "층위별 워크스페이스 의존 간선 전부",
    },
    lines: [
      "0  contracts        —",
      "1  scenarios        → contracts",
      "   published-data   → contracts",
      "2  replay-engine    → contracts   (devDependencies: scenarios, published-data)",
      "   ai-harness       → contracts, scenarios, published-data",
      "3  service-store    → contracts, replay-engine/canonical-json",
      "4  web              → contracts, scenarios, published-data, ai-harness, replay-engine",
      "   evals            —",
    ],
  },
  {
    id: "determinism-pipeline",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "From a committed source row to the canonical result hash",
      ko: "커밋된 원본 행에서 정본 결과 해시까지",
    },
    lines: [
      "committed source row ──hash──► rawRowHash",
      "   │ normalize  UTC nanoseconds (fixed width) · canonical decimal strings · signed zero",
      "   │            · RFC 8785 §3.2.2.3 finite-number spelling",
      "   ▼",
      "canonical event ──order──► eventTime -> sequence -> eventId    UTF-16 code units",
      "   │ exact duplicate       collapse, result unchanged",
      "   │ conflicting duplicate fail closed, canonical source-identity order",
      "   │ repeated eventId      CONFLICTING_EVENT_IDENTIFIER before ordering and hashing",
      "   ▼",
      "canonical dataset ──hash──► canonicalDatasetHash",
      "   │ rule  exact scaled-integer cross-products, never binary floating point",
      "   ▼",
      "evaluation ──hash──► canonicalResultHash                       reruns are identical",
    ],
  },
  {
    id: "provenance-hashes",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "Which hash name each artifact version carries",
      ko: "산출물 버전마다 어떤 해시 이름을 쓰는가",
    },
    lines: [
      "mapping proposal 1.4 / 1.5   sourceArtifactHash",
      "case manifest 1.3            canonicalDatasetHash",
      "evidence bundle 1.2          canonicalDatasetHash",
      "evidence bundle 1.3.replay   canonicalDatasetHash + every declared sourceArtifactHash",
      "datasetHash (legacy)         not accepted by the strict contracts",
    ],
  },
  {
    id: "approval-versions",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "What each approval artifact version declares",
      ko: "승인 산출물 버전이 각각 선언하는 것",
    },
    lines: [
      "manifest 1.3   immutable approval record (from 1.2) · ≥1 actor",
      "               · only registered rule parameters for the declared rule version",
      "manifest 1.4   non-empty instrument set · closed pattern-to-participant policy",
      "               · empty actor list = identity absent from the source, so profile",
      "                 validation requires an empty actor profile",
      "proposal 1.4   closed identity constants and transform pairs",
      "               · DECIMAL_STRING produces canonical decimal spelling",
      "request 2.0    source rows + mapping approval, not canonical events",
    ],
  },
  {
    id: "deployment-boundary",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "What the deployment runs and what the service tier still needs",
      ko: "배포가 돌리는 것과 서비스 층에 아직 필요한 것",
    },
    lines: [
      "Vercel (main)     one Next.js application + local workspace packages",
      "                  fixture mode: no external model, no database",
      "                  server-side only: provider adapters and credentials",
      "                  browser bundles: never a provider credential",
      "service tier      @weavetrail/service-store → SQLite at an explicit persistent path",
      "                  immutable snapshots + derived-result input bindings",
      "                  not wired into the current web deployment",
      "replay workflow   request-local",
    ],
  },
  {
    id: "public-routes",
    doc: "docs/ARCHITECTURE.md",
    title: { en: "The eight public routes", ko: "여덟 개의 공개 경로" },
    // The route names stay in the document text, where the deployment check
    // looks for them, rather than only inside the figure.
    alt: {
      en: "The eight public routes: /, /why, /architecture, /methodology, /evals, /expectations, /replay in guided and working modes, and /case-2026-09-03",
      ko: "여덟 개의 공개 경로: /, /why, /architecture, /methodology, /evals, /expectations, 안내와 직접 조작의 /replay, /case-2026-09-03",
    },
    lines: [
      "public routes   / · /why · /architecture · /methodology · /evals · /expectations",
      "                · /replay (guided, working) · /case-2026-09-03",
    ],
  },
  {
    id: "daily-quote-versions",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "How daily-quote versions coexist in the registry",
      ko: "일별 시세 버전이 레지스트리에서 공존하는 방식",
    },
    lines: [
      "registry metadata carries versions and constants by artifact hash",
      "Event 1.2 (daily only) + Proposal 1.5 / 1.6",
      "  approved DAILY_QUOTE constant · trading-date anchor transform",
      "Proposal 1.6",
      "  injective ordered composite for sourceEventId only; components stay original",
      "  source columns; duplicate-source and duplicate-target checks retained",
      "unchanged: existing input branches · engine version · canonical processing · result shapes",
    ],
  },
  {
    id: "cross-market-entry",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "The separate cross-market entry point and what it accepts",
      ko: "별도의 교차시장 진입점과 그것이 받아들이는 것",
    },
    lines: [
      "Event 1.3 + Proposal 1.7 (separate opt-in)",
      "  retain trading date · OHLC · the publisher's absolute net change",
      "engine 0.8.0-cross-market-session-reversal",
      "  one declared date over an approved Case Manifest 1.4",
      "  exact scaled-integer arithmetic · declared baseline · per-leg gates",
      "  accepts combined canonical events from the declared published artifacts",
      "  single-source HTTP Case Replay: unchanged",
    ],
  },
  {
    id: "denominator-substitution",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "What a conclusive cross-market 1.1 result reports",
      ko: "교차시장 1.1이 결론을 낼 때 보고하는 것",
    },
    lines: [
      "per leg (approved configuration)   one denominator + ≥1 declared alternative",
      "conclusive output                  approved and recomputed metrics · their ratio",
      "                                   · denominator values and meanings",
      "                                   under the shared MECHANICAL_METRIC_COMPARISON marker",
      "minimum price increment            INSTRUMENT_MINIMUM_PRICE_INCREMENT_NOT_TRADE_ESTABLISHED_LEVEL",
      "                                   an inline approved value retains its provenance",
      "missing declared field | denominator ≤ 0 → INCONCLUSIVE, sensitivity null",
    ],
  },
  {
    id: "execution-schema-mapping",
    doc: "docs/ARCHITECTURE.md",
    title: {
      en: "What Mapping Proposal 1.8 fixes, converts and refuses to invent",
      ko: "항목 연결 제안 1.8이 고정·변환하고 만들어 내지 않는 것",
    },
    lines: [
      "Mapping Proposal 1.8 (opt-in)   synthetic intraday executions shaped as published",
      "                                FIX 4.4 ExecutionReport and H0STCNT0 response fields",
      "  eventType: TRADE (fixed) · both published side code sets converted",
      "  FIX UTC timestamps converted · H0STCNT0 business date + execution time → explicit KST",
      "  unmappedFields: H0STCNT0 has no participant/account column",
      "    → requires a justified approval override",
      "    → never enters the executable mapping, never creates an actor",
      "Proposals 1.4–1.7   unchanged, no migration",
    ],
  },
  {
    id: "canonical-serialization",
    doc: "docs/EVIDENCE_HASH_SCOPES.md",
    title: {
      en: "The canonical serialization rules both hashes use",
      ko: "두 해시가 함께 쓰는 정본 직렬화 규칙",
    },
    lines: [
      "sha256Canonical = SHA-256(UTF-8 bytes of canonicalJson(value)) → 64 lowercase hex",
      "  no BOM · no whitespace padding · no trailing newline",
      "  object keys      lexicographic by UTF-16 code unit at every depth, integer-looking keys included",
      "  undefined        object properties omitted",
      "  arrays           supplied order kept; holes, undefined elements and a top-level",
      "                   undefined value rejected",
      "  null             a value, distinct from an absent property",
      "  numbers          finite only; ECMAScript JSON.stringify spelling, negative zero as 0",
      "                   (RFC 8785 §3.2.2.3)",
      "  strings          JSON escaping, no Unicode normalization",
      "not claimed        full JCS compliance (no extra lone-surrogate validation)",
    ],
  },
  {
    id: "result-preimage",
    doc: "docs/EVIDENCE_HASH_SCOPES.md",
    title: {
      en: "The canonical result hash preimage",
      ko: "정본 결과 해시의 원상",
    },
    lines: [
      "SHA256(canonicalJson({",
      '  engineVersion: "0.7.0-canonical-decimal",',
      "  events: canonicalEvents.map(projectCanonicalEvent),",
      "  ...the evaluation property only when evaluation exists",
      "}))",
    ],
  },
  {
    id: "result-scope",
    doc: "docs/EVIDENCE_HASH_SCOPES.md",
    title: {
      en: "What the result preimage contains and what stays outside it",
      ko: "결과 원상이 담는 것과 그 밖에 남는 것",
    },
    lines: [
      "preimage keys   engineVersion · events · evaluation (only when it exists)",
      "  evaluation    the complete engine result: rule identity and version · non-comparable",
      "                event count · all findings including gate · sensitivity · INCONCLUSIVE reason",
      "  events        Event 1.1/1.2 → the 15 CANONICAL_EVENT_FIELDS",
      "                Event 1.3     → those plus the six OHLC_DAILY_CANONICAL_EVENT_FIELDS",
      "                absent optional fields stay absent",
      "outside         approved mapping · manifest · their hashes · their approvals",
      "                reviewer identity · approval and export timestamps · run IDs",
      "                receivedAt · workflowState · response counts and source traces",
    ],
  },
  {
    id: "bundle-hash-scope",
    doc: "docs/EVIDENCE_HASH_SCOPES.md",
    title: {
      en: "What the bundle hash covers and what verification repeats",
      ko: "번들 해시가 덮는 것과 검증이 다시 하는 것",
    },
    lines: [
      'EvidenceBundleV13Schema   separate, opt-in bundleVersion "1.3"',
      "bundleHash = SHA256(canonicalJson(bundle with only bundleHash omitted))   evidenceBundleHash",
      "  covered      source-artifact hash declarations · complete mapping and case proposals",
      "               · complete supplied approval records · workflowState",
      "               · event collection metadata · the claimed result and dataset hashes",
      "  excluded     bundleHash itself, to avoid self-reference; nothing else",
      "  consequence  a changed approval time changes bundleHash and leaves",
      "               canonicalResultHash unchanged",
      "",
      "verifyBundle(bundle as untrusted input, separately supplied CSV/JSON Lines bytes)",
      "  strict shape → source byte hashes → re-parse rows → bind approvals to proposals",
      "  → replay the deterministic engine → compare dataset, result and bundle hashes",
      "  multi-mapping declaration → rejected until multi-source replay semantics exist",
      "  hash equality ≠ authenticity, reviewer authentication or signature",
    ],
  },
  {
    id: "provenance-identities",
    doc: "docs/EVIDENCE_HASH_SCOPES.md",
    title: {
      en: "The four provenance identities, one boundary each",
      ko: "출처 식별자 넷, 각각 하나의 경계",
    },
    lines: [
      "ADR 0005's four provenance identities, unchanged and one-to-one",
      "  sourceArtifactHash    exact source bytes",
      "  rawRowHash            a coordinate and its verbatim row strings",
      "  eventId               the composite source identity",
      "  canonicalDatasetHash  ordered semantic event projections",
      "neither hash adds a fifth identity or broadens one of the four",
      "a bundle covers source declarations, not embedded raw bytes; raw rows and display",
      "provenance are not fields of this export shape",
    ],
  },
  {
    id: "stopped-artifacts",
    doc: "docs/EVIDENCE_HASH_SCOPES.md",
    title: {
      en: "What a bundle claims when replay stopped early",
      ko: "재현이 도중에 멈췄을 때 번들이 주장하는 것",
    },
    lines: [
      "no successful normalization      omit replay entirely — no events, dataset hash, result",
      "                                 hash or evaluation to claim; bundleHash still covers the",
      "                                 source declarations and whatever proposals and approvals",
      "                                 are present. A failed HTTP request keeps its 422 review",
      "                                 shape with no result hash.",
      "foundation normalization         replay present (events, dataset hash, result hash),",
      "                                 replay.evaluation omitted",
      "  the FSC real/fsc-stock-quotes-20260903.jsonl artifact after explicit mapping approval:",
      "  workflowState MAPPING_APPROVED · Event 1.2 · Proposal 1.5 · no case · no actor",
      "  · no rule verdict",
      "  result hash protects engineVersion + canonical event projection;",
      "  bundleHash additionally protects its declaration and approval",
      "case proposal without a valid approval   the same foundation replay is retained,",
      "  workflowState CASE_REVIEW_REQUIRED, no rule evaluation claimed",
      "INCONCLUSIVE                     a completed evaluation: reason, empty findings,",
      "                                 null sensitivity — all of it result-hashed",
    ],
  },
  {
    id: "bundle-12-boundary",
    doc: "docs/EVIDENCE_HASH_SCOPES.md",
    title: {
      en: "Where bundle 1.2 stops and 1.3 begins",
      ko: "번들 1.2가 멈추는 자리와 1.3이 시작하는 자리",
    },
    lines: [
      "EvidenceBundleSchema / EvidenceBundle        strictly 1.2, migration rejection tests intact",
      "EvidenceBundleV13Schema / EvidenceBundleV13  explicit opt-in",
      "neither schema accepts the other version · no automatic conversion",
      "assembly and verification: complete 1.3 declaration + original source bytes only",
      "",
      "1.2 cannot represent   the stopped FSC artifact · full engine findings · complete approvals",
      "1.2 has no bundleHash  and no bundle-hash scope is assigned to it",
      "1.2 canonicalResultHash still names the existing engine hash, but the lossy 1.2",
      "                        summary alone cannot reconstruct that preimage",
    ],
  },
  {
    id: "bundle-12-migration",
    doc: "docs/EVIDENCE_HASH_SCOPES.md",
    title: {
      en: "Where each 1.2 field moves in a 1.3 declaration",
      ko: "1.2의 각 항목이 1.3 선언에서 가는 자리",
    },
    lines: [
      "full engine evaluation            → replay.evaluation   (gate included; null sensitivity",
      "                                                         when INCONCLUSIVE)",
      "canonical events and hashes       → replay",
      "mapping proposals and approvals   → mappings",
      "Manifest 1.3 proposal + approval  → case",
      "old top-level caseId              → case.proposal.caseId",
      "approved proposal hash            → case.approval.approvedArtifactHash, when it exists",
      "old standalone manifestHash       → neither a substitute for the proposal and approval",
      "                                    record nor an additional result-hash input",
    ],
  },
  {
    id: "acquisition-refusals",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What stops acquisition and what is never permitted",
      ko: "취득을 멈추는 조건과 절대 허용되지 않는 것",
    },
    lines: [
      "stops acquisition   missing · restricted · inaccessible · contradictory permission",
      "never permitted     inventing a field · changing original source values",
      "                    · selecting rows after seeing them",
    ],
  },
  {
    id: "existing-artifact",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What the existing FSC artifact retains and what its classification adds",
      ko: "기존 FSC 산출물이 유지하는 것과 분류가 더하는 것",
    },
    lines: [
      "FSC KOSPI artifact   original response · JSONL · generated rows · provenance · request",
      "                     · licence record · pinned hashes, all retained",
      "fsc-stock-quotes-20260903.acquisition.json",
      "  classifies it bounded-window, references the existing provenance filename and",
      "  sourceArtifactHash, and describes the already recorded window policy",
      "  → it invents no historical declaration timestamp",
    ],
  },
  {
    id: "series-declaration",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "The strict complete-series declaration",
      ko: "엄격한 완전 시리즈 선언",
    },
    lines: [
      'scope        "complete-series"',
      "date         one completed Gregorian YYYYMMDD, or exactly",
      '             { kind: "range", begin, endExclusive } for a nonempty half-open range',
      "filter       exactly { kind, value }",
      "               exact          instrument · index · series · date",
      "               publisher-matched  index-family · instrument-family",
      "               a date selector must equal the declared single date",
      "pageSize     a positive integer string fixed before retrieval, not a row ceiling",
      "declaredAt   UTC ISO timestamp, millisecond precision",
      "permission   the operator's UNRESTRICTED determination · exact permission label",
      "             · checkedAt · HTTPS termsUrl · attribution text",
    ],
  },
  {
    id: "selector-limits",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What a selector value may and may not be",
      ko: "선택자 값이 될 수 있는 것과 될 수 없는 것",
    },
    lines: [
      "exact identity values   single ASCII token: letter/digit, then letters, digits,",
      '                        ".", "_", ":" or "-", at most 128 characters',
      "family values           may add Unicode letters and spaces",
      "never accepted          lists · wildcards · expressions · comparison operators",
      "                        · price, volume or outcome as a filter kind",
      "                        · a value predicate inside the date range",
      "                        · publisher parameter names or arbitrary query parameters",
    ],
  },
  {
    id: "adapter-boundary",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What a reviewed publisher adapter binds and what its decoder must not do",
      ko: "검토된 발행처 어댑터가 묶는 것과 디코더가 하면 안 되는 것",
    },
    lines: [
      "publisher adapter   reviewed repository code — never an operator or model declaration,",
      "                    never loaded from artifact metadata",
      "  request spec      fixed endpoint · publisher parameter names · single date or half-open",
      "                    range · identity or family selector · page number · page size",
      "                    · optional response format",
      "  during retrieval  only the page number changes; settings and the logical declaration",
      "                    are copied and frozen before transport, each request immutable",
      "  endpoint          HTTPS, no embedded query, fragment or credentials",
      "  review must fix   whether each selector means exact equality or literal family match",
      "                    · that a format control is not a selection predicate",
      "                    · that the decoder checks provider success and exposes the complete",
      "                      original item array",
      "  decoder           receives the frozen declaration, so returned scope identities can be",
      "                    checked where the publisher supplies them",
      "                    returns page number, page size and publisher total as canonical",
      "                    integer strings; retains every column and row as strings",
      "                    must not coerce, filter, sort, deduplicate or fabricate a field",
      "                    new publisher columns get no canonical mapping from this mechanism",
    ],
  },
  {
    id: "transport-guard",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "The injected transport and the credential-echo guard",
      ko: "주입된 전송 계층과 자격증명 반향 차단",
    },
    lines: [
      "fetchPage(request, { signal, redirect })   the injected transport",
      '  honors the 30-second abort signal and redirect: "error"',
      "  injects credentials from its environment without changing the declared selection",
      "  exposes no credential in the recorded request",
      "guard   secrets() supplies raw and decoded credential forms; the collector also checks",
      "        percent, form and JSON-string escaping, and for valid JSON walks every decoded",
      "        object key and string value, covering equivalent slash and Unicode escape forms",
      "fail closed   credential echo · failed HTTP status · redirect · transport exception",
      "              transport and decode errors are replaced with messages carrying no raw URL",
    ],
  },
  {
    id: "retrieval-loop",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "The retrieval loop and every condition that stops it",
      ko: "수집 루프와 그것을 멈추는 모든 조건",
    },
    lines: [
      "before the first request   today's UTC permission and declaration dates checked",
      "                           · the requested date must be completed",
      "                           · a new output directory reserved, declaration.json written",
      "pages                      sequential from page 1, never a subset, never a short",
      "                           intermediate page",
      "each response              declared page and page size must match the request",
      "                           every page reports the same total",
      "                           all full pages plus the exact final remainder must be present",
      "total of zero              one empty first page and an empty source file; it implies",
      "                           no replay result",
      "stops acquisition          permission-date rollover · changing total · inconsistent page",
      "                           · missing row → review, never trimming or a fallback scope",
    ],
  },
  {
    id: "retained-files",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What each retained file holds and how writes fail",
      ko: "보관하는 파일이 담는 것과 쓰기 실패 규칙",
    },
    lines: [
      "page-N.response   original entity bytes, no reserialization; the decoder receives a copy,",
      "                  so adapter parsing cannot mutate the retained or hashed HTTP entity",
      "source.jsonl      every decoded item in page and item order, compact JSON.stringify per",
      "                  item, LF separators, final LF for nonempty data; values and column",
      "                  insertion order intact",
      "rows.json         adds only source coordinates: the source SHA-256 and the one-based",
      "                  physical line number; reproducible offline with",
      "                  scripts/derive-published-rows.mjs",
      "hashing           ordinary SHA-256 of UTF-8 bytes; no financial arithmetic",
      "memory            the collector holds rows in memory; a storage or memory failure is an",
      "                  acquisition failure, never permission to admit a partial series",
      "writes            exclusive creation; existing directories and files are refused before",
      "                  transport; a caught failure removes only what the invocation created and",
      "                  tries to remove its directory, and cleanup failure stays an error",
    ],
  },
  {
    id: "acquisition-receipt",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What the acquisition receipt records",
      ko: "취득 영수증이 기록하는 것",
    },
    lines: [
      "acquisition.json   written only after complete responses, the derived source and a",
      "                   deterministic rows.json",
      "  frozen declaration · retrieval timestamp · page count · row count · publisher total",
      "  · each original page filename and checksum · each exact public endpoint and parameter",
      "    request · per-page count and total · the derived sourceArtifactHash",
      "  authentication values excluded from request records",
      "publisherObservations   closed, evidence-bearing records only, for an exclusive range end",
      "                        or a rounded decimal column; each carries verification time,",
      "                        statement and evidence, and arbitrary shapes are refused",
    ],
  },
  {
    id: "source-directory",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What one committed source directory contains",
      ko: "커밋된 원본 디렉터리 하나가 담는 것",
    },
    lines: [
      "one source directory   original pages · declaration.json · acquisition.json",
      "                       · <artifact>.provenance.json (complete)",
      "provenance             records the derived source path and hash at artifacts.runtimeJsonl",
      "bounded window         stays <artifact>.acquisition.json",
      "a complete-series receipt is acquisition evidence, not a substitute for provider, origin,",
      "retrieval time, licence, attribution and reproducible derivation instructions",
      "runtime JSONL path must resolve inside that same source directory",
      "admission              hashes committed bytes before decoding · requires exact UTF-8",
      "                       · compares the decoded JSONL with rows rebuilt from the original pages",
      "                       · normalizes offline adapter registry endpoints as URLs before",
      "                         matching the canonical request endpoint in the receipt",
    ],
  },
  {
    id: "offline-admission",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What offline admission re-checks and what it rejects",
      ko: "오프라인 승인이 다시 확인하는 것과 거부하는 것",
    },
    lines: [
      "verifyPublishedAcquisitions   scans committed provenance records, requires each adjacent",
      "                              scope declaration, and rejects any unclaimed file in the real",
      "                              source tree, so omitting provenance cannot evade checks",
      "bounded-window admission      reuses the original FSC derivation, checks source and",
      "                              generated bytes against recorded hashes",
      "complete-series admission     requires an explicitly registered offline adapter; an unknown",
      "                              adapter is refused",
      "validateCompleteSeriesArtifact",
      "  re-decodes every original page · checks page sequence and totals · reproduces the JSONL",
      "  and generated rows in returned order · compares the complete record",
      "  rejected: fewer rows than the reported total, even when the source checksum and declared",
      "            row count were rewritten to match the truncation",
      "            · missing pages · reordered data · mismatched recorded requests",
      "  also required: the retained declaration.json equals the receipt's declaration, and real",
      "            provider, title, HTTPS origin, retrieval time, permission label, terms, check",
      "            time, requirements, attribution and runtime source metadata are present, with",
      "            receipt retrieval and permission values matching provenance",
      "no verifier fetches data",
    ],
  },
  {
    id: "acquisition-ownership",
    doc: "docs/PUBLISHED_ACQUISITION.md",
    title: {
      en: "What acquisition declarations never touch",
      ko: "취득 선언이 절대 건드리지 않는 것",
    },
    lines: [
      "acquisition declarations   live beside published artifacts and never reach mappings,",
      "                           approvals or canonical event projections",
      "unchanged by them          sourceArtifactHash · rawRowHash · eventId",
      "                           · canonicalDatasetHash · the semantic result hash",
      "ownership                  published data stays in packages/published-data; synthetic",
      "                           scenarios stay synthetic",
      "no call site                in tests using real transport, CI, builds or application runtime",
    ],
  },
  {
    id: "snapshot-collection",
    doc: "docs/SERVICE_SNAPSHOTS.md",
    title: {
      en: "Opening the store, admitting a source and the built-in transport",
      ko: "저장소 열기, 원천 승인, 내장 전송 계층",
    },
    lines: [
      "new SnapshotStore(path)        Node ≥ 22.13 · existing directory on a persistent local disk",
      "                               explicit absolute SQLite filename",
      "                               initializes the version-1 database on first use",
      "                               rejects unsupported database versions",
      "no default store               imports · web requests · builds · manual acquisition scripts",
      "                               never start collection      (.service-store/ is Git-ignored)",
      "",
      "collectPublicSource(store, source, fetchResponse?)",
      "  PublicSource   exact HTTPS origin URL · publisher · collector version · licence evidence",
      "  licence        label · termsUrl · checkedAt (UTC) · attributionRequirements · attribution",
      "                 · permitsStorage · permitsModification · permitsRedistribution (explicit true)",
      '  refused        secrets or a fragment delimiter in the URL, including a trailing "#"',
      "                 · a model proposal or an arbitrary browser URL as a source",
      "                 · a review time later than collection",
      "  stored URL     WHATWG canonical serialization Fetch resolves, so equivalent scheme, host,",
      "                 default-port and whitespace spellings share one source identity",
      "",
      "built-in transport   unauthenticated public endpoints only",
      "  omits credentials · refuses redirects and non-success/partial responses · 30 s timeout",
      "  reads arrayBuffer() before storing the original entity bytes",
      "  preserves binary documents, invalid UTF-8, whitespace, line endings",
      "  entity bytes = the Fetch response body, never headers, TLS traffic or wire framing",
      "  retrievedAt recorded after the body arrives · transport errors use a fixed message",
    ],
  },
  {
    id: "snapshot-immutability",
    doc: "docs/SERVICE_SNAPSHOTS.md",
    title: {
      en: "What recollection produces and what the store refuses",
      ko: "다시 수집했을 때 생기는 것과 저장소가 거부하는 것",
    },
    lines: [
      "same URL, changed bytes    → new snapshot, previousSnapshotId → the one before it",
      "same URL, unchanged bytes  → the original reference, unchanged first retrievedAt,",
      "                             collector version and licence record; not a durable record",
      "                             of a new permission review",
      "A → B → A                  → the third record links back to B, A's blob deduplicated",
      "different origin URLs      → independent histories",
      "",
      "no replace, no delete      SQLite triggers reject updates, deletes and replacement inserts",
      "one transaction            snapshot bytes + metadata; result + its input bindings",
      "every read                 Zod contract validation + hash recalculation",
      "fail closed                missing snapshot · hash mismatch · invalid record · corruption",
      "                           resolution never falls back to the current source",
    ],
  },
  {
    id: "derived-result",
    doc: "docs/SERVICE_SNAPSHOTS.md",
    title: {
      en: "The derived-result envelope and what changes its identity",
      ko: "파생 결과 봉투와 그 식별자를 바꾸는 것",
    },
    lines: [
      "storeDerivedResult(record)   every service event, conclusion or check",
      '  schemaVersion "1.0" · kind "event" | "conclusion" | "check"',
      "  computationVersion  nonempty, identifies the reviewed implementation",
      "  inputs              nonempty, unique, each { snapshotId, sha256 }",
      "  value               JSON, already validated by the application",
      "",
      "getSnapshot bytes ──compute──► value ──store──► resultId",
      "  identical envelope              → the same resultId",
      "  changed version | input | output → a different resultId",
      "  input order                      preserved",
      "  a later collection               cannot retarget an old result: readers use the",
      "                                   retained resultId, never an origin's current head",
    ],
  },
  {
    id: "snapshot-migration",
    doc: "docs/SERVICE_SNAPSHOTS.md",
    title: {
      en: "What the service tier adds and what it leaves unchanged",
      ko: "서비스 층이 더하는 것과 그대로 두는 것",
    },
    lines: [
      "additive               SourceProvenance · committed artifact records · replay responses",
      "                       · bundles need no migration or regeneration",
      "new installs           Node ≥ 22.13, so storage tests load node:sqlite without a flag",
      "new producers          store admitted inputs first, then use the envelope",
      "user_version = 1       names the storage layout; a later version needs an explicit",
      "                       migration, never silent replacement",
      "workflow histories     remain request-local",
      "dependencies           existing contracts + canonical JSON + Node's built-in SQLite;",
      "                       no third-party database dependency",
      "current deployment     mounts no store and performs no runtime collection",
    ],
  },
  {
    id: "snapshot-limits",
    doc: "docs/SERVICE_SNAPSHOTS.md",
    title: {
      en: "What is not implemented and how it fails",
      ko: "구현되지 않은 것과 실패하는 방식",
    },
    lines: [
      "not implemented   streaming ingestion · multi-host database · retention deletion",
      "                  · backup automation · publisher authenticity · production-scale benchmark",
      "known limits      full responses are buffered, SQLite calls are synchronous",
      "                  an operator who can replace the database or drop triggers can tamper:",
      "                  hash verification detects mismatches against retained IDs, not an",
      "                  independently replaced set of records",
      "errors            a full disk or the five-second lock timeout is an error; never fall back",
      "                  to temporary or request-local storage after a persistence error",
    ],
  },
];

/** Where the committed figures live, relative to the repository root. */
export const FIGURE_DIRECTORY = "docs/assets/boundary";

export const figurePath = (id) => `${FIGURE_DIRECTORY}/${id}.svg`;

/** What a document writes as the figure's alternative text. */
export const figureAlt = (figure, language) =>
  (figure.alt ?? figure.title)[language];

// One monospace cell. JetBrains Mono advances 0.6em, so a column is exactly
// this wide at the figure's font size and every line lands on the grid.
const FONT_SIZE = 13;
const COLUMN = 7.8;
const LINE = 21;
const PAD_X = 24;
const TOP_BAR = 4;
const EYEBROW_Y = 26;
const BODY_TOP = 46;
const PAD_BOTTOM = 22;
const MIN_WIDTH = 460;

/** Glyphs that carry the figure's structure rather than its words. */
const STRUCTURE = new Set([..."→►─│┌┐└┘├┤┬┴▼▲✗·⊆⊇⊉≥≤≠—"]);

const escape = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A contract constant, which the figure sets apart from ordinary words. */
const CONSTANT = /^[A-Z][A-Z0-9_]{2,}$/;

const classOf = (word) => {
  if ([...word].every((character) => STRUCTURE.has(character))) return "g";
  if (CONSTANT.test(word.replace(/[^A-Z0-9_]/g, ""))) return "k";
  return "t";
};

/**
 * Whole words, so a class follows meaning rather than character shape: a
 * contract constant reads as one, and a number inside a sentence does not.
 */
const runs = (line) => {
  const found = [];
  for (const match of line.matchAll(/\S+/g)) {
    const word = match[0];
    const column = match.index ?? 0;
    const structural = [...word].filter((character) =>
      STRUCTURE.has(character),
    );
    if (structural.length > 0 && structural.length < word.length) {
      // A word glued to an arrow keeps both readings: split at the boundary.
      let start = 0;
      let isStructure = STRUCTURE.has(word[0] ?? "");
      for (let index = 1; index <= word.length; index += 1) {
        const next = index < word.length && STRUCTURE.has(word[index] ?? "");
        if (index === word.length || next !== isStructure) {
          const text = word.slice(start, index);
          found.push({
            column: column + start,
            className: isStructure ? "g" : classOf(text),
            text,
          });
          start = index;
          isStructure = next;
        }
      }
      continue;
    }
    found.push({ column, className: classOf(word), text: word });
  }
  return found;
};

/** A leading label, drawn in the strongest ink so the left column reads first. */
const labelWidth = (line) => {
  if (line.startsWith(" ")) return 0;
  const separator = line.search(/ {2,}/);
  return separator === -1 ? line.length : separator;
};

export function figureSvg(figure) {
  const columns = Math.max(...figure.lines.map((line) => line.length));
  const width = Math.max(MIN_WIDTH, Math.ceil(columns * COLUMN + PAD_X * 2));
  const height = BODY_TOP + figure.lines.length * LINE + PAD_BOTTOM;
  const body = figure.lines
    .map((line, index) => {
      const y = BODY_TOP + index * LINE;
      const label = labelWidth(line);
      const spans = runs(line)
        .map((run) => {
          const className = run.column < label ? "l" : run.className;
          const x = (PAD_X + run.column * COLUMN).toFixed(1);
          return `<tspan class="${className}" x="${x}" y="${y}">${escape(run.text)}</tspan>`;
        })
        .join("");
      return spans ? `    <text>${spans}</text>` : "";
    })
    .filter(Boolean)
    .join("\n");

  const description = `${figure.lines.join("\n")}\n\n${figure.title.ko} 도식입니다. 그림 안의 글자는 위 내용과 같습니다.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t ${figure.id}">
  <title id="t">${escape(figure.title.en)} · ${escape(figure.title.ko)}</title>
  <desc id="${figure.id}">${escape(description)}</desc>
  <!--
    Generated by scripts/build-boundary-figures.mjs from boundary-figures.mjs.
    One file serves both languages: the words are identifiers, contract
    vocabulary and arrows, and each language brings its own alternative text.
    Literal hex, because CSS custom properties do not resolve inside a
    standalone SVG.
    #f7faf9 paper-1 | #ffffff paper-0 | #d0d7de ledger-rule
    #0c1513 ink-900 | #14211f ink-800 authorship-code | #263230 ink-700
    #0b6e6a teal-700 authorship-human
  -->
  <defs>
    <style>
      text{font-family:"JetBrains Mono","IBM Plex Mono",ui-monospace,SFMono-Regular,Consolas,monospace;font-size:${FONT_SIZE}px;white-space:pre}
      .eyebrow{font-family:"IBM Plex Sans","IBM Plex Sans KR","Segoe UI",Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.08em;fill:#0b6e6a}
      .l{fill:#0c1513;font-weight:600}
      .k{fill:#14211f;font-weight:600}
      .t{fill:#263230}
      .g{fill:#0b6e6a}
    </style>
  </defs>

  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <rect width="${width}" height="${TOP_BAR}" fill="#0b6e6a"/>
  <rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#d0d7de"/>
  <text class="eyebrow" x="${PAD_X}" y="${EYEBROW_Y}">${escape(figure.title.en.toUpperCase())}</text>

${body}
</svg>
`;
}
