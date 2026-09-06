export function produceFscOutputPair<Result>(
  firstPath: string,
  secondPath: string,
  produce: () => Promise<{
    firstBytes: string | Uint8Array;
    secondBytes: string | Uint8Array;
    result: Result;
  }>,
): Promise<Result>;
export function saveFscOutputPair(
  firstPath: string,
  firstBytes: string | Uint8Array,
  secondPath: string,
  secondBytes: string | Uint8Array,
): Promise<void>;
