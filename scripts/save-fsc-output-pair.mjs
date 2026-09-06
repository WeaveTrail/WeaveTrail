import { open, unlink } from "node:fs/promises";

const cleanupError = (error, failures) =>
  failures.length
    ? new AggregateError(
        [error, ...failures],
        "Output pair save failed and newly created output files could not be cleaned up",
      )
    : error;

async function closeFiles(files) {
  const openFiles = files.filter((file) => !file.closed);
  const results = await Promise.allSettled(
    openFiles.map(({ handle }) => handle.close()),
  );
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      openFiles[index].closed = true;
      return [];
    }
    return [result.reason];
  });
}

async function removeFiles(paths) {
  const results = await Promise.allSettled(paths.map((path) => unlink(path)));
  return results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
}

// Both paths are reserved with exclusive handles before the producer runs. On
// ordinary caught failures, only paths created by this invocation are removed.
// A forced process exit or storage failure can still interrupt this sequence.
export async function produceFscOutputPair(firstPath, secondPath, produce) {
  const files = [];
  const createdPaths = [];
  try {
    const first = await open(firstPath, "wx");
    files.push({ handle: first, closed: false });
    createdPaths.push(firstPath);
    const second = await open(secondPath, "wx");
    files.push({ handle: second, closed: false });
    createdPaths.push(secondPath);

    const { firstBytes, secondBytes, result } = await produce();
    await first.writeFile(firstBytes);
    await second.writeFile(secondBytes);

    const closeFailures = await closeFiles(files);
    if (closeFailures.length) {
      throw new AggregateError(closeFailures, "Could not close output pair");
    }
    return result;
  } catch (error) {
    const closeFailures = await closeFiles(files);
    const removeFailures = await removeFiles(createdPaths);
    throw cleanupError(error, [...closeFailures, ...removeFailures]);
  }
}

export async function saveFscOutputPair(
  firstPath,
  firstBytes,
  secondPath,
  secondBytes,
) {
  await produceFscOutputPair(firstPath, secondPath, async () => ({
    firstBytes,
    secondBytes,
  }));
}
