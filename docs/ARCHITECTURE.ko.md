# 아키텍처

_[English](ARCHITECTURE.md) · 영문 문서가 기준입니다._

확률적인 해석과 권위 있는 계산을 분리합니다. 모델은 모호함을 좁힐 수 있지만,
재현 결과를 만들 수 있는 것은 검증된 입력과 버전이 고정된 코드뿐입니다.

## 시작 화면과 사례 재현

![진입 경로와 각 경로가 여는 것](assets/boundary/entry-routes.svg)

- `packages/scenarios`는 합성 데이터셋과 통제된 변형을 소유하고,
  `packages/published-data`는 라이선스가 확인된 아티팩트와 출처 기록, 오프라인에서
  생성한 행, 선언된 항목 연결을 소유하며 계약에만 의존합니다. 시나리오 패키지는
  공개 자료를 가져오지도 다시 내보내지도 않고, 픽스처 공급자는 두 소유자 모두에서
  항목 연결을 명시적으로 가져옵니다
  ([ADR 0023](adr/0023-separate-published-data-ownership.md)(영문)).
- 카탈로그 메타데이터가 커밋된 원본마다 `REVIEWER_FACING`인지
  `ENGINE_REGRESSION`인지 표시합니다. 선택 목록에는 근거가 있는 원본과, 세 결과
  의미를 모두 도달 가능하게 유지하는 데 필요한 픽스처만 올립니다. 완전한 FIX 4.4
  사례는 `SUPPORTED`, 한쪽이 빠진 FIX 형태 사례는 `INCONCLUSIVE`를 내고,
  `NOT_SUPPORTED` 자리는 근거가 있는 사례가 그 의미를 재현할 때까지 남습니다. FIX
  형태의 식별자 충돌 원본은 재현 전에 `INPUT_REVIEW_REQUIRED`에서 멈춥니다.
  `/expectations`는 각 사례가 증명하는 정확한 조건, 두 용도, 사례 재현 제공 여부,
  결과 해시 생성 여부를 밝힙니다.
- 메타데이터는 원본별로 제공하는 변형도 선언합니다. 공개 스키마 합성 원본과 결과
  픽스처는 `baseline`·`shuffle`·`duplicate`를, 라이선스가 확인된 아티팩트는
  `baseline`·`shuffle`만 제공합니다. 어떤 조작도 커밋된 값을 고치거나 참여자나
  판정을 더하지 않습니다
  ([ADR 0038](adr/0038-separate-reviewer-facing-sources-from-engine-regressions.md)(영문),
  [ADR 0039](adr/0039-separate-missing-evidence-abstention-from-conflict-review.md)(영문)).
- `/why`는 기존 시장감시 흐름에 대해 게이트가 어디에 있는지 밝히고 근거로 삼은 공개
  자료를 인용합니다. 개요는 작동 방식보다 자리를 먼저 말합니다. 시장감시가 후보를
  올리고, WeaveTrail이 범위를 확인해 다시 계산하고 근거를 열고, 사람이 판단합니다.
  탐지는 하지 않습니다.

![안내 단계가 보여 주는 것과 완료 조건](assets/boundary/guided-steps.svg)

- 내비게이션 항목은 `사례 따라가기` 하나입니다. `안내 따라가기`와 `직접 조작`이 두
  가지 사용 방식을 이름 붙이고 실행 중인 쪽을 표시합니다. `/replay`는 안내를 열고
  `mode=working`이 직접 조작을 고릅니다. 표시 모드의 기준은 주소이며, 주소는 신뢰할
  승인이나 결과 상태를 담지 않습니다. 안내로 다시 들어오면 지지 사례 기준선이
  복원되고 직접 조작의 입력 상태는 지워지며, 새로고침은 미승인에서 시작합니다.
- 단계가 무언가를 확정하는 자리라면 그 조작을 단계 레일이 직접 그리고, 사례 열의
  조작과 하나의 처리기·하나의 비활성 상태를 공유합니다. 작업이 사례 본문에서
  일어나는 단계라면 레일의 조작이 그 자리로 스크롤해 초점을 넘깁니다. 단계 목록은
  읽기 위해 이동할 수 있고, 방문자의 작업이 조건을 계속 만족하는 동안에만 완료로
  셉니다
  ([ADR 0026](adr/0026-open-guided-steps-with-intent-and-read-ahead.md)(영문),
  [ADR 0033](adr/0033-lead-each-guided-step-with-its-action.md)(영문)).
- 해시가 어긋나면 원래 기준선을 유지하고 완료를 막으며 다시 시도할 수 있습니다.
  넘겨주기는 사례 표면을 다시 마운트하지 않고 직접 조작을 열어 주므로 메모리에 있는
  승인과 결과가 그대로 유효합니다. 안내 진행 상태는 요청 단위 서버 워크플로와
  별개입니다
  ([ADR 0019](adr/0019-share-guided-and-working-case-replay-state.md)(영문)).
