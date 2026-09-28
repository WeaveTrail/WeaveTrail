# 데이터 처리

영문 문서가 기준입니다. [English](DATA_HANDLING.md)

조직의 보안·준법 검토자가 직원의 확인 기능 사용 여부를 판단할 때 읽는
문서입니다. 브라우저 밖으로 나가는 내용, 서버가 그 내용으로 하는 일, 보관
대상과 기간, 그리고 각 설명을 강제하는 파일이나 테스트를 적습니다. 이 저장소
리비전의 동작을 설명하며, 예정된 작업은 예정이라고 표시하고 이슈를 연결합니다.

## 한눈에 보기

| 질문                                  | 현재                                                                                                                | 강제하는 곳                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 붙여넣은 텍스트를 받는 경로가 있나요? | 없습니다. 유일한 확인 경로는 자유 텍스트가 아닌 정해진 형식의 범위를 받습니다. 붙여넣은 글 확인은 예정입니다.       | [`api/check/coverage/route.ts`](../apps/web/src/app/api/check/coverage/route.ts), [`ClaimCoverageRequestSchema`](../packages/contracts/src/coverage.ts) |
| 확인 요청을 저장하나요?               | 저장하지 않습니다. 확인 경로는 저장소, 데이터베이스, 파일 쓰기 모듈을 불러오지 않습니다.                            | [`pasted-text-retention.test.ts`](../apps/web/src/app/api/check/pasted-text-retention.test.ts)                                                          |
| 확인 요청을 로그에 남기나요?          | 애플리케이션은 확인 요청의 내용을 로그, 출력 스트림, 파일에 쓰지 않습니다. 호스팅 플랫폼 로그는 코드 밖에 있습니다. | [`pasted-text-retention.test.ts`](../apps/web/src/app/api/check/pasted-text-retention.test.ts)                                                          |
| 확인할 때 모델을 호출하나요?          | 호출하지 않습니다. 확인 경로는 모델 공급자를 불러오지 않고 외부로 요청을 보내지 않습니다.                           | [`pasted-text-retention.test.ts`](../apps/web/src/app/api/check/pasted-text-retention.test.ts)                                                          |
| 브라우저는 데이터를 어디로 보내나요?  | 이 사이트의 `/api/` 경로로만 보냅니다.                                                                              | [`browser-data-boundary.test.ts`](../apps/web/src/app/browser-data-boundary.test.ts)                                                                    |
| 브라우저에는 무엇이 남나요?           | 언어 선택 하나를 `localStorage` 키 하나에 남깁니다.                                                                 | [`browser-data-boundary.test.ts`](../apps/web/src/app/browser-data-boundary.test.ts), [`language.tsx`](../apps/web/src/app/i18n/language.tsx)           |
| 모델 인증 정보가 드러나나요?          | 드러나지 않습니다. 공급자 설정은 서버에서만 읽고, 운영 환경에는 설정하지 않습니다.                                  | [`provider-client-boundary.test.ts`](../apps/web/src/app/provider-client-boundary.test.ts), [배포 환경](DEPLOYMENT.md#environment)(영문)                |
| 공유 링크는 값을 어떻게 담나요?       | 예정: URL 조각에 담고, 붙여넣은 글을 서버에 저장하지 않습니다.                                                      | [#159](https://github.com/WeaveTrail/WeaveTrail/issues/159), [ADR 0050](adr/0050-place-planned-service-components.md)(영문)                             |

## 확인 요청의 경로

`/api/check` 아래 경로는 `POST /api/check/coverage` 하나입니다. 이 경로는 정규
종목 식별자, 시작일과 종료일, 공시 항목, 시간 해상도, 그리고 선택 사항인 정의
식별자와 버전으로 이루어진 JSON 범위를 받습니다.
[경로 코드](../apps/web/src/app/api/check/coverage/route.ts)는 추가 항목을
허용하지 않는 [`ClaimCoverageRequestSchema`](../packages/contracts/src/coverage.ts)로
요청을 검증합니다. 정의되지 않은 항목, 형식이 잘못된 본문, 잘못된 JSON은 더
처리하지 않고 HTTP 422 `REVIEW_REQUIRED`로 돌려보냅니다
([`route.test.ts`](../apps/web/src/app/api/check/coverage/route.test.ts)).

검증을 통과한 범위는
[`checkPublishedClaimCoverage`](../apps/web/src/lib/published-claim-coverage.ts)가
서버 시작 시 커밋된 파일에서 만든 조회 범위와 비교합니다
([공개 데이터 조회 범위](COVERAGE.md)(영문)). 응답에는 검증된 범위, 정해진 사유
코드, 한국어와 영어 설명이 담겨 요청자에게만 돌아갑니다. 외부에서 가져오는
자료는 없고, 응답을 보내면 요청은 버려집니다. 아직 이 경로를 호출하는 화면은
없습니다.

붙여넣은 글에서 주장을 뽑아내는 기능
([#155](https://github.com/WeaveTrail/WeaveTrail/issues/155)), 그 주장을 확인하는
기능([#154](https://github.com/WeaveTrail/WeaveTrail/issues/154)), 문장별 확인
화면([#157](https://github.com/WeaveTrail/WeaveTrail/issues/157))은 예정입니다.

## 모델 호출

확인 경로는 모델을 호출하지 않습니다.
[`pasted-text-retention.test.ts`](../apps/web/src/app/api/check/pasted-text-retention.test.ts)는
확인 경로가 불러오는 모든 모듈을 따라가며, 모델 공급자 패키지에서 온 모듈이
있거나 `fetch`를 호출하는 코드가 있으면 실패합니다. 실행 중에 외부로 요청을
보내도 실패합니다.

모델을 호출할 수 있는 경로는 직접 조작 화면의 데이터 항목 연결에 쓰는
`/api/mapping` 하나입니다. 이 경로는 커밋된 합성 자료의 이름만 받고, 사람이
입력한 글은 받지 않습니다
([`mapping/route.ts`](../apps/web/src/app/api/mapping/route.ts),
[`mapping-provider.ts`](../apps/web/src/lib/mapping-provider.ts)). 운영 환경은
공급자 설정 없이 픽스처 모드로 동작하며, 설정 값은 브라우저로 전달되지
않습니다([배포 환경](DEPLOYMENT.md#environment)(영문),
[`provider-client-boundary.test.ts`](../apps/web/src/app/provider-client-boundary.test.ts)).

예정된 붙여넣은 글 분석은 글을 모델 공급자에게 보냅니다
([#155](https://github.com/WeaveTrail/WeaveTrail/issues/155)). 그 한도는
[#231](https://github.com/WeaveTrail/WeaveTrail/issues/231)에서 정합니다. 확인
경로에 공급자를 추가하면 허용 목록과 이 문서를 함께 고치기 전까지 보관 금지
테스트가 실패합니다.

## 보관

확인 요청은 어디에도 보관하지 않습니다. 배포 환경에는 데이터베이스가
없습니다([배포](DEPLOYMENT.md)(영문)). 보관 금지 테스트는 확인 경로가 서비스
스냅샷 저장소, 파일 시스템, 또는 허용 목록(`zod`, `node:crypto`, `next/server`)
밖의 패키지를 불러오면 실패하고, 경로를 호출하는 동안 파일에 쓰기가 일어나도
실패합니다. 서비스 스냅샷 저장소는 승인된 공개 자료의 원본만 담고, 배포 환경에
연결되어 있지 않으며, 확인 경로에서 닿지 않습니다
([서비스 스냅샷](SERVICE_SNAPSHOTS.md)(영문)).

브라우저에서는 사이트 코드가 언어 선택만 `localStorage` 키
`weavetrail.language`에 저장합니다
([`browser-data-boundary.test.ts`](../apps/web/src/app/browser-data-boundary.test.ts)).

## 로그

확인 경로에는 `console`, `process.stdout`, `process.stderr` 호출이나 파일 쓰기가
없고, 경로가 불러오는 모듈에도 없습니다. 보관 금지 테스트는 소스에서 이를
확인한 뒤, 자유 텍스트 항목마다 표식 문자열을 넣어 각 경로를 호출하고 그
표식이 콘솔, 표준 출력, 표준 오류에 나타나면 실패합니다.

호스팅 플랫폼은 경로, 상태 코드, 시각 같은 요청 기록을 호스팅 계정의 보관
설정에 따라 따로 남깁니다. 그 설정은 이 저장소에 없으므로 소스로는 확인할 수
없습니다. 운영자에게 확인하십시오.

## 공유 링크

예정입니다. 공유 링크는 값을 URL 조각(`#` 뒤 부분)에 담습니다. 브라우저는 이
부분을 서버로 보내지 않습니다. 링크를 다시 열면 고정된 커밋 아티팩트를 찾아
엔진을 다시 실행하며, 붙여넣은 글은 서버에 저장하지 않습니다
([#159](https://github.com/WeaveTrail/WeaveTrail/issues/159),
[ADR 0050](adr/0050-place-planned-service-components.md)(영문)). 수집한 서비스
스냅샷의 공유는 별도의 예정 작업입니다
([#237](https://github.com/WeaveTrail/WeaveTrail/issues/237)).

## 검증

```bash
pnpm exec vitest run apps/web/src/app/api/check/pasted-text-retention.test.ts apps/web/src/app/api/check/coverage/route.test.ts apps/web/src/app/browser-data-boundary.test.ts apps/web/src/app/provider-client-boundary.test.ts
```

`apps/web/src/app/api/check` 아래 경로 파일은 모두 자동으로 찾습니다. 새 확인
경로는 표식 요청을 추가하기 전까지 보관 금지 테스트를 통과하지 못합니다.

## 한계

- 테스트는 이 저장소의 소스를 확인합니다. 배포된 빌드나 호스팅 계정은 확인하지
  않습니다.
- 소스 확인은 호출 형태를 대조합니다. 그 형태를 피하는 간접 호출은 테스트가
  보내는 표식 요청에 한해 실행 중에만 잡힙니다.
- 사용자와 사이트 사이의 브라우저 확장, 네트워크, 기기는 사이트 코드 밖에
  있습니다.
