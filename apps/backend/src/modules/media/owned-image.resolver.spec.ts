import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { OwnedImageResolver } from './owned-image.resolver';

function setup() {
  const findFirst = jest.fn().mockResolvedValue(null);
  const getSignedUrl = jest.fn().mockResolvedValue('https://files.sawaa.sa/bucket/org/photo.png?signed=fresh');
  const resolver = new OwnedImageResolver(
    { file: { findFirst } } as unknown as PrismaService,
    { getSignedUrl } as unknown as MinioService,
    { get: () => 'bucket' } as unknown as ConfigService,
  );
  return { resolver, findFirst, getSignedUrl };
}

describe('OwnedImageResolver', () => {
  it.each(['org/photo.png', 'http://minio:9000/bucket/org/photo.png', 'https://files.sawaa.sa/bucket/org/photo.png?expired=true'])(
    'refreshes owned employee image %s instead of returning an internal or expired URL', async (value) => {
      const { resolver, findFirst, getSignedUrl } = setup();
      findFirst.mockResolvedValue({ storageKey: 'org/photo.png', bucket: 'bucket' });
      expect(await resolver.resolve('employee', 'employee-1', value)).toBe('https://files.sawaa.sa/bucket/org/photo.png?signed=fresh');
      expect(findFirst).toHaveBeenCalledWith({ where: {
        bucket: 'bucket', storageKey: 'org/photo.png', ownerType: 'employee', ownerId: 'employee-1',
        mimetype: { in: ['image/jpeg', 'image/png', 'image/webp'] },
      }, select: { storageKey: true, bucket: true } });
      expect(getSignedUrl).toHaveBeenCalledWith('bucket', 'org/photo.png', 300);
    },
  );
  it.each([null, 'old-photo.jpg', 'org/private-invoice.pdf', 'blob:local-preview', 'http://', 'http://minio:9000/bucket/org/not-owned.png'])(
    'does not expose an unresolved, private or temporary image %s', async (value) => {
      const { resolver, getSignedUrl } = setup();
      expect(await resolver.resolve('employee', 'employee-1', value)).toBeNull();
      expect(getSignedUrl).not.toHaveBeenCalled();
    },
  );
  it('preserves external legacy images without signing unrelated storage', async () => {
    const { resolver, getSignedUrl } = setup();
    expect(await resolver.resolve('employee', 'employee-1', 'https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
