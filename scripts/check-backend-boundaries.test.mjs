import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = path.resolve("scripts/check-backend-boundaries.mjs");

const SCHEMAS = {
  "bookings.prisma": "model Booking {\n  id String @id\n}\n",
  "finance.prisma": "model Invoice {\n  id String @id\n}\n",
  "ops.prisma": "model ActivityLog {\n  id String @id\n}\nmodel OutboxEvent {\n  id String @id\n}\n",
};

async function makeRoot(files = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sawaa-boundaries-"));
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "apps/backend/prisma/schema"), { recursive: true });
  for (const [name, text] of Object.entries(SCHEMAS)) {
    await writeFile(path.join(root, "apps/backend/prisma/schema", name), text);
  }
  await put(root, {
    "modules/bookings/book.service.ts": "export class BookService {}\n",
    "modules/finance/invoice.service.ts": "export class InvoiceService {}\n",
    ...files,
  });
  return root;
}

async function put(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(root, "apps/backend/src", rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, text);
  }
}

function run(root, ...extra) {
  return spawnSync(process.execPath, [script, "--root", root, ...extra], { encoding: "utf8" });
}

async function withRoot(files, fn) {
  const root = await makeRoot(files);
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const IMPORT_FINANCE = "import { InvoiceService } from '../finance/invoice.service'\n";
const WRITE_INVOICE = "export const f = (tx: any) => tx.invoice.create({ data: {} })\n";

test("passes when the tree matches the baseline", async () => {
  await withRoot({ "modules/bookings/uses-finance.ts": IMPORT_FINANCE, "modules/bookings/writes.ts": WRITE_INVOICE }, async (root) => {
    assert.equal(run(root, "--write-baseline").status, 0);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /match the baseline/);
    assert.match(result.stdout, /cross-cluster Prisma write call sites: 1/);
  });
});

test("fails on a new import edge between modules", async () => {
  await withRoot({}, async (root) => {
    assert.equal(run(root, "--write-baseline").status, 0);
    await put(root, { "modules/bookings/uses-finance.ts": IMPORT_FINANCE });
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /import bookings -> finance \(apps\/backend\/src\/modules\/bookings\/uses-finance\.ts\)/);
  });
});

test("fails on a new cross-cluster Prisma write", async () => {
  await withRoot({}, async (root) => {
    assert.equal(run(root, "--write-baseline").status, 0);
    await put(root, { "modules/bookings/writes.ts": WRITE_INVOICE });
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /write bookings -> finance\.invoice/);
  });
});

test("fails on a stale baseline entry", async () => {
  await withRoot({ "modules/bookings/uses-finance.ts": IMPORT_FINANCE }, async (root) => {
    assert.equal(run(root, "--write-baseline").status, 0);
    await put(root, { "modules/bookings/uses-finance.ts": "export const x = 1\n" });
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stale/);
    assert.match(result.stderr, /- import bookings -> finance/);
  });
});

test("ignores spec, test and __mocks__ files", async () => {
  await withRoot({}, async (root) => {
    assert.equal(run(root, "--write-baseline").status, 0);
    await put(root, {
      "modules/bookings/a.spec.ts": IMPORT_FINANCE + WRITE_INVOICE,
      "modules/bookings/b.test.ts": IMPORT_FINANCE + WRITE_INVOICE,
      "modules/bookings/__mocks__/c.ts": IMPORT_FINANCE + WRITE_INVOICE,
    });
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("allows activityLog and outboxEvent writes from any module", async () => {
  await withRoot({}, async (root) => {
    assert.equal(run(root, "--write-baseline").status, 0);
    await put(root, {
      "modules/bookings/audit.ts":
        "export const f = (tx: any) => { tx.activityLog.create({ data: {} }); this.prisma.outboxEvent.createMany({ data: [] }) }\n",
    });
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /shared allowed activityLog\/outboxEvent: 2/);
  });
});

test("reads and writes within the owning module are not coupling", async () => {
  await withRoot({}, async (root) => {
    assert.equal(run(root, "--write-baseline").status, 0);
    await put(root, {
      "modules/finance/own.ts": "import { InvoiceService } from './invoice.service'\nexport const f = (tx: any) => tx.invoice.update({})\n",
      "modules/bookings/reads.ts": "export const f = (tx: any) => tx.invoice.findMany({})\n",
    });
    assert.equal(run(root).status, 0);
  });
});

test("reports reverse-layer imports and fails when a new one appears", async () => {
  await withRoot({}, async (root) => {
    assert.equal(run(root, "--write-baseline").status, 0);
    await put(root, { "common/guards/g.ts": "import { X } from '../../modules/finance/invoice.service'\n" });
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /layer common -> modules\/finance/);
  });
});

test("fails clearly when the baseline is missing", async () => {
  await withRoot({}, async (root) => {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /baseline is missing or invalid/);
  });
});
