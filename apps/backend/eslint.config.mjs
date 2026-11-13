import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import sawaaPlugin from "./eslint-rules/sawaa-plugin.mjs";

/**
 * Backend ESLint — Sawaa NestJS.
 *
 * Keeps the rule set small and shared-parser (monorepo root installs the
 * @typescript-eslint packages). Additional domain-specific rules belong in
 * separate `files` blocks below — e.g. forbidding cross-cluster imports.
 */
export default defineConfig([
  globalIgnores([
    "dist/**",
    "coverage/**",
    "node_modules/**",
    "prisma/migrations/**",
    "scripts/**",
    "jest.config.*",
  ]),

  js.configs.recommended,

  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      sawaa: sawaaPlugin,
    },
    rules: {
      // Disable core JS rules that TS handles or that produce false positives on .ts syntax
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-dupe-class-members": "off",
      "no-redeclare": "off",

      // Sawaa golden rule: no `any` in TypeScript (MNT-13: all former warnings
      // fixed, rule promoted to "error"). Tests keep their relaxed override below.
      "@typescript-eslint/no-explicit-any": "error",

      // Unused: allow underscore-prefixed vars
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Require @ApiOperation on every NestJS HTTP handler.
      "sawaa/require-api-operation": "error",

      // Single-tenant: Postgres RLS and the `$allTenants` / `$allTenantsUnsafe`
      // escape hatches were removed (see src/common/database/transaction.service.ts).
      // The first rule below is kept so those removed names cannot be reintroduced.
      //
      // `TransactionService.withTransaction()` is a thin wrapper over
      // `prisma.$transaction()`. The second rule keeps transactions flowing through
      // that single wrapper; the wrapper file itself is exempt below.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='$allTenantsUnsafe']",
          message:
            "$allTenantsUnsafe belonged to the removed multi-tenant RLS layer and must not be reintroduced. Use PrismaService directly (single-tenant).",
        },
        {
          selector: "CallExpression[callee.property.name='$transaction']:not([callee.object.property.name='$allTenants'])",
          message:
            "Use TransactionService.withTransaction() instead of calling prisma.$transaction() directly, so transactions go through the one shared wrapper.",
        },
      ],
    },
  },

  {
    // Tests have relaxed rules
    files: ["test/**/*.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "sawaa/require-api-operation": "off",
      // Test helpers and e2e fixtures legitimately call $transaction directly for
      // database setup/teardown; they are not application code subject to these rules.
      "no-restricted-syntax": "off",
    },
  },

  {
    // Manual mocks often match external APIs and may not use every argument.
    files: ["src/__mocks__/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  {
    // Infrastructure-internal files that implement the $transaction wrappers are
    // exempt from the no-restricted-syntax/$transaction rule — they ARE the wrapper.
    files: [
      "src/common/database/transaction.service.ts",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
]);
