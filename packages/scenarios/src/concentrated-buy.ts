import { TradeEventSchema } from "@weavetrail/contracts";

import generatedEvents from "./generated/concentrated-buy.json";

export const concentratedBuyEvents =
  TradeEventSchema.array().parse(generatedEvents);
