import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ─────────────────────────────────────────────────────────────────────────────
// Architectural Boundary Rules
// Enforces layer separation to prevent coupling drift over time.
//
// Layer hierarchy (top → bottom, imports flow downward only):
//   app/ → components/ → hooks/ → lib/
//
// Cross-feature imports (features/A → features/B) are always forbidden.
// ─────────────────────────────────────────────────────────────────────────────

/** Feature directories that must stay isolated from each other */
const FEATURES = [
  "bookings",
  "practitioners",
  "patients",
  "services",
  "payments",
  "invoices",
  "users",
  "branches",
  "coupons",
  "intake-forms",
  "chatbot",
  "notifications",
  "ratings",
  "reports",
  "settings",
  "activity-log",
  "groups",
  "contact-messages",
  "programs",
  "packages",
  "whatsapp",
  "conversations",
]

/**
 * For a given feature, build the list of sibling features it must NOT import from.
 * Returns an array of no-restricted-imports patterns.
 */
function crossFeatureRestrictions(feature) {
  return FEATURES.filter((f) => f !== feature).map((sibling) => ({
    // Matches both @/components/features/[sibling] and relative paths
    name: `@/components/features/${sibling}`,
    message: `Cross-feature import detected. Components from '${sibling}' must not be imported into '${feature}'. Extract shared logic to components/features/ root or lib/ instead.`,
  }))
}

/** Rules applied to all feature component files */
const featureRules = FEATURES.flatMap((feature) => ({
  files: [`components/features/${feature}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: crossFeatureRestrictions(feature),
      },
    ],
  },
}))

/** lib/ must never import from components/ or hooks/ */
const libLayerRules = {
  files: ["lib/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/components/*", "../components/*", "../../components/*"],
            message: "lib/ must not import from components/. Keep lib/ framework-agnostic.",
          },
          {
            group: ["@/hooks/*", "../hooks/*", "../../hooks/*"],
            message: "lib/ must not import from hooks/. Keep lib/ framework-agnostic.",
          },
        ],
      },
    ],
  },
}

/** hooks/ must never import from components/ (except providers) */
const hooksLayerRules = {
  files: ["hooks/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "@/components/ui/*",
              "@/components/features/*",
              "../components/ui/*",
              "../components/features/*",
            ],
            message:
              "hooks/ must not import UI components. Hooks are framework logic only — no rendering dependencies.",
          },
        ],
      },
    ],
  },
}

/**
 * Forbidden native date inputs — use DatePicker or DateTimeInput from DS only.
 *
 * ✅ Allowed: <DatePicker>, <DateTimeInput>
 * ❌ Forbidden: <Input type="date">, <input type="date">, <input type="datetime-local">
 *
 * Governance: any date/datetime input in feature pages MUST go through
 * components/ui/date-picker.tsx or components/ui/date-time-input.tsx.
 */
const nativeDateInputRules = {
  files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        // Catches: <input type="date" ...> and <Input type="date" ...>
        selector:
          'JSXOpeningElement[name.name=/^[Ii]nput$/] JSXAttribute[name.name="type"][value.value="date"]',
        message:
          'Forbidden: <Input type="date"> is not allowed. Use <DatePicker> from @/components/ui/date-picker instead (DS governance rule).',
      },
      {
        // Catches: <input type="datetime-local" ...> and <Input type="datetime-local" ...>
        selector:
          'JSXOpeningElement[name.name=/^[Ii]nput$/] JSXAttribute[name.name="type"][value.value="datetime-local"]',
        message:
          'Forbidden: <Input type="datetime-local"> is not allowed. Use <DateTimeInput> from @/components/ui/date-time-input instead (DS governance rule).',
      },
    ],
  },
}

/** Forbidden icon libraries — use @hugeicons only */
const iconLibraryRules = {
  files: ["**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["lucide-react"],
            message: "Use @hugeicons/react instead of lucide-react (DS rule: single icon library).",
          },
          {
            group: ["@phosphor-icons/*"],
            message: "Use @hugeicons/react instead of phosphor-icons (DS rule: single icon library).",
          },
          {
            group: ["react-icons"],
            message: "Use @hugeicons/react instead of react-icons (DS rule: single icon library).",
          },
          {
            group: ["@heroicons/*"],
            message: "Use @hugeicons/react instead of heroicons (DS rule: single icon library).",
          },
        ],
      },
    ],
  },
}

/** Suppress React Compiler memoization warnings for form.watch() and useReactTable()
 * These are false positives — form.watch() is the correct RHF API for controlled selects.
 * React Compiler will skip memoizing these components, which is acceptable behavior.
 */
const reactCompilerRule = {
  rules: {
    'react-hooks/incompatible-library': 'off',
  },
}

/**
 * Forbidden hardcoded color classes / pixel values.
 * Patterns caught (any quoted className/class string):
 *   - bg-[#3a5a78]     text-[#abcdef]   border-[rgb(0,0,0)]
 *   - bg-[--weird]     text-[hsl(...)]
 *   - any class inside `[brackets]`
 *
 * Goal: every Tailwind class must reference a token defined in
 * `packages/ui/src/styles/globals.css`. If you find yourself writing
 * a literal value, add a token there and use the semantic name.
 *
 * See: packages/ui/DESIGN_TOKENS.md
 *      packages/ui/COMPONENTS.md §5
 */
const designTokensRules = {
  files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        // Catch colour/shadow arbitrary values whose class prefix is
        // one of the colour/shadow utilities. The bracketed payload
        // may contain a hex / rgb / hsl literal anywhere inside —
        // this includes shadow tokens like `shadow-[0_4px_12px_#000]`.
        //
        // Caught:
        //   bg-[#3a5a78]   text-[rgb(0,0,0)]   border-[hsl(...)]
        //   fill-[#fff]    stroke-[#000]       ring-[--weird]
        //   shadow-[0_4px...]  from-[#fff]    to-[#000]   via-[#abc]
        //   outline-[#abc]  gradient-...[#abc]
        //
        // Allowed (not in colour/shadow prefix list):
        //   text-[9px]   w-[180px]   h-[200px]
        //   w-[--radix-popover-trigger-width]
        //
        // Pattern: <colour prefix>-[ ...anything containing #/rgb/hsl/--... ]
        selector:
          'Literal[value=/\\b(?:bg|text|border|ring|fill|stroke|outline|from|to|via|shadow|placeholder|caret|decoration|accent)-[\\[][^\\]]*(?:#[0-9a-fA-F]|rgb\\(|hsl\\(|--[a-zA-Z])[^\\]]*\\]/]',
        message:
          "Tailwind arbitrary colour/shadow value detected (e.g. bg-[#3a5a78], text-[rgb(0,0,0)], shadow-[0_4px_12px_#000]). " +
          "Add a token to packages/ui/src/styles/globals.css and use its semantic name " +
          "(bg-primary, text-foreground, etc.). See packages/ui/DESIGN_TOKENS.md.",
      },
    ],
  },
}

/** Allow `_`-prefixed vars/args to be intentionally unused */
const unusedVarsRule = {
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
  },
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ── Architectural boundary rules ──
  ...featureRules,
  libLayerRules,
  hooksLayerRules,
  iconLibraryRules,
  nativeDateInputRules,
  designTokensRules,
  unusedVarsRule,
  reactCompilerRule,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