- 안내 원본은 `published-execution-fix44.csv`의 `baseline`입니다. 항목 연결 장에는
  행위자 없는 `published-execution-h0stcnt0.jsonl`을 별도 검토 예시로 넣습니다. 각
  인스턴스는 제안별 승인과 비동기 생성 가드를 따로 가지고, 안내 진행에는 예시 완료
  표시만 넘어가며, 예시의 승인·원본·결과는 사례 요청에 들어가지 않습니다. 서버
  로더는 커밋된 사례 승인 기록을 props로 보내기 전에 제거합니다.
- 고급 조작은 항목 연결 전에 제출 행의 순서를 바꾸거나 연결 뒤 파생 사건 하나를
  복제합니다. 원본 좌표와 값은 그대로입니다
  ([ADR 0020](adr/0020-prepare-source-order-at-the-caller.md)(영문)).

화면은 하나의 경로 집합에서 한국어와 영어로 제공됩니다
([ADR 0041](adr/0041-hold-language-selection-outside-react.md)(영문)).

- 표제와 절 제목, 행동 유도 문구는 각 언어로 씁니다. 단계의 목적, 게이트 설명,
  막는 조건, 한계, 고지는 두 언어에서 같은 범위와 같은 유보로 같은 것을 말합니다.
  한쪽 언어가 다른 쪽이 빠뜨린 기능을 말하거나 계획된 구성요소를 작동하는 것처럼
  보이게 할 수 없고, `apps/web/src/app/i18n/bilingual-parity.test.ts`가 구조로
  확인합니다.
- 계약 어휘는 두 언어에서 한 철자입니다. 픽스처 모드와 합성 원본 고지는 모든
  페이지가 보여 주는 바닥글에 있습니다. 한국어는 커밋된 서체로 조판하고
  ([ADR 0042](adr/0042-commit-a-korean-face-for-the-korean-surface.md)(영문)),
  층위 도식은 현지화된 문구에서 그립니다
  ([ADR 0043](adr/0043-draw-the-layer-diagram-from-localized-copy.md)(영문)).
- `/replay`는 예전 `/lab` 경로를 별칭 없이 대체했습니다.

`/case-2026-09-03`은 커밋된 라이선스 아티팩트 위에 작성한 사례 하나입니다. 2026-09-03의
KOSPI 200 지수와 최근월 선물을, 지수 자신의 2026-07-01 기준선에 견줍니다.

![공개 사례: 범위를 승인해야 서버에서 규칙이 돈다](assets/boundary/published-case-run.svg)

- 규칙이 돌기 전에는 규칙이 만든 것을 보여 주지 않고, 규칙이 낸 값은 페이지 문구에
  적지 않습니다. 결과를 요약하는 마지막 문장은 반환된 분석에서 읽습니다. 해시는
  `apps/web/src/lib/published-case.test.ts`와 엔진 시험이 고정합니다.
- 공개 항목 연결 두 개는 한 번 검토했고, 승인된 아티팩트 해시를 포함한 승인 기록이
  `apps/web/src/lib/published-case-approvals.ts`에 커밋돼 있습니다. 페이지는 그
  연결을 방문자의 승인처럼 제시하지 않고 검토를 마쳤다고 밝힙니다.
- 차트 좌표는 모든 공개 가격을 고정소수 정수로 읽고, 좌표에 필요한 무단위 분수에서
  한 번만 나눕니다. 어떤 가격도 이진 부동소수점에 닿지 않습니다.

## 구성요소 사슬

![두 줄에 걸친 열 개의 구성요소. 커밋된 원본 행은 신뢰하지 않는 입력이고, 제약된 매퍼가 필드 매핑을 제안하고, 검토자가 그 제안을 아티팩트 해시에 묶어 승인하고, 버전이 고정된 코드가 정본 이벤트를 다시 도출하고 결정론적 데이터셋 프로파일을 계산한다. 계획 단계인 한정된 사례 제안기는 프로파일 사실만으로 행위자 그룹과 구간을 고르게 되고, 검토자가 사례 범위를 승인하며, 결정론적 리플레이 엔진이 규칙을 평가하고, 원본 추적이 모든 발견을 커밋된 행까지 되짚으며, 증거 번들 조립과 독립 검증은 원본 바이트에서 선언을 다시 계산한다. 어느 gate든 거부할 수 있고, 거부된 요청에는 결과 해시가 없다](assets/component-chain.ko.svg)

`PLANNED` 구성요소는 계약에 명세돼 있고 열린 작업으로 추적되며, 오늘 구현된 것이
아닙니다.

## 신뢰 경계

### 공개 자료 취득 범위

![두 취득 범위와 그것이 닿지 않는 곳](assets/boundary/acquisition-scopes.svg)

- 수동 수집기는 검토된 발행처 어댑터를 쓰고, 자동 전송 시험은 합성으로 유지합니다.
  오프라인 승인 절차는 커밋된 행과 생성된 원본 좌표, 요청을 원래 페이지 바이트와
  비교합니다.
- [공개 자료 취득 범위](PUBLISHED_ACQUISITION.md)(영문),
  [ADR 0025](adr/0025-distinguish-published-acquisition-scopes.md)(영문),
  [ADR 0030](adr/0030-declare-published-market-family-and-range-scopes.md)(영문)를
  참고하세요.

