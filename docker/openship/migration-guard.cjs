"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DATABASE_QUERY = `
SELECT migration_name AS name, checksum, finished_at, rolled_back_at
FROM "_prisma_migrations"
`;

const APPROVED_STAGING_BASELINE = Object.freeze({
  "20260520134448_add_delivery_type_and_bundles": Object.freeze({
    dbChecksum: "",
    sourceChecksum: "778c3f29ceeaa9eb69275e105b169629e4750a0717f11ab2def95023887a661f",
  }),
  "20260520150000_finalize_delivery_type_transition": Object.freeze({
    dbChecksum: "",
    sourceChecksum: "077e3320b8de354f2664555a94b63bc65567b815fde9b90d9d9b519819d30942",
  }),
  "20260831120000_normalize_ai_provider_to_openrouter": Object.freeze({
    dbChecksum: "e53f354102abbefd20d5828c1909e9f58041a76565606a4d5b45eafc9e605aed",
    sourceChecksum: "0a5602c08b4c47c1b626ee308978f53f36f4ffdf81081c03566a2c87e8e5cbc1",
  }),
});

class MigrationGuardError extends Error {
  constructor(message, code = "migration-state-invalid") {
    super(message);
    this.name = "MigrationGuardError";
    this.code = code;
  }
}

function asChecksum(value) {
  if (value === null || value === undefined) return "";
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}

function isUnfinished(record) {
  return record.finished_at === null || record.finished_at === undefined || record.finished_at === "";
}

function duplicateNames(records) {
  const seen = new Set();
  const duplicates = new Set();
  for (const record of records) {
    if (seen.has(record.name)) duplicates.add(record.name);
    seen.add(record.name);
  }
  return [...duplicates].sort();
}

function formatNames(names) {
  return names.join(", ");
}

/**
 * Validate the source migration files against active database history.
 *
 * This function is deliberately pure: it performs no I/O and never changes a
 * checksum or migration record. `records` must contain only the four columns
 * selected by DATABASE_QUERY, and `sourceMigrations` contains hashes computed
 * from migration.sql bytes.
 */
function validate({ records, sourceMigrations, nodeEnv = "production" }) {
  if (!Array.isArray(records) || !Array.isArray(sourceMigrations)) {
    throw new MigrationGuardError("Migration guard received invalid history data.");
  }
  if (records.length === 0 || sourceMigrations.length === 0) {
    throw new MigrationGuardError("Migration guard received empty migration history.");
  }

  const activeRecords = records.filter((record) => record.rolled_back_at === null || record.rolled_back_at === undefined);
  const duplicateActive = duplicateNames(activeRecords);
  if (duplicateActive.length > 0) {
    throw new MigrationGuardError(`Duplicate active migration names: ${formatNames(duplicateActive)}.`);
  }

  const duplicateSource = duplicateNames(sourceMigrations);
  if (duplicateSource.length > 0) {
    throw new MigrationGuardError(`Duplicate source migration names: ${formatNames(duplicateSource)}.`);
  }

  const unfinished = activeRecords.filter(isUnfinished).map((record) => record.name).sort();
  if (unfinished.length > 0) {
    throw new MigrationGuardError(`Unfinished migrations: ${formatNames(unfinished)}.`);
  }

  const sourceByName = new Map(sourceMigrations.map((migration) => [migration.name, migration]));
  const activeByName = new Map(activeRecords.map((record) => [record.name, record]));
  const sourceOnly = [...sourceByName.keys()].filter((name) => !activeByName.has(name)).sort();
  const appliedOnly = [...activeByName.keys()].filter((name) => !sourceByName.has(name)).sort();
  if (sourceOnly.length > 0) {
    throw new MigrationGuardError(`Source migrations are unapplied: ${formatNames(sourceOnly)}.`);
  }
  if (appliedOnly.length > 0) {
    throw new MigrationGuardError(`Database migrations are absent from source: ${formatNames(appliedOnly)}.`);
  }

  const mismatches = [];
  for (const [name, record] of activeByName) {
    const sourceChecksum = asChecksum(sourceByName.get(name).checksum);
    const dbChecksum = asChecksum(record.checksum);
    if (dbChecksum === sourceChecksum) continue;

    const approved = APPROVED_STAGING_BASELINE[name];
    const isApprovedStagingMismatch =
      nodeEnv === "staging" &&
      approved &&
      dbChecksum === approved.dbChecksum &&
      sourceChecksum === approved.sourceChecksum;
    if (!isApprovedStagingMismatch) mismatches.push(name);
  }
  if (mismatches.length > 0) {
    throw new MigrationGuardError(`Migration checksums differ: ${formatNames(mismatches.sort())}.`);
  }

  return { ok: true, migrationCount: sourceMigrations.length };
}

function readSourceMigrations(backendRoot = process.cwd()) {
  const migrationsRoot = path.join(backendRoot, "prisma", "migrations");
  let entries;
  try {
    entries = fs.readdirSync(migrationsRoot, { withFileTypes: true });
  } catch {
    throw new MigrationGuardError("Migration guard could not read source migration files.", "source-unavailable");
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const migrationSql = path.join(migrationsRoot, entry.name, "migration.sql");
      try {
        const bytes = fs.readFileSync(migrationSql);
        return {
          name: entry.name,
          checksum: crypto.createHash("sha256").update(bytes).digest("hex"),
        };
      } catch {
        throw new MigrationGuardError("Migration guard could not read source migration files.", "source-unavailable");
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function readDatabaseHistory(databaseUrl) {
  if (!databaseUrl) {
    throw new MigrationGuardError("Migration guard database check failed.", "database-unavailable");
  }

  let Client;
  try {
    ({ Client } = require("pg"));
  } catch {
    throw new MigrationGuardError("Migration guard database check failed.", "database-unavailable");
  }
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    statement_timeout: 5000,
  });
  let transactionStarted = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("SET TRANSACTION READ ONLY");
    const result = await client.query(DATABASE_QUERY);
    await client.query("COMMIT");
    transactionStarted = false;
    return result.rows;
  } catch {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The original failure is intentionally reported generically.
      }
    }
    throw new MigrationGuardError("Migration guard database check failed.", "database-unavailable");
  } finally {
    try {
      await client.end();
    } catch {
      // Do not expose connection details in startup logs.
    }
  }
}

async function runGuard({ backendRoot = process.cwd(), databaseUrl = process.env.DATABASE_URL, nodeEnv = process.env.NODE_ENV } = {}) {
  const sourceMigrations = readSourceMigrations(backendRoot);
  const records = await readDatabaseHistory(databaseUrl);
  return validate({ records, sourceMigrations, nodeEnv });
}

if (require.main === module) {
  runGuard()
    .then(() => {
      process.stdout.write("Migration guard passed.\n");
    })
    .catch((error) => {
      if (error && error.code === "migration-state-invalid") {
        process.stderr.write(`Migration guard rejected startup: ${error.message}\n`);
      } else {
        process.stderr.write("Migration guard failed; startup aborted.\n");
      }
      process.exitCode = 1;
    });
}

module.exports = {
  APPROVED_STAGING_BASELINE,
  DATABASE_QUERY,
  MigrationGuardError,
  readSourceMigrations,
  runGuard,
  validate,
};
