import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = path.resolve("scripts/check-whatsapp-runtime-disabled.mjs");

function runGuard(root) {
  return spawnSync(process.execPath, [script, "--root", root], { encoding: "utf8" });
}

test("guard catches runtime registration, CSRF exemption, generated contract, and deletion job", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sawaa-whatsapp-guard-"));
  try {
    await mkdir(path.join(root, "apps/backend/src"), { recursive: true });
    await mkdir(path.join(root, "apps/backend/src/modules/identity/casl"), { recursive: true });
    await mkdir(path.join(root, "apps/backend/src/modules/ops/cron-tasks"), { recursive: true });
    await mkdir(path.join(root, "apps/dashboard/lib/types"), { recursive: true });
    await writeFile(path.join(root, "apps/backend/src/app.module.ts"), "imports: [WhatsappModule]");
    await writeFile(path.join(root, "apps/backend/src/main.ts"), "req.path.startsWith('/api/v1/public/whatsapp')");
    await writeFile(path.join(root, "apps/backend/src/modules/identity/casl/built-in-rules.ts"), "subject: 'WhatsappConversation'");
    await writeFile(path.join(root, "apps/backend/src/modules/ops/cron-tasks/data-retention.cron.ts"), "this.prisma.whatsappMessage.deleteMany({})");
    await writeFile(path.join(root, "apps/dashboard/lib/types/api.generated.ts"), '"/api/v1/public/whatsapp/webhook"\nBookingSource: "ONLINE" | "WHATSAPP"');
    const result = runGuard(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RED/);
    assert.match(result.stderr, /CSRF exemption/);
    assert.match(result.stderr, /generated API contract/);
    assert.match(result.stderr, /historical deletion job/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("guard allows preserved schema, migration, test, and documentation history", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sawaa-whatsapp-guard-"));
  try {
    await mkdir(path.join(root, "apps/backend/prisma/schema"), { recursive: true });
    await mkdir(path.join(root, "apps/backend/prisma/migrations/20260730000000_whatsapp"), { recursive: true });
    await mkdir(path.join(root, "apps/backend/src/modules/whatsapp-agent"), { recursive: true });
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, "apps/backend/prisma/schema/comms.prisma"), "model WhatsappConversation {}");
    await writeFile(path.join(root, "apps/backend/prisma/migrations/20260730000000_whatsapp/migration.sql"), "CREATE TABLE WhatsappMessage");
    await writeFile(path.join(root, "apps/backend/src/modules/whatsapp-agent/legacy.spec.ts"), "describe('WhatsappConversation', () => {})");
    await mkdir(path.join(root, "apps/dashboard/lib/types"), { recursive: true });
    await writeFile(path.join(root, "apps/dashboard/lib/types/api.generated.ts"), 'BookingSource: "ONLINE" | "WHATSAPP"\nClientSource: "WALK_IN" | "WHATSAPP"');
    await writeFile(path.join(root, "docs/cleanup.md"), "Preserve WHATSAPP historical values");
    const result = runGuard(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /GREEN/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
