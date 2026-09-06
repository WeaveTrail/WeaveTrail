export function derivePublishedRows(bytes: Uint8Array): {
  sourceArtifactHash: string;
  rows: {
    coordinate: { sourceArtifactHash: string; rowNumber: string };
    values: Record<string, string>;
  }[];
  generatedRows: string;
  generatedRowsHash: string;
};
