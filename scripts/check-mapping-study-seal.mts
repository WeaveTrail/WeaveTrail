import { verifyMappingStudy } from "../packages/evals/src/mapping-corpus-artifacts";
import { generateMappingStudy } from "../packages/evals/src/mapping-corpus-generator";
import { requireCorpusSealReady } from "../packages/evals/src/mapping-corpus-review";

if (process.argv.length !== 2)
  throw new Error("Usage: pnpm eval:corpus:seal:check");
// Read-only: byte verification must pass before the independent-review gate.
await verifyMappingStudy();
requireCorpusSealReady(generateMappingStudy());
process.stdout.write("PASS: corpus seal readiness verified\n");
