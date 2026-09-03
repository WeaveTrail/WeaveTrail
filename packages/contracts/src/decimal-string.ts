import { z } from "zod";

export const DECIMAL_STRING_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function canonicalizeDecimalString(value: string): string | undefined {
  if (!DECIMAL_STRING_PATTERN.test(value)) return undefined;

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction] = unsigned.split(".");
  const canonicalFraction = fraction?.replace(/0+$/, "");

  if (integer === "0" && !canonicalFraction) return "0";
  return `${negative ? "-" : ""}${integer}${canonicalFraction ? `.${canonicalFraction}` : ""}`;
}

export const DecimalStringSchema = z.string().transform((value, context) => {
  const canonical = canonicalizeDecimalString(value);
  if (canonical === undefined) {
    context.addIssue({
      code: "custom",
      message: "Expected a decimal string",
    });
    return z.NEVER;
  }
  return canonical;
});
