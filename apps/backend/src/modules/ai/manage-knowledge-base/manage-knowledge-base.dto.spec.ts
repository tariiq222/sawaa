import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListDocumentsDto,
  UpdateDocumentDto,
} from './manage-knowledge-base.dto';

async function validateList(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListDocumentsDto, plain);
  return validate(dto);
}

async function validateUpdate(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateDocumentDto, plain);
  return validate(dto);
}

describe('ListDocumentsDto', () => {
  it('accepts an empty payload (no filters)', async () => {
    const errors = await validateList({});
    expect(errors).toHaveLength(0);
  });

  it('accepts PENDING as status', async () => {
    const errors = await validateList({ status: 'PENDING' });
    expect(errors).toHaveLength(0);
  });

  it('accepts EMBEDDED as status', async () => {
    const errors = await validateList({ status: 'EMBEDDED' });
    expect(errors).toHaveLength(0);
  });

  it('accepts FAILED as status', async () => {
    const errors = await validateList({ status: 'FAILED' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a status outside the enum', async () => {
    const errors = await validateList({ status: 'DELETED' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects a lowercase status', async () => {
    const errors = await validateList({ status: 'pending' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('accepts valid pagination', async () => {
    const errors = await validateList({ page: 1, limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('rejects limit > 200', async () => {
    const errors = await validateList({ limit: 201 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});

describe('UpdateDocumentDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateUpdate({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid title', async () => {
    const errors = await validateUpdate({ title: 'Clinic FAQ' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a title at the MaxLength(500) boundary', async () => {
    const errors = await validateUpdate({ title: 'a'.repeat(500) });
    expect(errors.some((e) => e.property === 'title')).toBe(false);
  });

  it('rejects a title longer than 500 chars', async () => {
    const errors = await validateUpdate({ title: 'a'.repeat(501) });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects a non-string title', async () => {
    const errors = await validateUpdate({ title: 12345 });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects metadata that is not an object', async () => {
    const errors = await validateUpdate({ metadata: 'not-an-object' });
    expect(errors.some((e) => e.property === 'metadata')).toBe(true);
  });

  it('accepts metadata as an empty object', async () => {
    const errors = await validateUpdate({ metadata: {} });
    expect(errors).toHaveLength(0);
  });
});
