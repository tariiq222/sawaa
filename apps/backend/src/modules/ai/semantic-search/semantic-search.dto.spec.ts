import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SemanticSearchDto } from './semantic-search.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SemanticSearchDto, plain);
  return validate(dto);
}

describe('SemanticSearchDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await validateDto({ query: 'What are the clinic opening hours?' });
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional topK within range', async () => {
    const errors = await validateDto({ query: 'hours', topK: 5 });
    expect(errors).toHaveLength(0);
  });

  it('accepts topK at the Min(1) boundary', async () => {
    const errors = await validateDto({ query: 'hours', topK: 1 });
    expect(errors.some((e) => e.property === 'topK')).toBe(false);
  });

  it('accepts topK at the Max(50) boundary', async () => {
    const errors = await validateDto({ query: 'hours', topK: 50 });
    expect(errors.some((e) => e.property === 'topK')).toBe(false);
  });

  it('rejects topK < 1', async () => {
    const errors = await validateDto({ query: 'hours', topK: 0 });
    expect(errors.some((e) => e.property === 'topK')).toBe(true);
  });

  it('rejects topK > 50', async () => {
    const errors = await validateDto({ query: 'hours', topK: 51 });
    expect(errors.some((e) => e.property === 'topK')).toBe(true);
  });

  it('rejects a non-integer topK', async () => {
    const errors = await validateDto({ query: 'hours', topK: 2.5 });
    expect(errors.some((e) => e.property === 'topK')).toBe(true);
  });

  it('accepts a valid documentId filter', async () => {
    const errors = await validateDto({
      query: 'hours',
      documentId: '12345678-1234-4234-8234-123456789abc',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID documentId', async () => {
    const errors = await validateDto({ query: 'hours', documentId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'documentId')).toBe(true);
  });

  it('rejects an empty query', async () => {
    const errors = await validateDto({ query: '' });
    expect(errors.some((e) => e.property === 'query')).toBe(true);
  });

  it('rejects a missing query', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'query')).toBe(true);
  });
});