### 층위 경계

![네 층위와 각 층의 권한, 그리고 어디서나 가능한 거부 경로](assets/boundary/layer-authority.svg)

권한은 위치가 아니라 층위로 나눕니다. README가 모델을 말하고, 각 층위를 무엇이
강제하는지는 이 문서에 있습니다.

| 층위    | 강제하는 곳 | 절대 못 하는 것                              | 남기는 것                                       |
| ------- | ----------- | -------------------------------------------- | ----------------------------------------------- |
| L1 해석 | 해석 경계   | 행 변경, 지표 계산, 결과 소유                | 제안, 항목별 근거, 확신도, 제안 상태            |
| L2 승인 | 승인 경계   | 계산된 결과 수정, `DatasetProfile` 사실 확대 | 제안 해시에 묶인 승인 기록, 이유를 적은 재정의  |
| L3 결정 | 결정 경계   | 모델이 쓴 코드 실행, 승인 범위 밖 읽기       | 엔진·규칙 버전, `canonicalResultHash`           |
| L4 근거 | 근거 경계   | 계보를 되짚을 수 없는 판단 항목 제시         | `eventId`, `rawRowHash`, 그 뒤의 커밋된 원본 행 |

- **한 층이 두 권한을 갖지 않습니다.** 제안하는 층은 승인하지 못하고, 승인하는 층은
  계산하지 못하며, 결정하는 층은 자기 범위를 넓히지 못합니다.
- **결과는 밝힌 조건 아래에서만 참입니다.** 엔진 버전, 규칙 버전, 비교에 쓴 임계값이
  결과와 함께 이동합니다.

### 해석 경계

![공급자 출력은 엄격한 검증을 통과해야 제안이 된다](assets/boundary/interpretation-boundary.svg)

- 사례 재현은 커밋된 `sourceArtifactHash`로 색인한 표에 대해 서버 전용 픽스처
  공급자를 실행합니다. `1.4` 제안은 승인된 데이터셋·거래소 상수와 각 원본 열, 닫힌
  대상 항목, 변환, 확신도, 근거, 제안 상태를 담습니다.
- 화면은 지역 검토자 행동을 명시적으로 제공합니다. 브라우저는 정본 직렬화를 마친
  뒤에만 Web Crypto를 쓰고, 둘 중 하나라도 끝내지 못하면 눈에 보이는 오류로 닫습니다.

### 재현 HTTP 경계

![항목 연결과 재현 엔드포인트, 그 사이 서버 다섯 단계](assets/boundary/replay-pipeline.svg)

- 페이지 준비와 재현은 구성된 공급자를 호출하지 않습니다. 픽스처 사용자는 그대로이고,
  구성된 사용자는 제안을 먼저 요청해 그 정확한 해시를 승인한 뒤 재현 요청에
  `mappingReceipt`를 넣습니다
  ([ADR 0029](adr/0029-bind-configured-mapping-proposals-to-review.md)(영문)).

![세 가지 원본 행 변형과 서버가 하지 않는 것](assets/boundary/row-mutations.svg)

- **제출된 원본 행 순서**는 같은 요청 스냅숏에서 읽습니다. 원본 미리보기는 커밋된
  순서를 유지합니다. 같은 입력을 다시 보내면 새 순열을 뽑지 않고 이전 행을 그대로
  보냅니다. 입력이 바뀌면 표시된 근거와 순서가 무효가 되고, 뒤늦게 도착한 응답은
  그것을 되살릴 수 없으며, 순서만 바꾼 경우 기존 승인은 유지됩니다.
- 이전 방식과의 차이: `shuffle`은 더 이상 서버가 몰래 사건을 회전시키도록 요청하지
  않습니다. 커밋된 순서의 `rows`를 `shuffle`로 보내는 기존 사용자는 그 제출 순서에
  대한 결정론적 결과를 받습니다
  ([ADR 0020](adr/0020-prepare-source-order-at-the-caller.md)(영문)).

![어느 단계가 실패하면 어떤 검토 상태가 되는가](assets/boundary/review-responses.svg)

- 실패한 실행 단계가 상태를 직접 고릅니다. `APPROVAL_RECORD_REQUIRED`처럼 공유되는
  문제 코드를 문자열로 다시 분류하지 않으며, 응답 계약은 선택된 단계와 맞지 않는
  코드를 거부합니다.
- 프로파일 실패는 `CANONICAL_DATASET_HASH_MISMATCH`,
  `INSTRUMENT_OUTSIDE_DATASET_PROFILE`, `ACTOR_OUTSIDE_DATASET_PROFILE`,
  `TIME_WINDOW_OUTSIDE_DATASET_PROFILE`를 쓰고, 규칙 설정이 없으면
  `RULE_CONFIGURATION_REQUIRED`를 씁니다.
