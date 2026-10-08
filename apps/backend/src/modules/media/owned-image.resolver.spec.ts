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
  // Hardening carried over from the removed normalizePublicImageUrl helper:
  // public surfaces (website next/image, mobile) only receive absolute http(s)
  // or root-relative URLs; anything else (bare legacy keys, script/data URIs)
  // becomes null so no consumer crashes or renders an unsafe source.
  it.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://example.com/photo.png', 'photo.jpg', ''])(
    'rejects a non-URL or unsafe image value %s', async (value) => {
      const { resolver, getSignedUrl } = setup();
      expect(await resolver.resolve('employee', 'employee-1', value)).toBeNull();
      expect(getSignedUrl).not.toHaveBeenCalled();
    },
  );
  it('keeps root-relative public assets unchanged', async () => {
    const { resolver } = setup();
    expect(await resolver.resolve('employee', 'employee-1', '/images/team/photo.webp')).toBe('/images/team/photo.webp');
  });
  it('keeps the mobile self-avatar public API URL so mobile photos keep resolving', async () => {
    const { resolver, getSignedUrl } = setup();
    const url = 'https://api.sawaa.sa/api/v1/public/employees/images/00000000-0000-4000-a000-000000000001';
    expect(await resolver.resolve('employee', 'employee-1', url)).toBe(url);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it('preserves external legacy images without signing unrelated storage', async () => {
    const { resolver, getSignedUrl } = setup();
    expect(await resolver.resolve('employee', 'employee-1', 'https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
