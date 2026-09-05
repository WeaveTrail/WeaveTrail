// Display metadata only. Never included in mapping approvals or event hashes.
export type SourceProvenance =
  | { kind: "synthetic"; provider: string; attribution: string }
  | {
      kind: "real";
      provider: string;
      title: string;
      titleEnglish: string;
      originUrl: string;
      retrievedAt: string;
      basDt: string;
      venue: { value: string; basis: string };
      licence: {
        label: string;
        termsUrl: string;
        checkedAt: string;
        attributionRequirements: string;
        attribution: string;
      };
    };

export const syntheticSourceProvenance = {
  kind: "synthetic",
  provider: "WeaveTrail",
  attribution: "Synthetic fixtures authored by the WeaveTrail contributors.",
} as const satisfies SourceProvenance;