- 검토 문제의 경로는 **제출한 JSON 요청 본문**에 대한 구조 배열입니다. 문자열 조각은
  객체 키 그대로이고, 숫자 조각은 0부터 시작하는 배열 인덱스이며, `["rows", i]`는
  제출 위치 `i`를 가리키고 좌표의 `rowNumber`를 가리키지 않습니다. 없는 값은 가장
  가까운 상위 컨테이너를 가리키고, `[]`는 본문 전체를 뜻하며 `INVALID_JSON`으로 파싱이
  안 된 경우도 포함합니다.

| 실패                          | 요청 경로                                              |
| ----------------------------- | ------------------------------------------------------ |
| 제출 행 `i`의 가격 변경       | `["rows", i, "values", "px"]`                          |
| 행 `i`의 행위자 열 누락       | `["rows", i, "values"]`                                |
| 선언된 행 누락                | `["rows"]`                                             |
| 행 `i`의 다른 아티팩트        | `["rows", i, "coordinate", "sourceArtifactHash"]`      |
| 필요한 항목 연결 재정의       | `["mappingApproval", "overrides"]`                     |
| 항목 연결 승인 누락           | `[]`                                                   |
| 사례 승인 해시 불일치         | `["caseManifest", "approval", "approvedArtifactHash"]` |
| `1.3` 사례의 프로파일 밖 종목 | `["caseManifest", "hypothesis", "instrumentId"]`       |
| 규칙 설정 누락 또는 중복      | `["caseManifest", "rules"]`                            |

- 원본 아티팩트 해시, 행 번호, 없는 열 이름, 필요한 제안 항목 경로는 사람이 읽는
  메시지의 맥락이며 경로 조각이 아닙니다. 메시지는 사람의 검토를 위한 것이고 기계가
  읽는 규약이 아닙니다. 중복·충돌하는 행 집합은 `["rows"]`를, 서버가 소유한 항목
  연결의 구조 실패는 `["mappingApproval"]`을 가리킵니다.
- **사용자 이전 안내:** 경로 조각을 제출 본문에 그대로 적용하세요. 행 번호 조회, 점
  구분 문자열 쪼개기, 숫자 문자열 변환, 예전 `fields`·`caseApproval` 뿌리에 대한 처리는
  없애야 합니다. 여러 누락이 같은 상위 경로를 공유할 수 있으므로 각 문제와 메시지를
  모두 유지하세요. 승인 기록의 `overrides[].fieldPath`는 제안 기준 `fields.n` 주소를
  그대로 씁니다. 응답에는 버전 항목이 없고, 이 정정은 승인 산출물, 엔진 버전, 워크플로
  상태, HTTP 상태, 규칙 판정, 결과 해시를 바꾸지 않습니다
  ([ADR 0016](adr/0016-use-request-relative-review-paths.md)(영문)).

성공 응답은 계약 검증을 통과하며, 실제 공급자 모드(`fixture` 또는 `ai`), 시나리오,
변형, 경계 문구, 최종 `workflowState`, 엔진 버전, 사건 수, 순서가 있는 사건 식별자,
정본 결과 해시를 담습니다.

![원본 추적 항목 하나가 담는 것](assets/boundary/source-trace.svg)

- 승인과 원본 검증, 재현이 모두 성공한 뒤 `buildFindingSourceTrace`가 반환된 정규
  사건을 신뢰된 커밋 행에 대해 `deriveRawRowHash`로 해결합니다. 이 해시는 좌표와 값을
  함께 해싱하며, 항목 연결도 규칙 평가도 다시 하지 않습니다. 연결이 없거나 모호하면
  내부 서버 오류이며, 부분 추적이나 금융적 `INCONCLUSIVE`가 되지 않습니다.
- 기존 `scenario` 항목이 이 단일 아티팩트 경계에서 아티팩트를 가리킵니다. 내부 사건
  배열은 `replay.events`에서 계속 제외되고, `receivedAt`은 사건 표시에서 제외되지만 그
  원본 문자열은 원시 열 값에 나타날 수 있습니다.
- 사례 재현 화면은 실패한 게이트까지 게이트마다 기본 공개 영역을 제공하며, 정규 사건과
  해시, 좌표, 원문을 함께 보여 줍니다. 브라우저는 서버가 해결한 항목을 고를 뿐 근거를
  스스로 만들지 않습니다. 입력이나 승인을 바꾸면 이전 근거가 지워지고, 뒤늦게 도착한
  요청은 현재 결과를 대체할 수 없습니다.

#### 추적 응답 이전

- 성공한 `REPLAYED` 응답을 엄격하게 소비하는 쪽은 버전이 붙은 `sourceTrace` 항목을
  받아들이고 판단 항목 참조 집합을 정확히 검증해야 합니다. 새로 만들어지는 사례
  응답에서 이 항목은 선택이 아닙니다.
- 기반 응답과 검토 응답의 모양은 그대로입니다. 이 투영과 그 버전은
  `canonicalResultHash`와 승인 산출물 밖에 있고, 엔진·규칙 버전과 세 규칙 결과, 의미
  해시는 바뀌지 않습니다.
