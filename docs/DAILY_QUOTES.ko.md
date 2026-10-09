# 일별 시세 계약

[English](DAILY_QUOTES.md) · 영문 문서가 기준입니다.

커밋된 시세 자료와 이를 사용하는 앱 연결은 철회되었습니다. 현재 트리는 실제 시세 자료를 제공하지 않습니다. [ADR 0056](adr/0056-withdraw-the-committed-real-data-tier.md)(영문)을 참고하세요.

## 버전 공존

Event `1.1`은 체결·주문을 유지하고, `1.2`는 일별 종가·거래량을 추가하며 `1.3`은 거래일·OHLC·전일 대비 변화를 유지합니다. Mapping `1.5`/`1.6`과 `1.7`은 직접·복합 식별자를 보존합니다. `YYYYMMDD_TO_KST_DAY_START_ISO`는 유효한 그레고리력 날짜를 한국 시각 자정에 고정하며 체결 시각이 아닙니다. `PUBLISHER_DECIMAL_STRING`은 검토된 소수 표기를 정본화합니다. 가격·수량은 소수 문자열이며 계산은 배율 정수를 사용합니다.

## 스키마 참고

FSC의 `basDt`, `srtnCd`, `isinCd`, `idxNm`, `clpr`, `trqu` 같은 필드 이름은 합성 방언의 참고로 사용할 수 있습니다. 발행된 값이나 등록된 시세 아티팩트는 남기지 않습니다.

## 승인과 증거

일별 스키마만으로 사례를 승인할 수 없습니다. 항목 연결만 재현하면 `MAPPING_APPROVED`에서 멈추며 사례 평가는 프로파일에 묶인 별도 매니페스트 승인이 필요합니다. 행위자를 더해도 일별 관측이 체결이 되지 않습니다. Evidence Bundle `1.3`은 평가 없는 정규화를 계속 표현합니다. 합성 입력으로 검증하며 현재 선택 목록은 합성 체결 사례를 제공합니다.

## 검증

```bash
pnpm exec vitest run packages/replay-engine/src/daily-quote.test.ts packages/replay-engine/src/evidence-hash-scopes.test.ts apps/web/src/app/api/replay/daily-quote-route.test.ts
```
