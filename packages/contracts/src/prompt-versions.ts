/**
 * Every prompt version a runtime trace may carry. The public AI failure log
 * (docs/AI_FAILURE_LOG.md) lists exactly these, with what changed, why and
 * whether a held-out set was burned; add or change a version in both together.
 * See docs/adr/0060-register-prompt-versions-for-the-failure-log.md.
 */
export const PROMPT_VERSIONS = [
  "schema-mapping/1",
  "fixture-mapping/1",
  "rapid-price-lift-case-v1",
  "published-execution-schema-case-v1",
  "published-execution-broad-case-v1",
] as const;

export type PromptVersion = (typeof PROMPT_VERSIONS)[number];

export function isPromptVersion(value: unknown): value is PromptVersion {
  return (PROMPT_VERSIONS as readonly unknown[]).includes(value);
}
