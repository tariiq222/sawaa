import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { ResolveEmployeeImageHandler } from './resolve-employee-image.handler';

describe('ResolveEmployeeImageHandler', () => {
  const file = { bucket: 'deqah-v2', storageKey: 'org/upload.jpg' };
  const findFirst = jest.fn();
  const getSignedUrl = jest.fn();
  const handler = new ResolveEmployeeImageHandler(
    { file: { findFirst } } as unknown as PrismaService,
    { getSignedUrl } as unknown as MinioService,
    new ConfigService({ MINIO_BUCKET: 'deqah-v2', MINIO_ENDPOINT: 'minio', MINIO_PUBLIC_ENDPOINT: 'files.sawaa.sa' }),
  );
  beforeEach(() => { jest.clearAllMocks(); findFirst.mockResolvedValue(file); getSignedUrl.mockResolvedValue('https://files.sawaa.sa/signed'); });

  it.each(['old.jpg', 'org/upload.jpg', 'http://minio:9000/deqah-v2/org/upload.jpg'])('resolves owned image reference %s to a fresh signed URL', async reference => {
    expect(await handler.execute({ employeeId: 'e1', reference })).toBe('https://files.sawaa.sa/signed');
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ ownerType: 'employee', ownerId: 'e1', bucket: 'deqah-v2', mimetype: { in: ['image/jpeg', 'image/png', 'image/webp'] } });
    expect(getSignedUrl).toHaveBeenCalledWith('deqah-v2', 'org/upload.jpg', 300);
  });
  it('normalizes a signed display URL back to its persistent owned key', async () => {
    expect(await handler.execute({ employeeId: 'e1', reference: 'https://files.sawaa.sa/deqah-v2/org/upload.jpg?X-Amz-Signature=expired', format: 'key' } as never)).toBe('org/upload.jpg');
  });
  it('does not fall back to an older upload when the latest selected filename was deleted', async () => {
    findFirst.mockResolvedValue({ ...file, isDeleted: true });
    expect(await handler.execute({ employeeId: 'e1', reference: 'old.jpg' })).toBeNull();
    expect(findFirst.mock.calls[0][0].where).not.toHaveProperty('isDeleted');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it('matches a filename only inside the selected employee ownership scope', async () => {
    findFirst.mockResolvedValue(null);
    expect(await handler.execute({ employeeId: 'e1', reference: 'other-employee.jpg' })).toBeNull();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it('does not expose untracked internal or storage URLs', async () => {
    findFirst.mockResolvedValue(null);
    for (const reference of ['http://minio:9000/deqah-v2/private.pdf', 'https://files.sawaa.sa/deqah-v2/private.jpg']) {
      expect(await handler.execute({ employeeId: 'e1', reference })).toBeNull();
    }
  });
  it.each(['http:', 'https:'])('preserves an existing external %s portrait', async protocol => {
    findFirst.mockResolvedValue(null);
    expect(await handler.execute({ employeeId: 'e1', reference: `${protocol}//cdn.example.org/portrait.jpg` })).toBe(`${protocol}//cdn.example.org/portrait.jpg`);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it('returns null for no selected portrait without querying files', async () => {
    expect(await handler.execute({ employeeId: 'e1', reference: null })).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
