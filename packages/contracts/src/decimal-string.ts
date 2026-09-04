import { z } from "zod";

import { canonicalizeDecimalString } from "./canonical-decimal-runtime.mjs";

export {
  canonicalizeDecimalString,
  DECIMAL_STRING_PATTERN,
} from "./canonical-decimal-runtime.mjs";

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
