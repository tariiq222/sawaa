"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { APPROVED_STAGING_BASELINE, validate } = require("./migration-guard.cjs");

const exactName = "20260101000000_exact";
const exactChecksum = "a".repeat(64);

function source(name, checksum) {
  return { name, checksum };
}

function record(name, checksum, extra = {}) {
  return { name, checksum, finished_at: "2026-01-01T00:00:00.000Z", rolled_back_at: null, ...extra };
}

function assertRejected(input, message) {
  assert.throws(() => validate(input), new RegExp(message));
}

test("accepts an exact active database/source match", () => {
  assert.deepEqual(
    validate({
      records: [record(exactName, exactChecksum)],
      sourceMigrations: [source(exactName, exactChecksum)],
      nodeEnv: "production",
    }),
    { ok: true, migrationCount: 1 },
  );
});

test("accepts an approved restored-history mismatch only in staging", () => {
  const name = "20260520134448_add_delivery_type_and_bundles";
  const approved = APPROVED_STAGING_BASELINE[name];
  assert.doesNotThrow(() => validate({
    records: [record(name, approved.dbChecksum)],
    sourceMigrations: [source(name, approved.sourceChecksum)],
    nodeEnv: "staging",
  }));
});

test("rejects a changed source for an approved baseline migration", () => {
  const name = "20260520134448_add_delivery_type_and_bundles";
  const approved = APPROVED_STAGING_BASELINE[name];
  assertRejected({
    records: [record(name, approved.dbChecksum)],
    sourceMigrations: [source(name, "b".repeat(64))],
    nodeEnv: "staging",
  }, "Migration checksums differ");
});

test("rejects a new unapplied source migration", () => {
  assertRejected({
    records: [record(exactName, exactChecksum)],
    sourceMigrations: [source(exactName, exactChecksum), source("20260102000000_new", "b".repeat(64))],
    nodeEnv: "staging",
  }, "Source migrations are unapplied");
});

test("rejects an unfinished active migration", () => {
  assertRejected({
    records: [record(exactName, exactChecksum, { finished_at: null })],
    sourceMigrations: [source(exactName, exactChecksum)],
    nodeEnv: "staging",
  }, "Unfinished migrations");
});

test("rejects the approved mismatch outside staging", () => {
  const name = "20260520134448_add_delivery_type_and_bundles";
  const approved = APPROVED_STAGING_BASELINE[name];
  assertRejected({
    records: [record(name, approved.dbChecksum)],
    sourceMigrations: [source(name, approved.sourceChecksum)],
    nodeEnv: "production",
  }, "Migration checksums differ");
});
