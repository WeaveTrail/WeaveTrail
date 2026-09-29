# 공개 데이터 조회 범위

영문 문서가 기준입니다. [English](COVERAGE.md)

`GET /api/coverage`는 버전 `1.0`의 `CoverageManifestSchema`를 반환합니다.
`packages/published-data/src/coverage.ts`가 커밋된 취득 기록, 인접 출처 기록과
승인된 원본 행에서 `published-coverage-v1` 규칙으로 자동 생성합니다.
수정할 생성 파일은 없으며 현재 URL을 다시 조회하지 않습니다. 범위를 늘리려면
표시 문구를 바꾸는 대신 [취득 규칙](PUBLISHED_ACQUISITION.md)(영문)에 따라 자료를
추가해야 합니다.

[2026-09-29 반입 검토](PUBLISHED_DATA_ADMISSION.ko.md)는 전체 주식 시세, 더 긴
주요 지수 기간, 만기 일정과 투자자별 집계의 미지원 사유를 기록합니다.
현재 이용 조건 때문에 새 반입이 막혀 있으며, 구조화 요청의 재현 가능한
기준 평가와 기존 자료 크기를 공개합니다. 이 검토로 조회 범위가 늘어나지 않습니다.

데이터셋마다 식별자, 취득 기록과 범위, 종목군, 원본 항목, 시작일과 종료일을
포함한 날짜 범위, 시간 해상도, 원본 파일과 응답 바이트의 해시, 제공자, 출처
URL, 이용허락, 출처 표시 및 수집 시각을 기록합니다. 실제 관측된 종목 식별자,
날짜와 원본 행 번호도 포함합니다. 종목군이나 날짜 범위의 선언만으로 모든
종목과 날짜가 존재한다고 보지 않습니다. 주식 자료는 수집된 40행으로 제한되며,
완전 계열 자료도 선언한 종목군 안에서만 조회합니다. 현재 조회 자료는 모두
일별 시세입니다. 화면 설명용 차트와 합성 시나리오는 이 범위에 포함하지 않습니다.

`asOf`는 기록된 수집 시각 중 가장 최신 값입니다. 현재 시각이나 최신 거래일,
자료의 최신성을 보장하는 값이 아닙니다. 개별 자료의 이전 수집 시각도 유지합니다.
이벤트 페이지(`/case-2026-09-03`)의 승인·실행 화면 앞과 Case Replay 결과 패널
위에 같은 범위를 한국어와 영어로 표시합니다. 상세 링크는 API의 매니페스트를 엽니다.

## 주장 조회 경계

`replay-engine`의 `resolveClaimCoverage(request, manifest, definitions)`는
전달된 매니페스트만으로 조회 가능 여부를 결정합니다. 카탈로그, 제공자, URL이나
저장소에서 추가 자료를 찾아 우회하지 않습니다. 입력은 이미 해석된 종목 식별자,
양 끝 날짜를 포함하는 범위, 원본 항목, `DAILY` 또는 `INTRADAY` 해상도와 선택적인
계산 정의 ID·버전입니다. 이름·코드 해석은 별도
[날짜별 정확 일치 조회](INSTRUMENT_RESOLUTION.ko.md)가 담당합니다.

반환값은 검증된 요청과 매니페스트의 버전·SHA-256을 포함합니다. 이 해시는
출처 기록을 포함한 조회 범위 선언을 식별하며, 재현 엔진의 정규 결과 해시와 다릅니다.
다음 순서로 사유를 구분합니다.

| 상태            | 사유 코드               | 의미                                                                   |
| --------------- | ----------------------- | ---------------------------------------------------------------------- |
| `UNCONFIRMABLE` | `OUTSIDE_COVERAGE`      | 종목, 항목 또는 요청한 양 끝 날짜의 관측이 범위에 없음                 |
| `UNCONFIRMABLE` | `RESOLUTION_TOO_COARSE` | 일별 자료로 장중 요청을 확인할 수 없음                                 |
| `UNCONFIRMABLE` | `DEFINITION_NOT_BOUND`  | ID·버전·항목·해상도가 일치하는 신뢰된 계산 정의가 하나로 연결되지 않음 |
| `READY`         | —                       | 별도로 연결된 계산에 전달할 원본 행이 있음                             |

한 데이터셋이 요청한 범위를 담고 양 끝 날짜에 실제 관측이 있어야 합니다.
중간 관측일은 반환 목록에 명시합니다. 누락된 날짜를 만들거나 완전한 거래일
달력을 보장하지 않습니다. 여러 부분 데이터셋의 결합, 계산별 과거 기간이나
달력 검증은 구현하지 않았습니다. 계산 정의는 신뢰된 버전별 코드가 전달하는
메타데이터입니다. 이 경계는 계산을 실행하거나 `COMPUTED`·`DIFFERS` 문장
등급을 부여하거나 패턴 가설을 승인하지 않습니다. `READY`만으로 증거가 되지 않습니다.

`POST /api/check/coverage`는 구조화된 요청에 이 검사를 제공합니다. 다음 요청은
장중 확인이 가능한지 묻습니다.

```json
{
  "instrumentId": "코스피 200",
  "dateWindow": { "start": "2026-09-03", "endInclusive": "2026-09-03" },
  "field": "clpr",
  "resolution": "INTRADAY"
}
```

사유 코드와 함께 한국어·영어
설명 및 확인에 필요한 자료를 반환합니다. 잘못된 요청이나 요청자가 제공하는
매니페스트·계산 정의 목록은 HTTP 422, `REVIEW_REQUIRED`로 거절합니다.
현재 서버에는 수치 계산 정의가 연결되어 있지 않아 일별 범위가 맞더라도
`DEFINITION_NOT_BOUND`를 반환합니다. 붙여넣은 글의 추출, 수치 재계산과 전체
주장 검사 화면은 [#154](https://github.com/WeaveTrail/WeaveTrail/issues/154),
[#157](https://github.com/WeaveTrail/WeaveTrail/issues/157),
[#230](https://github.com/WeaveTrail/WeaveTrail/issues/230)의 계획 단계입니다.
요청은 저장하지 않습니다.

## 검증

```bash
pnpm exec vitest run packages/published-data/src/coverage.test.ts packages/replay-engine/src/claim-coverage.test.ts apps/web/src/app/api/coverage/route.test.ts apps/web/src/app/api/check/coverage/route.test.ts apps/web/src/app/coverage-line.test.ts
```

위 검증 명령은 원본 JSONL, 출처 해시 및 취득
기록을 별도 파일 목록과 비교해 매니페스트 누락을 검출합니다. 불변식 테스트는
전달된 매니페스트에서 관측을 제거해 우회 조회가 없는지 확인하고 세 사유를
구분합니다. API 테스트는 양쪽 언어의 사유와 요청을 통한 범위 확장 거절을,
화면 테스트는 승인·실행 및 결과 앞의 표시를 확인합니다. 오프라인 단위·서버
렌더링 검사이며 브라우저 종단간 검증은 아닙니다.
[ADR 0052](adr/0052-derive-claim-resolution-scope-from-acquisitions.md)(영문)에서 설계 근거를 설명합니다.
