import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "integration",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["tests/integration/**/*.test.ts"],
          exclude: ["node_modules", "dist"],
        },
      },
      {
        test: {
          name: "e2e",
          browser: {
            enabled: true,
            headless: false,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            viewport: { width: 1200, height: 900 },
          },
          include: ["tests/e2e/**/*.test.ts"],
        },
      },
    ],
  },
});
