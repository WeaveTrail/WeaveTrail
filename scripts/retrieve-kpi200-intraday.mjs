/**
 * Retrieves the intraday KOSPI 200 index series for one trading date and writes
 * the presentation series the case page draws.
 *
 * The retrieved values are index levels — facts, not the portal's expression —
 * and the chart the product renders is drawn from them in the product's own
 * design. The portal grants no redistribution permission, which is recorded
 * with the artifact and is the reason this series is presentation only: it is
 * never hashed as a source artifact, never approved, and never read by a rule.
 *
 *   node scripts/retrieve-kpi200-intraday.mjs 20260903 > out.json
 */
const [date = "20260903"] = process.argv.slice(2);
const endpoint =
  `https://api.stock.naver.com/chart/domestic/index/KPI200/minute` +
  `?startDateTime=${date}0900&endDateTime=${date}1540`;

const response = await fetch(endpoint, {
  headers: { accept: "application/json" },
});
if (!response.ok) throw new Error(`Retrieval failed: HTTP ${response.status}`);
const rows = await response.json();

/** Exact decimal strings only: no displayed value passes through a float. */
const decimal = (value) => {
  const text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text))
    throw new Error(`Unexpected value ${text}`);
  return text;
};

const points = rows.map((row) => ({
  time: `${String(row.localDateTime).slice(8, 10)}:${String(row.localDateTime).slice(10, 12)}`,
  close: decimal(row.currentPrice),
}));
const lowest = rows.reduce((a, b) => (b.lowPrice < a.lowPrice ? b : a));
const highest = rows.reduce((a, b) => (b.highPrice > a.highPrice ? b : a));
const mark = (row, key) => ({
  time: `${String(row.localDateTime).slice(8, 10)}:${String(row.localDateTime).slice(10, 12)}`,
  value: decimal(row[key]),
});

process.stdout.write(
  JSON.stringify(
    {
      tradingDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      retrievedAt: new Date().toISOString(),
      points,
      low: mark(lowest, "lowPrice"),
      high: mark(highest, "highPrice"),
    },
    null,
    1,
  ) + "\n",
);
