import {
  MappingResponseSchema,
  ReplayScenarioSchema,
} from "@weavetrail/contracts";
import { PROVIDER_REVIEW_MESSAGE } from "@weavetrail/ai-harness/server";
import { proposeMapping } from "../../../lib/mapping-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, "scenario")
    )
      throw new Error("Invalid request");
    const scenario = ReplayScenarioSchema.parse(Reflect.get(body, "scenario"));
    return Response.json(
      MappingResponseSchema.parse(await proposeMapping(scenario)),
      {
        headers: { "cache-control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        status: "REVIEW_REQUIRED",
        workflowState: "MAPPING_REVIEW_REQUIRED",
        issues: [
          {
            code: "MAPPING_APPLICATION_REVIEW_REQUIRED",
            path: [],
            message: PROVIDER_REVIEW_MESSAGE,
          },
        ],
      },
      { status: 422, headers: { "cache-control": "no-store" } },
    );
  }
}
