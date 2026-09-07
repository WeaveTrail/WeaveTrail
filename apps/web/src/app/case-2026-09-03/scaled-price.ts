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

export type Scale = (value: string) => number;

/**
 * Maps a set of published decimal prices onto a vertical span, padded so the
 * extremes do not sit on the edge. Integer arithmetic throughout; the one
 * division produces the unitless fraction a coordinate needs.
 *
 * It lives here rather than beside the chart because the site's session chart
 * and the worked-case figure the READMEs embed both draw the same day, and a
 * second copy of this arithmetic would let the two pictures drift apart.
 */
export function verticalScale(
  values: readonly string[],
  top: number,
  bottom: number,
): Scale {
  const scaled = values.map(scaledPrice);
  let low = scaled[0]!;
  let high = scaled[0]!;
  for (const value of scaled) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  const span = high - low;
  const padding = span === 0n ? 1n : (span * 12n) / 100n;
  const minimum = low - padding;
  const range = high + padding - minimum;
  const height = bottom - top;
  return (value) => {
    const offset = scaledPrice(value) - minimum;
    const fraction =
      Number((offset * RATIO_UNITS) / range) / Number(RATIO_UNITS);
    return bottom - fraction * height;
  };
}

/**
 * Maps a set of nonnegative decimal strings onto a span that starts at zero, so
 * a bar's length is proportional to its value rather than to its distance from
 * the smallest value in the set. A comparison whose whole point is that two
 * metrics differ by orders of magnitude has to keep that difference visible, and
 * a scale anchored anywhere but zero would flatten it.
 *
 * Integer arithmetic throughout; the one division produces the unitless
 * fraction a coordinate needs.
 */
export function proportionalScale(
  values: readonly string[],
  zero: number,
  full: number,
): Scale {
  let high = 0n;
  for (const value of values) {
    const scaled = scaledPrice(value);
    if (scaled > high) high = scaled;
  }
  const span = high === 0n ? 1n : high;
  return (value) => {
    const fraction =
      Number((scaledPrice(value) * RATIO_UNITS) / span) / Number(RATIO_UNITS);
    return zero + fraction * (full - zero);
  };
}

/**
 * Where a one-based position falls across a population of `size`, as a
 * unitless fraction. Counts, not prices, but the same integer-then-divide
 * discipline keeps a large population from collapsing two adjacent positions
 * onto one coordinate.
 */
export function positionFraction(position: string, size: string): number {
  const total = BigInt(size);
  if (total <= 1n) return 0;
  const offset = BigInt(position) - 1n;
  return Number((offset * RATIO_UNITS) / (total - 1n)) / Number(RATIO_UNITS);
}
