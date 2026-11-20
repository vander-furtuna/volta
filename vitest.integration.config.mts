import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Database integration tests. They run against VOLTA_TEST_DATABASE_URL, one file at a time. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