- 추적 확인과 엔진 패키지의 번들 조립·독립 검증은 구현돼 있고, 브라우저 내보내기
  화면은 계획으로 남아 있습니다
  ([ADR 0017](adr/0017-resolve-finding-source-traces-on-the-server.md)(영문)).

### 승인 경계

![실행되는 승인 상태기계](assets/boundary/approval-states.svg)

- 경로는 요청 단위 워크플로를 `UPLOADED`에서 만들고 모든 상태 변화를 계약 패키지의
  `applyTransition`으로 보냅니다. 합법 전이 표는 계약이 소유하며 나머지 전이는 모두
  거부하고 현재 상태를 그대로 둡니다. 재현 전 어느 상태든 `INPUT_REVIEW_REQUIRED`로
  들어갈 수 있고, 입력 충돌을 해결하면 새 요청과 `UPLOADED`의 새 워크플로가
  시작됩니다. 워크플로와 전이 이력은 요청을 넘겨 저장하거나 연결하지 않습니다
  ([ADR 0014](adr/0014-keep-replay-workflows-request-local.md)(영문)).
- 재현에는 제안된 산출물의 해시에 묶인 항목 연결 승인과 사례 승인이 각각 필요합니다.
  표시된 항목이나 정확히 일치하지 않는 항목에는 이유를 적은 검토 재정의가 더
  필요합니다.

![사례 검증은 데이터셋 프로파일 안에 머문다](assets/boundary/dataset-profile.svg)

- 직접 프로파일 검증기는 `1.4` 종목을
  `["hypothesis", "instrumentIds", i]`로 보고합니다. 행위자를 담은 프로파일에 대해
  행위자 없는 `1.4` 가설이 오면 `["hypothesis", "actorIds"]`로 보고해, 빈 선언의 뜻을
  참여자 신원을 제공하지 않는 원본에 묶어 둡니다. 이 엔진 기준 경로는 요청 계약이
  버전 있는 매니페스트 합집합을 받아들일 때까지 HTTP 요청 경로가 아닙니다.

### 결정 경계

![재현 엔진이 소유하는 것과 절대 하지 않는 것](assets/boundary/decision-boundary.svg)

### 근거 경계

![판단 항목에서 원본 행까지의 계보와 각 해시의 범위](assets/boundary/evidence-scopes.svg)

- 판단 항목은 정규 `eventId`를 가리키고, 그 사건은 `sourceEventId`와 `rawRowHash`를
  유지해 검토자가 원본 행까지 갈 수 있게 합니다. 커밋된 합성 픽스처는 그 식별자를
  손으로 적은 자리표시자가 아니라 정확한 원본 아티팩트 바이트와 원시 행에서
  만듭니다.
- 감사 메타데이터는 의미 결과 해시를 바꾸지 않고 번들 해시만 바꿀 수 있습니다.

### 증거 번들 1.2 이전

`EvidenceBundleSchema` `1.2`는 Rapid Price Lift 규칙 결과의 엄격한 `sensitivity`
객체를 재사용합니다. `1.1` 입력과 삭제된 항목, 섞인 모양, 모르는 키는 거부하며,
별칭이나 강제 변환, 자동 변환기는 없습니다.

| 이전 1.1 경로                              | 새 1.2 경로                                       |
| ------------------------------------------ | ------------------------------------------------- |
| `counterfactual`                           | `sensitivity`                                     |
| `counterfactual.originalPriceChangeBps`    | `sensitivity.priceChangeBps`                      |
| `counterfactual.withoutSuspectedActorsBps` | `sensitivity.priceChangeBpsWithoutApprovedActors` |
| `counterfactual.attributableDifferenceBps` | `sensitivity.removalSensitivityBps`               |

- 새 모양은 `bundleVersion: "1.2"`와
  `sensitivity.comparison: "MECHANICAL_METRIC_COMPARISON"`을 요구합니다. 지표는 공유
  부호 십진 문자열 검증을 유지하고, 이 변경은 십진 정규화나 산술 검사를 더하지
  않습니다.
- 이 비교는 승인된 행위자 집합을 기계적으로 제거해 지표 차이를 보고합니다. 귀속이나
  유죄, 인과를 세우지 않으며, 스키마 검증은 모양을 확인할 뿐 지표를 다시 계산했다거나
  근거가 진본이라는 것을 확인하지 않습니다.
- 런타임 재현 동작은 그대로입니다. 1.2 계약에는 조립기도 독립 검증기도 없고
  `sensitivity` 객체를 계속 요구하는데, 실행되는 규칙 결과는 `INCONCLUSIVE`에 `null`을
  씁니다. 선택 계약 1.3이 이 어긋남을 해소합니다. 계약 회귀 시험
  [`evidence-bundle.test.ts`](../packages/contracts/src/evidence-bundle.test.ts)가
  예시 합성 입력으로 이 경계를 확인합니다.

### 증거 번들 1.3 해시 범위

![증거 번들 1.3이 선언·조립·검증하는 것](assets/boundary/bundle-13.svg)

