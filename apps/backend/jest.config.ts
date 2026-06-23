import type { Config } from 'jest';

// Force the test process timezone to Asia/Riyadh BEFORE any Date code runs.
// Must happen at module top-level (not in setupFiles) because Node's Date
// class caches the timezone from process.env.TZ at startup.
process.env.TZ = 'Asia/Riyadh';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { diagnostics: false }],
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/modules/**/index.ts',
    '!src/api/**/index.ts',
    '!src/infrastructure/**/index.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.spec.ts',
    // Generated Prisma client lives under node_modules/.prisma and is
    // excluded by Jest's default coveragePathIgnorePatterns; include this
    // guard in case the Prisma generator output is ever moved under src/.
    '!src/**/generated/**',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 70,
      lines: 85,
      statements: 85,
    },
  },
  testEnvironment: 'node',
  // Retry only the controller e2e specs to absorb supertest/HTTP resource
  // contention under the full parallel suite (see test/jest-retry.setup.ts).
  setupFilesAfterEnv: ['<rootDir>/test/jest-retry.setup.ts'],
  // The controller e2e specs each bootstrap a Nest application in beforeAll and
  // exercise it through supertest. Under the full parallel suite, CPU
  // contention can push a single app bootstrap or request past Jest's 5s
  // default, failing whole suites spuriously (the same specs pass 40/40 in
  // isolation). A generous ceiling absorbs that contention without masking real
  // logic errors — assertions still decide correctness, only slow timing is
  // tolerated.
  testTimeout: 30_000,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sawaa/shared/(.*)$': '<rootDir>/../../packages/shared/$1',
    '^@sawaa/shared$': '<rootDir>/../../packages/shared/index',
    // file-type@22 is ESM-only and cannot be loaded by ts-jest in CJS mode.
    // Redirect to a CJS-compatible manual mock for the test environment.
    // Production code uses `await import('file-type')` which works at runtime.
    '^file-type$': '<rootDir>/src/__mocks__/file-type.ts',
    // @react-pdf/renderer is pure ESM (and pulls in yoga-layout which uses
    // import.meta) — same situation as file-type. Test environment uses the
    // CJS shim; production uses Node 22's native require(esm) path.
    '^@react-pdf/renderer$': '<rootDir>/src/__mocks__/react-pdf-renderer.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
};

export default config;
