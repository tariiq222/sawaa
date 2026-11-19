import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import os from "node:os"
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

// Worker/heap budget, measured 19 Nov 2026 on the 14-core / 24 GB dev machine.
// The old `maxWorkers: 1` + 6 GB heap was a workaround for one hook spec that
// needed >6 GB while importing; that spec no longer exists (it was split into
// use-employees-list/-detail/-mutations/-schedule). Re-measured full suite
// (345 files / 2,493 tests): the heaviest single spec
// (booking-pos-submit.spec.tsx) peaks at ~700 MB whole-tree / ~561 MB fork RSS,
// and the total tree peaked at 2.1 GB (6 workers) to 4.5 GB (13 workers) across
// configurations. There is no OOM today, so the serial pin is gone.
//
// Heap cap is a ceiling, not a reservation: real forks peaked at ~360-680 MB.
// 1,536 MB is 2.2-2.5x the heaviest observed fork, yet small enough that the
// worker count below stays bounded by RAM instead of the 14 cores. Lower caps
// (1,024 MB) also pass; the extra headroom covers import-heavy specs on slower
// CI runners.
//
// Sizing policy: workers x per-worker ceiling must stay near half of physical
// RAM, so a browser or IDE opened mid-run cannot push the box into swap. With
// the 6-worker cap below the worker ceiling is 6 x 2 GB = 12 GB, i.e. 50% of a
// 24 GB machine, and the 8 GB reserve is what stays available to everything
// else. Measured usage is far below that ceiling: the whole process tree peaked
// at 2.1-2.2 GB with 6 workers and 2.7-3.1 GB with 8.
const WORKER_HEAP_MB = 1536

// Throughput saturates early and the last workers buy little: measured on this
// box (load varies, so ranges are from repeated runs) 4 workers took ~65 s,
// 6 took ~65-73 s, 7 ~60-64 s, and 8 ~57 s. The gap between 6 and 8 is under
// ~15 s, so the cap trades that for a much larger RAM margin instead of
// pinning the worker count to the core count (or back to a fixed 1).
const RESERVED_GB = 8 // OS, editor, browser, and the vitest main process
const PER_WORKER_GB = (WORKER_HEAP_MB + 512) / 1024 // heap cap + V8/native/jsdom
const MEMORY_BOUND_WORKERS = Math.floor(
  (os.totalmem() / 1024 ** 3 - RESERVED_GB) / PER_WORKER_GB,
)
const MAX_USEFUL_WORKERS = 6
const MAX_WORKERS = Math.max(
  1,
  Math.min(os.availableParallelism() - 1, MEMORY_BOUND_WORKERS, MAX_USEFUL_WORKERS),
)

export default defineConfig({
  plugins: [react()],
  test: {
    // Forks keep per-file isolation (module registry, jsdom globals, mocks).
    pool: "forks",
    maxWorkers: MAX_WORKERS,
    // Node 25+ ships a global localStorage that shadows jsdom's; disable it.
    execArgv: [
      `--max-old-space-size=${WORKER_HEAP_MB}`,
      "--no-experimental-webstorage",
    ],
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
      // Ratchet: measured 19 Nov 2026 (MNT-23) on the full suite:
      // stmts 57.65 / branches 49.48 / funcs 51.43 / lines 58.94.
      // Set ~1.5 points below current to lock in gains without flaking.
      thresholds: {
        statements: 56,
        branches: 48,
        functions: 50,
        lines: 57,
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
