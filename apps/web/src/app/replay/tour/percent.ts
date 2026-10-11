/**
 * Basis points as a percentage, by moving the decimal point two places in the
 * exact decimal string. No floating-point arithmetic touches the value; the
 * result is truncated, never rounded, to at most two decimals.
 */
export function bpsAsPercent(bps: string): string {
  const negative = bps.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? bps.slice(1) : bps).split(
    ".",
  );
  const padded = whole.padStart(3, "0");
  const integer = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const decimals = (padded.slice(-2) + fraction).slice(0, 2).replace(/0+$/, "");
  const shown = decimals ? `${integer}.${decimals}` : integer;
  return negative && shown !== "0" ? `-${shown}` : shown;
}
