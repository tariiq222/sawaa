import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateDocumentDto,
  ListDocumentsDto,
  UpdateDocumentDto,
} from './manage-knowledge-base.dto';

async function validateList(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListDocumentsDto, plain);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

async function validateUpdate(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateDocumentDto, plain);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

async function validateCreate(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateDocumentDto, plain);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

const validCreate: Record<string, unknown> = {
  title: 'Clinic services',
  sourceType: 'manual',
  content: 'نقدم جلسات استشارية أسرية حضورية وعن بعد.',
};

describe('CreateDocumentDto authoring contract', () => {
  it('accepts manual content as a draft', async () => {
    const errors = await validateCreate(validCreate);
    expect(errors).toHaveLength(0);
  });

  it('accepts a safe HTTPS URL source without requiring body content', async () => {
    const errors = await validateCreate({
      title: 'Services source',
      sourceType: 'url',
      sourceRef: 'https://sawaa.example/services',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts an explicit draft state but never accepts server timestamps', async () => {
    const errors = await validateCreate({ ...validCreate, isPublished: false });
    expect(errors).toHaveLength(0);
    const timestampErrors = await validateCreate({ ...validCreate, publishedAt: new Date() });
    expect(timestampErrors.some((error) => error.property === 'publishedAt')).toBe(true);
  });

  it('rejects content over the authoring limit', async () => {
    const errors = await validateCreate({ ...validCreate, content: 'x'.repeat(50_001) });
    expect(errors.some((error) => error.property === 'content')).toBe(true);
  });

  it('rejects raw HTML and script payloads', async () => {
    for (const content of ['<p>Services</p>', '<script>alert(1)</script>']) {
      const errors = await validateCreate({ ...validCreate, content });
      expect(errors.some((error) => error.property === 'content')).toBe(true);
    }
  });

  it('rejects unsupported source types and unsafe URL sources', async () => {
    const unsupported = await validateCreate({ ...validCreate, sourceType: 'file' });
    expect(unsupported.some((error) => error.property === 'sourceType')).toBe(true);
    const unsafe = await validateCreate({
      title: 'Unsafe',
      sourceType: 'url',
      sourceRef: 'http://localhost:5200/internal',
    });
    expect(unsafe.some((error) => error.property === 'sourceRef')).toBe(true);
  });

  it('allows public boundaries but rejects private, reserved, and special IPv4 ranges without DNS lookup', async () => {
    const allowed = ['172.15.0.1', '172.32.0.1'];
    const blocked = [
      '0.0.0.1', '10.0.0.1', '100.64.0.1', '100.127.255.254', '127.0.0.1',
      '169.254.1.1', '172.16.0.1', '172.31.255.254', '192.0.0.1', '192.0.2.1',
      '192.168.1.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1',
    ];
    for (const host of allowed) {
      const errors = await validateCreate({ title: host, sourceType: 'url', sourceRef: `https://${host}/info` });
      expect(errors.some((error) => error.property === 'sourceRef')).toBe(false);
    }
    for (const host of blocked) {
      const errors = await validateCreate({ title: host, sourceType: 'url', sourceRef: `https://${host}/info` });
      expect(errors.some((error) => error.property === 'sourceRef')).toBe(true);
    }
  });

  it('rejects loopback, link-local, ULA, multicast, documentation, and mapped-private IPv6', async () => {
    for (const host of ['::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1', '::ffff:192.168.1.1']) {
      const errors = await validateCreate({ title: host, sourceType: 'url', sourceRef: `https://[${host}]/info` });
      expect(errors.some((error) => error.property === 'sourceRef')).toBe(true);
    }
  });

  it('rejects non-HTTPS schemes, credentials, and internal hostnames', async () => {
    for (const sourceRef of [
      'http://example.com/info', 'https://user:pass@example.com/info', 'javascript:alert(1)',
      'data:text/plain,hello', 'file:///etc/passwd', 'https://service.local/info', 'https://api.internal/info',
    ]) {
      const errors = await validateCreate({ title: sourceRef, sourceType: 'url', sourceRef });
      expect(errors.some((error) => error.property === 'sourceRef')).toBe(true);
    }
  });

  it('requires content for manual documents and sourceRef for URL documents', async () => {
    const manual = await validateCreate({ title: 'Missing body', sourceType: 'manual' });
    expect(manual.some((error) => error.property === 'content')).toBe(true);
    const url = await validateCreate({ title: 'Missing source', sourceType: 'url' });
    expect(url.some((error) => error.property === 'sourceRef')).toBe(true);
  });
});

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

  it('rejects server-owned publication and indexing fields', async () => {
    const errors = await validateUpdate({
      publishedAt: new Date(),
      lastIndexedAt: new Date(),
      lastIndexErrorCode: 'EMBEDDING_FAILED',
      contentHash: 'sha256:abc',
    });
    expect(errors.map((error) => error.property).sort()).toEqual([
      'contentHash', 'lastIndexErrorCode', 'lastIndexedAt', 'publishedAt',
    ]);
  });
});
