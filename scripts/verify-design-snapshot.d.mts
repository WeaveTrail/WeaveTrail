export function validateLocalPayloadPaths(
  actualPaths: readonly string[],
  expectedPaths: readonly string[],
  allowed: (path: string) => boolean,
): void;
export function verifyDesignSnapshot(
  root: string,
  source: string,
): { revision: string; count: number };
