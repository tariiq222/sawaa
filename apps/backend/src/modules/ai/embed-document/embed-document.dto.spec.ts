import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmbedDocumentDto } from './embed-document.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(EmbedDocumentDto, plain);
  return validate(dto);
}

describe('EmbedDocumentDto', () => {
  const valid: Record<string, unknown> = {
    title: 'Clinic Services Overview',
    content: 'We offer dental, physiotherapy, and general medicine services.',
    sourceType: 'manual',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional sourceRef and metadata', async () => {
    const errors = await validateDto({
      ...valid,
      sourceRef: 'https://example.com/services',
      metadata: { language: 'ar' },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts sourceType = "url"', async () => {
    const errors = await validateDto({ ...valid, sourceType: 'url' });
    expect(errors).toHaveLength(0);
  });

  it('accepts sourceType = "file"', async () => {
    const errors = await validateDto({ ...valid, sourceType: 'file' });
    expect(errors).toHaveLength(0);
  });

  it('rejects sourceType outside the allowed enum', async () => {
    const errors = await validateDto({ ...valid, sourceType: 'database' });
    expect(errors.some((e) => e.property === 'sourceType')).toBe(true);
  });

  it('rejects a missing title', async () => {
    const errors = await validateDto({ content: valid.content, sourceType: valid.sourceType });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects an empty title', async () => {
    const errors = await validateDto({ ...valid, title: '' });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects a missing content', async () => {
    const errors = await validateDto({ title: valid.title, sourceType: valid.sourceType });
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });

  it('rejects an empty content', async () => {
    const errors = await validateDto({ ...valid, content: '' });
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });

  it('rejects a missing sourceType', async () => {
    const errors = await validateDto({ title: valid.title, content: valid.content });
    expect(errors.some((e) => e.property === 'sourceType')).toBe(true);
  });

  it('rejects metadata that is not an object', async () => {
    const errors = await validateDto({ ...valid, metadata: 'meta' });
    expect(errors.some((e) => e.property === 'metadata')).toBe(true);
  });
});
