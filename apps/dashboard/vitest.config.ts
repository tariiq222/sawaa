import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

// Force the test process to the business timezone before vitest workers
// initialise Node's Date class. Local dev runs Asia/Riyadh, CI runs UTC;
// without this pin, time-formatting assertions silently drift by 3 hours.
process.env.TZ = "Asia/Riyadh"

export default defineConfig({
  plugins: [react()],
  test: {
    // Forks pool with maxWorkers=1 forces serial file execution, preventing
    // parallel worker processes from accumulating past the heap limit (~4 GB
    // macOS default). OOM occurred at ~25 s when workers ran concurrently.
    pool: "forks",
    maxWorkers: 1,
    // Increase per-worker heap to avoid OOM on memory-heavy test files.
    execArgv: ["--max-old-space-size=6144"],
    // Increase teardown timeout from default 30 s — memory-heavy hook imports
    // need extra time for environment setup before the worker is considered hung.
    teardownTimeout: 60000,

    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.{spec,test}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "lib/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
      ],
      exclude: [
        "node_modules",
        "**/*.{spec,test}.{ts,tsx}",
        "**/*.d.ts",
        "next.config.*",
        "tailwind.config.*",
        "postcss.config.*",
      ],
      thresholds: {
        statements: 25,
        branches: 14,
        functions: 25,
        lines: 25.5,
      },
      reporter: ["text", "lcov", "html"],
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "."),
      react: path.resolve(__dirname, "../../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
    },
  },
})
