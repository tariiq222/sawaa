import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guard for P1-17: the pgvector ANN index was never created in
 * production because it lived only in a post-migration hook
 * (`prisma/hooks/ensure_vector_indexes.sql`) invoked by the `prisma:migrate*`
 * npm scripts — but the production Dockerfile CMD runs `prisma migrate deploy`
 * directly, bypassing the npm wrapper. As a result `DocumentChunk.embedding`
 * fell back to a sequential scan on every semantic search.
 *
 * The fix encodes the index as a real, additive, idempotent migration so that
 * `prisma migrate deploy` always creates it. These tests fail if the migration
 * is removed, made non-idempotent, or if the Dockerfile stops running
 * `migrate deploy`.
 */
describe('pgvector ANN index is created by migration (P1-17)', () => {
  const prismaDir = __dirname;
  const migrationsDir = join(prismaDir, 'migrations');
  const indexName = 'DocumentChunk_embedding_cosine_idx';

  function findMigrationCreatingIndex(): string {
    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dir of dirs) {
      const sqlPath = join(migrationsDir, dir, 'migration.sql');
      let sql: string;
      try {
        sql = readFileSync(sqlPath, 'utf8');
      } catch {
        continue;
      }
      if (
        sql.includes(indexName) &&
        /create\s+index/i.test(sql) &&
        /ivfflat/i.test(sql)
      ) {
        return sql;
      }
    }
    throw new Error(
      `No migration creates the "${indexName}" ivfflat index. ` +
        'The pgvector ANN index must live in a migration so ' +
        '`prisma migrate deploy` (the production entrypoint) creates it.',
    );
  }

  it('a migration creates the ivfflat cosine index for DocumentChunk.embedding', () => {
    const sql = findMigrationCreatingIndex();
    expect(sql).toMatch(/ivfflat\s*\(\s*embedding\s+vector_cosine_ops\s*\)/i);
  });

  it('the index migration is idempotent (IF NOT EXISTS)', () => {
    const sql = findMigrationCreatingIndex();
    expect(sql).toMatch(/create\s+index\s+if\s+not\s+exists/i);
  });

  it('the migration index definition matches the redundant hook definition', () => {
    const migrationSql = findMigrationCreatingIndex();
    const hookSql = readFileSync(
      join(prismaDir, 'hooks', 'ensure_vector_indexes.sql'),
      'utf8',
    );

    const normalize = (sql: string) =>
      sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    expect(normalize(migrationSql)).toContain(
      normalize(
        `CREATE INDEX IF NOT EXISTS "${indexName}" ON "DocumentChunk" ` +
          'USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);',
      ),
    );
    expect(normalize(hookSql)).toContain(
      normalize(
        `CREATE INDEX IF NOT EXISTS "${indexName}" ON "DocumentChunk" ` +
          'USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);',
      ),
    );
  });

  it('the production Dockerfile CMD runs prisma migrate deploy', () => {
    const dockerfile = readFileSync(
      join(prismaDir, '..', 'Dockerfile'),
      'utf8',
    );
    // The top-level CMD instruction starts at column 0. The HEALTHCHECK
    // instruction also contains a "CMD" keyword but is indented, so anchor on
    // a line-start CMD only.
    const cmdLine = dockerfile
      .split('\n')
      .find((line) => /^CMD\b/.test(line));

    expect(cmdLine).toBeDefined();
    expect(cmdLine).toMatch(/prisma\s+migrate\s+deploy/);
  });
});
