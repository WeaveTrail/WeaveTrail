import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    // CLI regression tests launch child processes; leave CPU time for those
    // processes instead of spawning a worker for every available core.
    maxWorkers: 4,
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