- 원래의 FSC 일별 시세 아티팩트는 결과 해시는 있고 평가나 사례 매니페스트는 없는
  `MAPPING_APPROVED`에서 끝납니다. 번들 `1.3`은 Event 1.1–1.3, Proposal 1.4–1.8,
  Manifest 1.3에 대해 정의되며, 해싱은 그중 무엇도 변환하지 않고 없는 항목을 만들지
  않습니다.
- 검증은 검토자도 발행처도 인증하지 않으며 서명이 아닙니다.
- 규범적 원상, 보호·제외 항목 전체 표, 정본 직렬화와 이전 안내는
  [증거 해시 범위](EVIDENCE_HASH_SCOPES.md)(영문)에 있고 결정은
  [ADR 0024](adr/0024-define-evidence-hash-scopes.md)(영문)입니다. 스키마와 직렬화
  적용 범위 시험이 둘의 일치를 강제합니다.

## 패키지 경계

| 패키지           | 소유하는 것                                             | 소유하면 안 되는 것              |
| ---------------- | ------------------------------------------------------- | -------------------------------- |
| `contracts`      | 버전 있는 스키마와 닫힌 어휘                            | 공급자 호출이나 판정 논리        |
| `ai-harness`     | 공급자 어댑터, 구조화된 제안, 결정론적 픽스처           | 최종 계산이나 자동 승인          |
| `replay-engine`  | 정본화, 규칙, 해시, 증거 조립                           | 자유로운 추론이나 법적 결론      |
| `scenarios`      | 합성 데이터셋과 통제된 변형                             | 공개·운영·개인 자료              |
| `published-data` | 라이선스가 확인된 공개 아티팩트, 출처, 선언된 항목 연결 | 합성 변형이나 제한된 자료        |
| `service-store`  | 수집한 불변 스냅숏과 파생 결과의 입력 결속              | 규칙·판정이나 수집되지 않은 입력 |
| `evals`          | 버전 있는 사례와 측정 집계                              | 문서화되지 않은 성능 주장        |
| `web`            | 사람의 검토 흐름과 내보내기 화면                        | 재현 논리의 두 번째 구현         |

### 의존 방향

![층위별 워크스페이스 의존 간선 전부](assets/boundary/dependency-direction.svg)

지금 존재하는 워크스페이스 간선 전부입니다. 앞의 숫자가 그 패키지의 층이고, 화살표는
가져다 쓰는 쪽에서 가져다 쓰이는 쪽으로 향하며, 줄표는 워크스페이스 의존이 없다는
뜻입니다. 구성요소가 늘어도 그래프가 유한하게 유지되는 규칙은 넷입니다.

1. **모든 간선은 아래 층으로 향합니다.** 같은 층끼리도, 위쪽으로도 향하지 않으며
   순환이 없습니다. 기록은 워크스페이스 매니페스트와 `pnpm typecheck`이고, 어떤
   패키지도 다른 패키지의 내부 경로를 가져다 쓰지 않습니다.
2. **결정 층은 입력을 인수로 받습니다.** 규칙과 검증기, 증거 조립은 원본 행, 등록표,
   계산기, 표시 틀을 호출자에게서 받고 저장소나 URL, 시계, 공급자를 스스로 찾지
   않습니다. 그래서 새 원천이나 새 저장 방식이 기존 간선을 뒤집지 못합니다.
