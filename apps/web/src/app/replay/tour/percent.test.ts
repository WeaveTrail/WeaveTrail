import { describe, expect, it } from "vitest";

import { bpsAsPercent } from "./percent";

describe("basis points as a percentage", () => {
  it("moves the decimal point exactly and truncates to two places", () => {
    expect(bpsAsPercent("200")).toBe("2");
    expect(bpsAsPercent("7000")).toBe("70");
    expect(bpsAsPercent("250.0000")).toBe("2.5");
    expect(bpsAsPercent("7096.3070")).toBe("70.96");
    expect(bpsAsPercent("166.6666")).toBe("1.66");
    expect(bpsAsPercent("10000.0000")).toBe("100");
    expect(bpsAsPercent("5")).toBe("0.05");
    expect(bpsAsPercent("0")).toBe("0");
    expect(bpsAsPercent("-12.5")).toBe("-0.12");
  });
});
