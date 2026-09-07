/**
 * Published prices are decimal strings and stay that way. Anything that has to
 * measure one — a chart coordinate, a diagram's bar position — parses it to a
 * scaled integer here and divides once, at the end, on the unitless fraction a
 * coordinate needs, so no price reaches binary floating point.
 */
const DECIMAL_SCALE = 6n;

export function scaledPrice(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole = "", fraction = ""] = value.replace("-", "").split(".");
  const padded = `${fraction}${"0".repeat(Number(DECIMAL_SCALE))}`.slice(
    0,
    Number(DECIMAL_SCALE),
  );
  const magnitude = BigInt(`${whole === "" ? "0" : whole}${padded}`);
  return negative ? -magnitude : magnitude;
}

/** Ratio precision for the one division; well inside a double's exact range. */
export const RATIO_UNITS = 1_000_000n;