3. **저장은 결정 층에 의존하지 않습니다.** 지금 이 선을 넘는 간선이 하나 있습니다.
   정본화 커널(정본 JSON, 해시, 순서, 고정소수 연산)이 규칙과 요청 워크플로 옆에 있기
   때문입니다. `service-store`는 런타임 중립 진입점
   `@weavetrail/replay-engine/canonical-json`으로만 접근하므로 직렬화 외에는 가져다
   쓰는 것이 없고, 규칙·임계값·가설·판정 타입은 저장에서 닿지 않습니다. 매니페스트의
   간선은 커널이 자기 자리를 가질 때까지 남습니다
   ([#211](https://github.com/WeaveTrail/WeaveTrail/issues/211)).
4. **픽스처는 결정 층의 시험 입력이며 런타임 입력이 아닙니다.** `scenarios`와
   `published-data`는 `replay-engine`의 개발 의존성입니다. `ai-harness`는 픽스처 모드가
   시험 보조가 아니라 배포되는 공급자이므로 런타임에 둘에 의존합니다.

| 계획된 구성요소                                                                                                                                                                                                      | 층      | 닿으면 안 되는 곳 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------- |
| 수집 ([#179](https://github.com/WeaveTrail/WeaveTrail/issues/179)–[#181](https://github.com/WeaveTrail/WeaveTrail/issues/181))                                                                                       | 저장 위 | 규칙              |
| 문서 파싱 ([#182](https://github.com/WeaveTrail/WeaveTrail/issues/182))                                                                                                                                              | 해석    | 저장, web         |
| 사건 구조화 ([#184](https://github.com/WeaveTrail/WeaveTrail/issues/184))                                                                                                                                            | 해석    | 규칙              |
| 종목 연결 ([#185](https://github.com/WeaveTrail/WeaveTrail/issues/185))                                                                                                                                              | 해석    | web               |
| 결론 ([#186](https://github.com/WeaveTrail/WeaveTrail/issues/186)), 피드 통계 ([#187](https://github.com/WeaveTrail/WeaveTrail/issues/187)), 주장 확인 ([#154](https://github.com/WeaveTrail/WeaveTrail/issues/154)) | 결정    | 저장              |
| 브리프와 공유 링크 ([#159](https://github.com/WeaveTrail/WeaveTrail/issues/159))                                                                                                                                     | 표현    | —                 |

해석된 스냅숏을 규칙에 넘기는 일은 애플리케이션이 하며, 규칙이 스냅숏을 직접 가져오지
않습니다. 각 구성요소가 어느 패키지에 놓이는지는 수집 작업을 시작하기 전에
[#212](https://github.com/WeaveTrail/WeaveTrail/issues/212)에서 정합니다. 그래서 위
그래프는 끝까지 그릴 수 있는 상태로 남습니다.

## 결정성 계약

![커밋된 원본 행에서 정본 결과 해시까지](assets/boundary/determinism-pipeline.svg)

검증된 하나의 데이터셋과 승인된 매니페스트에 대해 다음이 성립합니다.

- 같은 뜻의 `Z` 표기와 명시적 오프셋 표기는 같은 사건 시각으로 정규화되고, 순번이 있는
  행과 없는 행이 섞인 데이터셋은 재현 전에 닫힙니다.
- 정본 데이터셋 해시와 결과 해시는 명시된 의미 사건 투영을 덮고 수집 메타데이터
  (`receivedAt`, `rawRowHash`)를 제외합니다.
- 승인된 CSV와 JSON Lines 표현이 같은 뜻이면 같은 `canonicalDatasetHash`와 결과로
  수렴하면서 아티팩트 해시와 행 해시는 서로 다르게 유지합니다.
- 검증된 가격·수량 문자열은 의미 없는 소수점 0을 없애고 부호 있는 0을 정규화한 뒤
  중복을 비교하거나 해싱합니다.
- 유한한 JSON 수는 브라우저 승인과 서버 검증이 공유하는 런타임 중립 직렬화기를 씁니다.
- `canonicalResultHash`는 엔진 버전과 정규 사건을 담고, 평가가 있으면 규칙 결과와 판단
  항목, 민감도를 함께 담습니다. 그 원상에는 판단 항목의 게이트, 비교 불가 사건 수,
  `INCONCLUSIVE` 이유까지 평가 전체가 들어가지만 항목 연결·매니페스트·승인 해시는
  없으므로, 결과 해시만으로는 사례 범위가 묶이지 않습니다.
- 응답의 `workflowState`는 `canonicalResultHash` 입력 밖에 있습니다.

결과 해싱과 번들 해싱은 모두 키를 UTF-16 코드 단위로 재귀 정렬하고, 정의되지 않은
속성을 빼고, 유한하지 않은 수를 거부하고, 배열 순서를 지키며, 줄바꿈 없는 UTF-8 정본
JSON을 해싱합니다. JCS 완전 준수는 주장하지 않습니다. 엔진 버전은
`0.7.0-canonical-decimal`이고 기존 문자열 골든은 그대로입니다. 범위 표 전체는
[증거 해시 범위](EVIDENCE_HASH_SCOPES.md)(영문)에 있습니다.

오늘 시험이 있는 것: 고정 정밀도 시각 정규화, 로케일에 무관한 순서, 순번 혼재 거부,
커밋된 네 사건 픽스처의 모든 순열, 충돌에 안전한 중복 처리, 정규 식별자 유일성과 충돌
선택, 정본 십진 표기, 정규 사건 투영, 커밋된 문자열 골든 해시, 원본 아티팩트·원시
행·사건 ID·정본 데이터셋·데이터셋 프로파일 도출, 프로파일로 제한된 사례, 워크플로 전이,
승인으로 막은 재현, 정확한 금융 산술, 선언된 세 시나리오 결과.
[ADR 0003](adr/0003-use-nanosecond-utc-and-code-unit-ordering.md)(영문)에 시각 표현과
입력 한계가, [ADR 0004](adr/0004-protect-semantic-events-and-reject-identity-conflicts.md)(영문)에
식별과 투영 범위가,
[ADR 0009](adr/0009-use-exact-rapid-price-lift-rules-and-explicit-abstention.md)(영문)에
규칙 식과 판단 보류 경계가 있습니다.

## 출처 계약 이전

![산출물 버전마다 어떤 해시 이름을 쓰는가](assets/boundary/provenance-hashes.svg)

해시 이름은 맥락에 기대지 않고 하나의 경계를 가리킵니다. 도출과 이전 규칙은
[ADR 0005](adr/0005-derive-source-provenance.md)(영문)를 참고하세요.

## 승인 계약 이전

![승인 산출물 버전이 각각 선언하는 것](assets/boundary/approval-versions.svg)

- 기존 `1.3` 산출물은 이전 없이 그대로 유효하고, 두 산출물 모두 JSON 수에 공유 RFC 8785
  규칙을 씁니다. 대체된 산출물은 거부되며 이전과 재승인이 필요하고, 오래된 산출물은
  원래 버전을 유지한 채 명시적으로 이전합니다.
- [ADR 0006](adr/0006-enforce-approval-provenance-before-replay.md)(영문),
  [ADR 0007](adr/0007-bind-approved-mapping-to-replay.md)(영문),
  [ADR 0011](adr/0011-use-rfc-8785-number-serialization.md)(영문), 십진 문자열 정규화와
  그 버전 이전은 [ADR 0013](adr/0013-normalize-canonical-decimal-strings.md)(영문),
  매니페스트 공존과 종목별 검증은
  [ADR 0027](adr/0027-coexist-with-actorless-multi-instrument-manifests.md)(영문)를
  참고하세요.

## 배포 경계

![배포가 돌리는 것과 서비스 층에 아직 필요한 것](assets/boundary/deployment-boundary.svg)

[ADR 0046](adr/0046-retain-public-sources-in-two-provenance-tiers.md)(영문)과
[서비스 스냅숏 운영](SERVICE_SNAPSHOTS.md)(영문)을 참고하세요.

## 표현 경계

![여덟 개의 공개 경로: /, /why, /architecture, /methodology, /evals, /expectations, 안내와 직접 조작의 /replay, /case-2026-09-03](assets/boundary/public-routes.svg)

- 여덟 개의 공개 경로는 제품 안에 둔 페이퍼 우선 디자인 토큰과 원본 브랜드 마크의
  스냅숏을 쓰며, `WeaveTrail/design-reference` 리비전
  `3f078da1970e8accd83fbdde73308a2a24d0d1f8`에 고정되어 있습니다. 디자인 저장소는
  빌드나 런타임 의존성이 아닙니다.
- 제품 문구와 눈에 보이는 모든 근거 값은 이 저장소의 런타임 응답과 커밋된 합성
  시나리오가 소유합니다
  ([ADR 0015](adr/0015-apply-the-canonical-design-reference.md)(영문)).

## 일별 시세와 교차시장 규칙 버전의 공존

![일별 시세 버전이 레지스트리에서 공존하는 방식](assets/boundary/daily-quote-versions.svg)

공개된 FSC KOSPI 일별 아티팩트는 사례 매니페스트 없이 등록돼 있습니다.
[일별 시세 정규화](DAILY_QUOTES.ko.md),
[ADR 0022](adr/0022-normalize-daily-quotes-with-version-coexistence.md)(영문),
[ADR 0031](adr/0031-compose-publisher-source-identities-in-mapping-1.6.md)(영문)을
참고하세요.

![별도의 교차시장 진입점과 그것이 받아들이는 것](assets/boundary/cross-market-entry.svg)

CROSS_MARKET_SESSION_REVERSAL `1.1`은 또 하나의 선택 규칙 계약입니다
([ADR 0032](adr/0032-evaluate-declared-cross-market-session-reversals.md)(영문)).

![교차시장 1.1이 결론을 낼 때 보고하는 것](assets/boundary/denominator-substitution.svg)

- `1.0`은 기존 엔진 버전과 해시로 계속 받아들입니다. 엄격한 사용자는 `1.1`을 택해 모든
  구간에 분모 선언을 더하고 버전 있는 민감도 분기를 받아들입니다. 기본값이나 변환은
  제공하지 않습니다.
- 승인된 다른 분모를 고르면 사례 매니페스트 승인 원상과 정본 엔진 결과가 바뀌고, 정규
  원본 사건은 그대로입니다
  ([ADR 0035](adr/0035-bind-denominator-substitution-to-the-approved-rule.md)(영문)).

## 공개 체결 스키마 항목 연결 지원

![항목 연결 제안 1.8이 고정·변환하고 만들어 내지 않는 것](assets/boundary/execution-schema-mapping.svg)

- [ADR 0036](adr/0036-normalize-published-execution-schema-projections.md)(영문)과
  옆에 둔
  [FIX](../packages/scenarios/src/sources/published-execution-fix44.provenance.json),
  [H0STCNT0](../packages/scenarios/src/sources/published-execution-h0stcnt0.provenance.json)
  원본 기록을 참고하세요.
- 커밋된 모든 재현 원본에는 기계가 읽는 출처 기록이 하나씩 있습니다. 합성 기록은 정확한
  픽스처 바이트를 가리키며 저장소가 작성한 항목과 공개 스키마 투영을 구분하고,
  라이선스가 확인된 실제 기록은 취득·허가·도출 내용을 유지합니다.
- 표시 전용 `SourceProvenance.recordUrl`은 원본 행 패널에서 그 기록에 닿고 승인과 정본
  해시 입력 밖에 있습니다. 적용 범위와 해시 검사는 원본을 소유한 두 패키지를 모두
  덮습니다
  ([ADR 0037](adr/0037-record-every-replay-source-with-adjacent-provenance.md)(영문)).
