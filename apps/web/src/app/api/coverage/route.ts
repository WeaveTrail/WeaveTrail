import { CoverageManifestSchema } from "@weavetrail/contracts";
import { publishedCoverageManifest } from "@weavetrail/published-data";

/** Offline committed coverage. No current URL is fetched on this route. */
export function GET() {
  return Response.json(CoverageManifestSchema.parse(publishedCoverageManifest));
}
