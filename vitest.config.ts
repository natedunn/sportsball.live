import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // The gateway Worker is its own package with node:test tests.
    exclude: ["**/node_modules/**", "workers/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "~api": resolve(__dirname, "./src/lib/api.ts"),
      "@convex": resolve(__dirname, "./src/convex"),
    },
  },
});
