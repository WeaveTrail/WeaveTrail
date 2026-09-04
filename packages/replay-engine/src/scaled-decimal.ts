import { DECIMAL_STRING_PATTERN } from "@weavetrail/contracts";

export type ScaledDecimal = Readonly<{
  coefficient: bigint;
  scale: bigint;
}>;

export type ExactRatio = Readonly<{
  numerator: bigint;
  denominator: bigint;
}>;

export class DecimalArithmeticError extends Error {
  constructor(
    readonly code: "INVALID_DECIMAL" | "INVALID_SCALE" | "INVALID_DENOMINATOR",
    message: string,
  ) {
    super(message);
    this.name = "DecimalArithmeticError";
  }
}

function powerOfTen(exponent: bigint): bigint {
  if (exponent < 0n) {
    throw new DecimalArithmeticError(
      "INVALID_SCALE",
      "Decimal scale must not be negative",
    );
  }

  let result = 1n;
  let remaining = exponent;
  while (remaining > 0n) {
    result *= 10n;
    remaining -= 1n;
  }
  return result;
}

function alignCoefficient(value: ScaledDecimal, scale: bigint): bigint {
  return value.coefficient * powerOfTen(scale - value.scale);
}

export function parseScaledDecimal(value: string): ScaledDecimal {
  const match = DECIMAL_STRING_PATTERN.exec(value);
  if (!match) {
    throw new DecimalArithmeticError(
      "INVALID_DECIMAL",
      `Invalid canonical decimal string: ${JSON.stringify(value)}`,
    );
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ""] = unsigned.split(".");
  return {
    coefficient: (negative ? -1n : 1n) * BigInt(`${integer}${fraction}`),
    scale: BigInt(fraction.length),
  };
}

export function addScaledDecimals(
  left: ScaledDecimal,
  right: ScaledDecimal,
): ScaledDecimal {
  const scale = left.scale > right.scale ? left.scale : right.scale;
  return {
    coefficient: alignCoefficient(left, scale) + alignCoefficient(right, scale),
    scale,
  };
}

export function subtractScaledDecimals(
  left: ScaledDecimal,
  right: ScaledDecimal,
): ScaledDecimal {
  return addScaledDecimals(left, {
    coefficient: -right.coefficient,
    scale: right.scale,
  });
}

export function multiplyScaledDecimals(
  left: ScaledDecimal,
  right: ScaledDecimal,
): ScaledDecimal {
  return {
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  };
}

export function compareScaledDecimals(
  left: ScaledDecimal,
  right: ScaledDecimal,
): -1 | 0 | 1 {
  const scale = left.scale > right.scale ? left.scale : right.scale;
  const difference =
    alignCoefficient(left, scale) - alignCoefficient(right, scale);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function compareExactRatioToDecimal(
  ratio: ExactRatio,
  threshold: ScaledDecimal,
): -1 | 0 | 1 {
  if (ratio.denominator <= 0n) {
    throw new DecimalArithmeticError(
      "INVALID_DENOMINATOR",
      "Exact-ratio denominator must be greater than zero",
    );
  }

  const difference =
    ratio.numerator * powerOfTen(threshold.scale) -
    threshold.coefficient * ratio.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function renderScaledDecimal(value: ScaledDecimal): string {
  const negative = value.coefficient < 0n;
  const magnitude = negative ? -value.coefficient : value.coefficient;
  let digits = magnitude.toString();

  while (BigInt(digits.length) <= value.scale) digits = `0${digits}`;
  if (value.scale === 0n) return `${negative ? "-" : ""}${digits}`;

  const integerDigitCount = BigInt(digits.length) - value.scale;
  let integer = "";
  let fraction = "";
  for (const digit of digits) {
    if (BigInt(integer.length) < integerDigitCount) integer += digit;
    else fraction += digit;
  }
  return `${negative ? "-" : ""}${integer}.${fraction}`;
}

export function renderExactRatioTruncated(
  ratio: ExactRatio,
  fractionalDigits: bigint,
): string {
  if (ratio.denominator <= 0n) {
    throw new DecimalArithmeticError(
      "INVALID_DENOMINATOR",
      "Exact-ratio denominator must be greater than zero",
    );
  }

  return renderScaledDecimal({
    coefficient:
      (ratio.numerator * powerOfTen(fractionalDigits)) / ratio.denominator,
    scale: fractionalDigits,
  });
}
