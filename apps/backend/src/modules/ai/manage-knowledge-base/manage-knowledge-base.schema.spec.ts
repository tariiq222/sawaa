import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('KnowledgeDocument authoring schema', () => {
  const schema = readFileSync(join(__dirname, '../../../../prisma/schema/ai.prisma'), 'utf8');

  it('declares publication and indexing state fields', () => {
    expect(schema).toMatch(/content\s+String\?/);
    expect(schema).toMatch(/isPublished\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/publishedAt\s+DateTime\?/);
    expect(schema).toMatch(/lastIndexedAt\s+DateTime\?/);
    expect(schema).toMatch(/lastIndexErrorCode\s+String\?/);
    expect(schema).toMatch(/contentHash\s+String\?/);
  });
});
