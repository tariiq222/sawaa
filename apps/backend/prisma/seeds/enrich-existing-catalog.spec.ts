import { enrichExistingCatalog } from './enrich-existing-catalog';

const getBucketPolicy = jest.fn();
const setBucketPolicy = jest.fn();
const putObject = jest.fn();
jest.mock('node:fs/promises', () => ({ readFile: jest.fn(async () => Buffer.from('test-image')) }));
jest.mock('minio', () => ({ Client: jest.fn().mockImplementation(() => ({ getBucketPolicy, setBucketPolicy, putObject })) }));

function database() {
  const table = () => ({ findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) });
  return { file: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) }, serviceCategory: table(), service: table(), employee: table(), packageFamily: table(), sessionPackage: table(), program: table() };
}

describe('demo catalog enrichment safeguards', () => {
  const previousEnv = process.env;
  beforeEach(() => {
    process.env = { ...previousEnv };
    for (const key of ['MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_USE_SSL', 'MINIO_PUBLIC_ENDPOINT', 'MINIO_PUBLIC_PORT', 'MINIO_PUBLIC_USE_SSL']) delete process.env[key];
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => { process.env = previousEnv; jest.restoreAllMocks(); });

  it.each(['employee', 'packageFamily', 'sessionPackage'] as const)('preserves authored localized content for %s', async (model) => {
    const db = database();
    db[model].findFirst.mockResolvedValueOnce({ id: 'authored', publicBioAr: 'Authored Arabic', publicBioEn: 'Authored English', descriptionAr: 'Authored Arabic', descriptionEn: 'Authored English' });
    await enrichExistingCatalog(db as never);
    const update = db[model].update.mock.calls[0][0].data;
    expect(update).not.toHaveProperty(model === 'employee' ? 'publicBioAr' : 'descriptionAr');
    expect(update).not.toHaveProperty(model === 'employee' ? 'publicBioEn' : 'descriptionEn');
  });

  it.each(['employee', 'packageFamily', 'sessionPackage'] as const)('fills each missing locale independently for %s', async (model) => {
    const db = database();
    db[model].findFirst.mockResolvedValueOnce({ id: 'empty', publicBioAr: null, publicBioEn: 'Authored English', descriptionAr: '', descriptionEn: 'Authored English' });
    await enrichExistingCatalog(db as never);
    const update = db[model].update.mock.calls[0][0].data;
    expect(update[model === 'employee' ? 'publicBioAr' : 'descriptionAr']).toEqual(expect.any(String));
    expect(update).not.toHaveProperty(model === 'employee' ? 'publicBioEn' : 'descriptionEn');
  });

  function enableStorage() {
    Object.assign(process.env, { MINIO_ENDPOINT: 'localhost', MINIO_BUCKET: 'demo', MINIO_ACCESS_KEY: 'test', MINIO_SECRET_KEY: 'test' });
  }
  it('preserves unrelated policy statements and metadata when adding demo access', async () => {
    enableStorage();
    const existing = { Version: '2012-10-17', Id: 'custom', Statement: [{ Sid: 'PrivateUploads', Effect: 'Deny', Principal: '*', Action: 's3:GetObject', Resource: 'arn:aws:s3:::demo/private/*' }] };
    getBucketPolicy.mockResolvedValue(JSON.stringify(existing));
    await enrichExistingCatalog(database() as never);
    const saved = JSON.parse(setBucketPolicy.mock.calls[0][1]);
    expect(saved.Id).toBe('custom');
    expect(saved.Statement).toContainEqual(existing.Statement[0]);
    expect(saved.Statement).toContainEqual(expect.objectContaining({ Effect: 'Allow', Resource: ['arn:aws:s3:::demo/demo-catalog/*'] }));
  });
  it('does not replace a policy when its current value cannot be read', async () => {
    enableStorage(); getBucketPolicy.mockRejectedValue(new Error('Access denied'));
    await enrichExistingCatalog(database() as never);
    expect(setBucketPolicy).not.toHaveBeenCalled();
  });
  it('creates demo access when the bucket has no policy', async () => {
    enableStorage(); getBucketPolicy.mockRejectedValue(Object.assign(new Error('Missing'), { code: 'NoSuchBucketPolicy' }));
    await enrichExistingCatalog(database() as never);
    expect(JSON.parse(setBucketPolicy.mock.calls[0][1]).Statement).toHaveLength(1);
  });
  it('does not append duplicate demo access on reruns', async () => {
    enableStorage(); getBucketPolicy.mockResolvedValue('');
    await enrichExistingCatalog(database() as never);
    getBucketPolicy.mockResolvedValue(setBucketPolicy.mock.calls[0][1]);
    await enrichExistingCatalog(database() as never);
    expect(JSON.parse(setBucketPolicy.mock.calls.at(-1)![1]).Statement).toHaveLength(1);
  });
  it.each([
    [{ MINIO_ENDPOINT: 'minio-internal', MINIO_PUBLIC_ENDPOINT: 'cdn.example.test', MINIO_PUBLIC_USE_SSL: 'true' }, 'https://cdn.example.test/demo/'],
    [{ MINIO_ENDPOINT: 'minio-internal', MINIO_PUBLIC_ENDPOINT: 'cdn.example.test', MINIO_PUBLIC_PORT: '8443', MINIO_PUBLIC_USE_SSL: 'true' }, 'https://cdn.example.test:8443/demo/'],
    [{ MINIO_ENDPOINT: 'minio-internal', MINIO_PUBLIC_ENDPOINT: 'cdn.example.test', MINIO_USE_SSL: 'true' }, 'http://cdn.example.test/demo/'],
    [{ MINIO_ENDPOINT: 'storage.example.test', MINIO_PORT: '9443', MINIO_USE_SSL: 'true' }, 'https://storage.example.test:9443/demo/'],
  ])('builds employee image URLs using the existing public storage contract: %j', async (settings, prefix) => {
    enableStorage();
    Object.assign(process.env, settings);
    getBucketPolicy.mockResolvedValue('');
    const db = database();
    db.employee.findFirst.mockResolvedValueOnce({ id: 'employee-demo' });
    await enrichExistingCatalog(db as never);
    expect(db.employee.update.mock.calls[0][0].data.publicImageUrl).toMatch(new RegExp(`^${prefix}demo-catalog/[a-f0-9]+\\.png$`));
  });

});
