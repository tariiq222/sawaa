#!/usr/bin/env node

/**
 * Static release guard for the WhatsApp retirement boundary.
 *
 * This is intentionally a source-level guard. Historical Prisma schema,
 * migrations, tests, and operational documentation are allowed to mention
 * WhatsApp; executable registrations and visible product mounts are not.
 * Task 1 records the current RED result. Later cleanup tasks turn it GREEN.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootFlagIndex = process.argv.indexOf("--root");
const root = rootFlagIndex >= 0 && process.argv[rootFlagIndex + 1]
  ? path.resolve(process.argv[rootFlagIndex + 1])
  : process.cwd();

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);

const allowedPathParts = [
  "/prisma/migrations/",
  "/prisma/schema/",
  "/docs/",
  "/.superpowers/",
  "/scripts/check-whatsapp-runtime-disabled.mjs",
];

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);
const configExtensions = new Set(["", ".env", ".example", ".yml", ".yaml"]);

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function isAllowed(relative) {
  const normalized = `/${relative.replaceAll(path.sep, "/")}`;
  return allowedPathParts.some((part) => normalized.includes(part));
}

function isTestFile(relative) {
  return /(?:^|[./])[^/]+\.(?:spec|test)\.[cm]?[jt]sx?$/.test(relative);
}

const prohibited = [
  {
    name: "backend module registration/import",
    roots: ["apps/backend/src"],
    pattern: /(?:WhatsappModule|modules\/integrations\/whatsapp|modules\/whatsapp-agent|infrastructure\/whatsapp)/i,
  },
  {
    name: "backend WhatsApp controller or webhook mount",
    roots: ["apps/backend/src"],
    pattern: /@Controller\s*\(\s*["'`]?(?:dashboard\/whatsapp|dashboard\/integrations\/whatsapp|public\/whatsapp)/i,
  },
  {
    name: "legacy WhatsApp runtime environment",
    roots: [".env.example", "apps/backend/.env.example", "apps/backend/.env.prod.example", "docker", ".github"],
    pattern: /\bWHATSAPP_(?:EVOLUTION|PROVIDER|SESSION|AI_|MAX_|RATE_LIMIT)/,
  },
  {
    name: "CSRF exemption for retired WhatsApp webhook",
    roots: ["apps/backend/src/main.ts"],
    pattern: /\/api\/v1\/public\/whatsapp/i,
  },
  {
    name: "dashboard translation import residue",
    roots: ["apps/dashboard/lib/translations.ts"],
    pattern: /(?:enWhatsapp|arWhatsapp|translations\/(?:en|ar)\.whatsapp)/,
  },
  {
    name: "generated API contract residue",
    roots: ["apps/dashboard/lib/types/api.generated.ts"],
    // Keep historical BookingSource/ClientSource enum values. Only retired
    // paths, operation ids, WhatsApp schema names, and CASL subject residue
    // are prohibited here.
    pattern: /(?:["'`]\/api\/v1\/(?:dashboard(?:\/integrations)?|public)\/whatsapp|operations\[["'`]Whatsapp[A-Za-z]|components\[["'`]schemas["'`]\]\[["'`]Whatsapp[A-Za-z]|["'`]WhatsappConversation["'`])/,
  },
  {
    name: "built-in authorization residue",
    roots: ["apps/backend/src/modules/identity/casl/built-in-rules.ts"],
    pattern: /WhatsappConversation/i,
  },
  {
    name: "WhatsApp historical deletion job",
    roots: ["apps/backend/src/modules/ops/cron-tasks/data-retention.cron.ts"],
    pattern: /(?:whatsapp(?:Message|Conversation)\.deleteMany|table:\s*["']Whatsapp(?:Message|Conversation))/i,
  },
  {
    name: "dashboard WhatsApp page or visible navigation",
    roots: ["apps/dashboard/app", "apps/dashboard/components", "apps/dashboard/lib"],
    pattern: /(?:["'`]\/whatsapp|nav\.whatsapp|whatsappconversation|features\/whatsapp|whatsapp-settings-content)/i,
  },
  {
    name: "mobile WhatsApp visible surface",
    roots: ["apps/mobile/app", "apps/mobile/components", "apps/mobile/i18n"],
    pattern: /(?:openWhatsapp|whatsapp\.title|whatsapp\.description|Contact us on WhatsApp|واتساب)/i,
  },
];

const files = walk(root);
const findings = [];

for (const file of files) {
  const relative = path.relative(root, file);
  if (isAllowed(relative) || isTestFile(relative)) continue;
  if (!sourceExtensions.has(path.extname(file)) && !configExtensions.has(path.extname(file))) continue;
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rule of prohibited) {
    if (!rule.roots.some((rootPrefix) => relative === rootPrefix || relative.startsWith(`${rootPrefix}/`))) continue;
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        rule.pattern.lastIndex = 0;
        findings.push(`${relative}:${index + 1} [${rule.name}] ${line.trim()}`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error(`WhatsApp runtime-disabled guard: RED (${findings.length} finding(s))`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log("WhatsApp runtime-disabled guard: GREEN");
}
