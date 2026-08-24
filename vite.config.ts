import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Only the library's own test run lives here; each example has its own config.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./test/setup-tests.ts",
    include: ["lib/**/*.test.tsx"],
    benchmark: { include: ["lib/**/*.bench.tsx"] },
    globals: true,
  },
})
