import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

// Force the test process to the business timezone before vitest workers
// initialise Node's Date class. Local dev runs Asia/Riyadh, CI runs UTC;
// without this pin, time-formatting assertions silently drift by 3 hours.
process.env.TZ = "Asia/Riyadh"

// A shell-exported NODE_ENV=production makes React resolve its production CJS
// build, which drops `React.act` and breaks @testing-library/react renders.
// Pin to "test" so component specs always load the development build.
if (process.env.NODE_ENV === "production")
  (process.env as Record<string, string>).NODE_ENV = "test"

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
      // Ratchet: raised after Phase 1 (useServices split into 3 files,
      // useEmployeeServiceMutations split, useDashboardHome rewritten to
      // single stats endpoint, ~10 new handler tests) and Phase 2. Measured
      // after Phase 1: stmts 33.96 / branches 24.66 / funcs 31.76 / lines 34.44.
      // Set ~1.5 points below current to lock in gains without flaking.
      // Next ratchet: revisit after Phase 3 e2e + new unit tests.
      thresholds: {
        statements: 33,
        branches: 24,
        functions: 31,
        lines: 34,
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
