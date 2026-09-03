import { describe, expect, it } from "vitest";

import {
  DecimalArithmeticError,
  addScaledDecimals,
  compareExactRatioToDecimal,
  compareScaledDecimals,
  multiplyScaledDecimals,
  parseScaledDecimal,
  renderExactRatioTruncated,
  renderScaledDecimal,
} from "./scaled-decimal";

describe("scaled decimal arithmetic", () => {
  it("aligns different fractional digit counts without losing trailing-zero scale", () => {
    const sum = addScaledDecimals(
      parseScaledDecimal("1.2345"),
      parseScaledDecimal("2.00"),
    );

    expect(renderScaledDecimal(sum)).toBe("3.2345");
    expect(renderScaledDecimal(parseScaledDecimal("100.00"))).toBe("100.00");
    expect(
      compareScaledDecimals(
        parseScaledDecimal("2.0"),
        parseScaledDecimal("2.00"),
      ),
    ).toBe(0);
  });

  it("multiplies large-magnitude notionals exactly", () => {
    const notional = multiplyScaledDecimals(
      parseScaledDecimal("999999999999999999999999.9999"),
      parseScaledDecimal("888888888888888888.8888"),
    );

    expect(renderScaledDecimal(notional)).toBe(
      "888888888888888888888799999911111111111111.11111112",
    );
  });

  it("compares an exact ratio by cross multiplication before rendering", () => {
    const ratio = { numerator: -1n, denominator: 100_000n };
    const threshold = parseScaledDecimal("0.0000");

    expect(renderExactRatioTruncated(ratio, 4n)).toBe("0.0000");
    expect(compareExactRatioToDecimal(ratio, threshold)).toBe(-1);
  });

  it("truncates negative sensitivity toward zero", () => {
    expect(
      renderExactRatioTruncated(
        { numerator: -12_345_678n, denominator: 1_000_000n },
        4n,
      ),
    ).toBe("-12.3456");
  });

  it.each(["", "01", ".1", "1.", "+1", "1e3", " 1"])(
    "rejects non-canonical decimal input %j",
    (value) => {
      expect(() => parseScaledDecimal(value)).toThrowError(
        expect.objectContaining<Partial<DecimalArithmeticError>>({
          code: "INVALID_DECIMAL",
        }),
      );
    },
  );

  it("rejects non-positive exact-ratio denominators", () => {
    expect(() =>
      compareExactRatioToDecimal(
        { numerator: 1n, denominator: 0n },
        parseScaledDecimal("1"),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<DecimalArithmeticError>>({
        code: "INVALID_DENOMINATOR",
      }),
    );
  });
});
