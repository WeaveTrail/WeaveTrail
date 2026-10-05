# 주장 범위 계약

[English](COVERAGE.md) · 영문 문서가 기준입니다.

커밋된 시세 자료와 이를 사용하는 앱 연결은 철회되었습니다. 현재 트리는 실제 시세 자료를 제공하지 않습니다. [ADR 0056](adr/0056-withdraw-the-committed-real-data-tier.md)(영문)을 참고하세요.

## 제거된 경로

`GET /api/coverage`와 `POST /api/check/coverage`는 404를 반환합니다. 재현 화면은 공개 범위 명세를 연결하지 않습니다. 붙여넣은 글 확인 기능은 구현되지 않았습니다.

## 유지된 라이브러리

엄격한 범위 계약과 `resolveClaimCoverage` 라이브러리는 유지됩니다. 호출자가 명세를 전달하며 범위 부재, 해상도 부족, 정의 미연결 시 확인 불가로 처리하고 수치 등급을 만들지 않습니다. 테스트는 합성 메타데이터만 사용합니다.

## 검증

```bash
pnpm exec vitest run packages/replay-engine/src/claim-coverage.test.ts
```
