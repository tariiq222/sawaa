import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { ResolveEmployeeImageHandler } from './resolve-employee-image.handler';

describe('ResolveEmployeeImageHandler', () => {
  const file = { bucket: 'deqah-v2', storageKey: 'org/upload.jpg' };
  const findFirst = jest.fn();
  const getSignedUrl = jest.fn();
  const fileExists = jest.fn();
  const handler = new ResolveEmployeeImageHandler(
    { file: { findFirst } } as unknown as PrismaService,
    { getSignedUrl, fileExists } as unknown as MinioService,
    new ConfigService({ MINIO_BUCKET: 'deqah-v2', MINIO_ENDPOINT: 'minio', MINIO_PUBLIC_ENDPOINT: 'files.sawaa.sa' }),
  );
  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue(file);
    getSignedUrl.mockResolvedValue('https://files.sawaa.sa/signed');
    fileExists.mockResolvedValue(false);
  });

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
    expect(fileExists).not.toHaveBeenCalled();
  });
  it('matches a filename only inside the selected employee ownership scope', async () => {
    findFirst.mockResolvedValue(null);
    expect(await handler.execute({ employeeId: 'e1', reference: 'other-employee.jpg' })).toBeNull();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it.each([
    ['http://minio:9000/deqah-v2/private.pdf', 'private.pdf'],
    ['https://files.sawaa.sa/deqah-v2/private.jpg', 'private.jpg'],
  ])('does not expose the untracked storage URL %s', async (reference, key) => {
    findFirst.mockResolvedValue(null);
    fileExists.mockResolvedValue(false);
    expect(await handler.execute({ employeeId: 'e1', reference })).toBeNull();
    // The only probe is an existence check for that exact key; no URL is returned.
    expect(fileExists).toHaveBeenCalledWith('deqah-v2', key);
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

  describe('imported portraits that predate the file ledger', () => {
    const legacyReference = 'https://files.sawaa.sa/deqah-v2/00000000-0000-0000-0000-000000000001/photo.jpg';

    beforeEach(() => {
      // First lookup: no File row owns the reference. Second: nobody else claims the key.
      findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      fileExists.mockResolvedValue(true);
    });

    it('signs an object that exists in the bucket without a File row', async () => {
      expect(await handler.execute({ employeeId: 'e1', reference: legacyReference }))
        .toBe('https://files.sawaa.sa/signed');
      expect(fileExists).toHaveBeenCalledWith('deqah-v2', '00000000-0000-0000-0000-000000000001/photo.jpg');
      expect(getSignedUrl).toHaveBeenCalledWith(
        'deqah-v2', '00000000-0000-0000-0000-000000000001/photo.jpg', 300,
      );
    });

    it('returns the bare key in key format so callers can compare stored values', async () => {
      expect(await handler.execute({ employeeId: 'e1', reference: legacyReference, format: 'key' }))
        .toBe('00000000-0000-0000-0000-000000000001/photo.jpg');
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('never serves a key another staff member already owns', async () => {
      findFirst.mockReset();
      findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'someone-elses-file' });
      expect(await handler.execute({ employeeId: 'e1', reference: legacyReference })).toBeNull();
      expect(fileExists).not.toHaveBeenCalled();
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('stays null when the referenced object is not in the bucket', async () => {
      fileExists.mockResolvedValue(false);
      expect(await handler.execute({ employeeId: 'e1', reference: legacyReference })).toBeNull();
      expect(getSignedUrl).not.toHaveBeenCalled();
    });
  });
});
