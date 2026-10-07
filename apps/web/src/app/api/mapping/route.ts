import {
  MappingResponseSchema,
  ReplayScenarioSchema,
} from "@weavetrail/contracts";
import { PROVIDER_REVIEW_MESSAGE } from "@weavetrail/ai-harness/server";
import { proposeMapping } from "../../../lib/mapping-provider";
import { PublicModelBudgetRequired } from "../../../lib/public-model-budget";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const mediaType = request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    const origin = request.headers.get("origin");
    // JSON forces cross-origin browsers through a preflight; also refuse any
    // explicitly foreign/opaque origin before parsing or reserving paid calls.
    if (
      mediaType !== "application/json" ||
      (origin !== null && origin !== new URL(request.url).origin)
    )
      throw new Error("Invalid mapping request origin or content type");
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
      MappingResponseSchema.parse(await proposeMapping(scenario, request)),
      {
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return Response.json(
      {
        status: "REVIEW_REQUIRED",
        workflowState: "MAPPING_REVIEW_REQUIRED",
        issues: [
          {
            code: "MAPPING_APPLICATION_REVIEW_REQUIRED",
            path: [],
            ...(error instanceof PublicModelBudgetRequired
              ? { budgetReason: error.budgetReason }
              : {}),
            message:
              error instanceof PublicModelBudgetRequired
                ? error.message
                : PROVIDER_REVIEW_MESSAGE,
          },
        ],
      },
      { status: 422, headers: { "cache-control": "no-store" } },
    );
  }
}
