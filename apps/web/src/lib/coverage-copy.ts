import type {
  CoverageManifest,
  CoverageReasonCode,
} from "@weavetrail/contracts";

export type CoverageCopy = Record<"ko" | "en", string>;

/** Copy is presentation only. Resolution always uses the full manifest. */
export function coverageSummary(manifest: CoverageManifest): CoverageCopy {
  const familyNames: Record<string, CoverageCopy> = {
    "market:KOSPI": { ko: "KOSPI 주식", en: "KOSPI stocks" },
    "index-family:코스피": { ko: "코스피 지수군", en: "KOSPI index family" },
    "index:코스피 200": {
      ko: "코스피 200 기준 기간",
      en: "KOSPI 200 baseline",
    },
    "instrument-family:코스피200": {
      ko: "코스피 200 선물군",
      en: "KOSPI 200 futures family",
    },
    "instrument-family:위클리": {
      ko: "위클리 옵션군",
      en: "weekly options family",
    },
  };
  const summary = (language: "ko" | "en") => {
    const entries = manifest.datasets
      .map((dataset) => {
        const family = dataset.instrumentFamily;
        const name =
          familyNames[`${family.kind}:${family.value}`]?.[language] ??
          `${family.kind} ${family.value}`;
        const window = dataset.dateWindow;
        const dates =
          window.start === window.endInclusive
            ? window.start
            : `${window.start}–${window.endInclusive}`;
        const resolution =
          dataset.resolution === "DAILY"
            ? language === "ko"
              ? "일별"
              : "daily"
            : language === "ko"
              ? "장중"
              : "intraday";
        const scope =
          dataset.acquisitionScope === "bounded-window"
            ? language === "ko"
              ? `, 수집된 ${dataset.observations.length}행만`
              : `, only ${dataset.observations.length} collected rows`
            : "";
        return `${name} (${dates}, ${resolution}${scope})`;
      })
      .join("; ");
    return language === "ko"
      ? `조회 범위: ${entries} · 실제 관측일만 · 최신 수집 ${manifest.asOf}`
      : `Check coverage: ${entries} · observed dates only · latest retrieval ${manifest.asOf}`;
  };
  return { ko: summary("ko"), en: summary("en") };
}

export const coverageReasons: Record<CoverageReasonCode, CoverageCopy> = {
  OUTSIDE_COVERAGE: {
    ko: "조회 범위 밖: 요청한 종목, 날짜 또는 항목이 수집된 공개 데이터에 없습니다. 해당 범위의 자료를 추가로 승인·수집해야 확인할 수 있습니다.",
    en: "Outside coverage: the requested instrument, date or field is absent from the admitted published data. Data for that scope must be admitted and collected to check it.",
  },
  RESOLUTION_TOO_COARSE: {
    ko: "시간 해상도 부족: 일별 자료로 장중 시점이나 순서를 확인할 수 없습니다. 승인된 장중 자료가 필요합니다.",
    en: "Resolution too coarse: daily data cannot confirm intraday timing or order. Admitted intraday data is required.",
  },
  DEFINITION_NOT_BOUND: {
    ko: "정의 미연결: 요청한 항목과 해상도에 연결된 버전별 계산 정의가 없습니다. 검증된 계산 정의를 먼저 연결해야 합니다.",
    en: "Definition not bound: no versioned calculation definition is bound to the requested field and resolution. A verified calculation definition must be bound first.",
  },
};
