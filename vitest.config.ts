import { defineConfig } from "vitest/config";
import path from "node:path";

const here = path.resolve(".");

export default defineConfig({
  resolve: {
    alias: {
      "@mnemonic/schemas": path.join(here, "packages/schemas/src/index.ts"),
      "@mnemonic/core": path.join(here, "packages/core/src/index.ts"),
      "@mnemonic/retrieval": path.join(here, "packages/retrieval/src/index.ts"),
      "@mnemonic/connectors": path.join(here, "packages/connectors/src/index.ts"),
      "@mnemonic/agent-adapters": path.join(here, "packages/agent-adapters/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
    ],
    globals: false,
    environment: "node",
  },
});
