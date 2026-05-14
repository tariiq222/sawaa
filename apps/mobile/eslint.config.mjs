import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * Mobile ESLint — Expo React Native.
 *
 * The repo standardized on flat config (eslint v9). Mobile was the last
 * workspace without one — `npm run lint` was failing at startup.
 *
 * Rules kept intentionally lean — we trust TS for correctness and reserve
 * lint for cross-cutting hygiene. Project-specific rules belong in their
 * own `files` block below.
 */
export default defineConfig([
  globalIgnores([
    "node_modules/**",
    ".expo/**",
    "dist/**",
    "android/**",
    "ios/**",
    "scripts/**",
    "babel.config.js",
    "metro.config.js",
    "jest.config.*",
  ]),

  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // Browser / RN globals
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        // RN
        __DEV__: "readonly",
        global: "readonly",
        // Node-ish (config/scripts)
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        // Jest
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // TS handles these — turn off the JS originals
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-redeclare": "off",
      "no-dupe-class-members": "off",

      // Deqah golden rule: no `any`. Warn (not error) until a follow-up
      // can clean up pre-existing call sites.
      "@typescript-eslint/no-explicit-any": "warn",

      // Underscore-prefixed = intentionally unused
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Don't require `import React from "react"` — RN/Expo + new JSX transform
      "react/react-in-jsx-scope": "off",
      // RN doesn't use react-dom prop-types
      "react/prop-types": "off",

      // Hooks rules — these catch real bugs
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  {
    // Tests: relaxed
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
