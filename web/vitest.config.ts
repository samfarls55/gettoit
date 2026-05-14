import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// GetToIt web — vitest config.
//
// Drives the unit/integration tests under `web/`. Uses jsdom for the
// component-level tests in `components/*.test.tsx`; the lib tests run
// in the same environment but don't touch the DOM. CI surfaces the
// test run from the `web` lane (see `.github/workflows/ci.yml`).

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
