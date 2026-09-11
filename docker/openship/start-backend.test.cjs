"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const SCRIPT = path.join(__dirname, "start-backend.sh");

function runStartup(options = {}) {
  const migrationUrl = Object.prototype.hasOwnProperty.call(options, "migrationUrl")
    ? options.migrationUrl
    : "postgresql://sawaa_owner:owner@postgres:5432/sawaa";
  const databaseUrl = options.databaseUrl || "postgresql://sawaa_app:runtime@postgres:5432/sawaa";
  const migrationExit = options.migrationExit || 0;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sawaa-start-backend-"));
  const bin = path.join(root, "bin");
  const log = path.join(root, "events.log");
  fs.mkdirSync(bin);
  const fakeNpx = `#!/bin/sh\nprintf 'migrate DATABASE_URL=%s MIGRATION_DATABASE_URL=%s ARGS=%s\\n' "${"$DATABASE_URL"}" "${"$MIGRATION_DATABASE_URL"}" "$*" >> "${log}"\nexit "${"$MIGRATION_EXIT"}"\n`;
  const fakeNode = `#!/bin/sh\nprintf 'app DATABASE_URL=%s MIGRATION_DATABASE_URL=%s ARGS=%s\\n' "${"$DATABASE_URL"}" "${"$MIGRATION_DATABASE_URL"}" "$*" >> "${log}"\n`;
  fs.writeFileSync(path.join(bin, "npx"), fakeNpx, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "node"), fakeNode, { mode: 0o755 });
  const env = {
    PATH: `${bin}:${process.env.PATH || ""}`,
    DATABASE_URL: databaseUrl,
    MIGRATION_EXIT: String(migrationExit),
  };
  if (migrationUrl !== undefined) env.MIGRATION_DATABASE_URL = migrationUrl;
  const result = spawnSync("/bin/sh", [SCRIPT], {
    cwd: path.dirname(SCRIPT),
    env,
    encoding: "utf8",
    timeout: 5000,
  });
  const events = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : [];
  fs.rmSync(root, { recursive: true, force: true });
  return { result, events };
}

test("runs migration before app with runtime URL restored and migration URL scrubbed", () => {
  const { result, events } = runStartup();
  assert.equal(result.status, 0);
  assert.equal(events.length, 2);
  assert.match(events[0], /^migrate DATABASE_URL=postgresql:\/\/sawaa_owner/);
  assert.match(events[0], /MIGRATION_DATABASE_URL= /);
  assert.match(events[0], /ARGS=--no-install prisma migrate deploy --schema=prisma\/schema$/);
  assert.match(events[1], /^app DATABASE_URL=postgresql:\/\/sawaa_app/);
  assert.match(events[1], /MIGRATION_DATABASE_URL= /);
});

test("halts before app when migration fails", () => {
  const { result, events } = runStartup({ migrationExit: 23 });
  assert.equal(result.status, 23);
  assert.equal(events.length, 1);
  assert.match(events[0], /^migrate /);
});

test("fails before migration when migration credential is absent", () => {
  const { result, events } = runStartup({ migrationUrl: undefined });
  assert.notEqual(result.status, 0);
  assert.equal(events.length, 0);
});
