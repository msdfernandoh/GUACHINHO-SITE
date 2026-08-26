import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
      // Permite testes unitários importarem módulos com `import "server-only"`.
      "server-only": path.resolve(projectRoot, "./src/test-stubs/server-only.ts"),
    },
  },
});
