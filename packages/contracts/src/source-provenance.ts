// Display metadata only. Never included in mapping approvals or event hashes.
type RecordedSource = {
  recordUrl: string;
};

type RealSourceDateScope =
  | { basDt: string; basDtRange?: never }
  | {
      basDt?: never;
      basDtRange: { begin: string; endInclusive: string };
    };

export type SourceProvenance =
  | (RecordedSource & {
      kind: "synthetic";
      provider: string;
      title: string;
      attribution: string;
    })
  | ({
      kind: "real";
      provider: string;
      title: string;
      titleEnglish: string;
      originUrl: string;
      retrievedAt: string;
      venue: { value: string; basis: string };
      licence: {
        label: string;
        termsUrl: string;
        checkedAt: string;
        attributionRequirements: string;
        attribution: string;
      };
    } & RealSourceDateScope &
      RecordedSource);
