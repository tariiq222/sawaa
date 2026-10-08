import { ChangeSelfAvatarHandler } from './self-avatar.handler';

function fixture() {
  const employee = { id: 'e', userId: 'u', isActive: true, avatarUrl: 'old', publicImageUrl: 'old' };
  const user = { id: 'u', isActive: true, avatarUrl: 'old' };
  const db = {
    employee: { findFirst: async ({ where }: { where: { userId: string } }) => where.userId === 'u' ? employee : null, update: async ({ data }: { data: object }) => Object.assign(employee, data) },
    user: { findUnique: async () => user, update: async ({ data }: { data: object }) => Object.assign(user, data) },
  };
  const upload = { execute: jest.fn(async () => ({ id: 'file-id', url: 'http://minio:9000/private-internal/new.png' })) };
  const transaction = { withTransaction: async (fn: (tx: typeof db) => unknown) => fn(db) };
  const config = { get: () => 'https://staging.example.com' };
  return { employee, user, upload, handler: new ChangeSelfAvatarHandler(db as never, transaction as never, upload as never, config as never) };
}
describe('Own employee avatar', () => {
  it('publishes an uploaded image consistently to the account and public profile', async () => {
    const f = fixture();
    await f.handler.execute('u', { originalname: 'photo.png', mimetype: 'image/png', size: 8, buffer: Buffer.alloc(8) });
    const publicUrl = 'https://staging.example.com/api/v1/public/employees/images/file-id';
    expect(f.employee.avatarUrl).toBe(publicUrl);
    expect(f.employee.publicImageUrl).toBe(publicUrl);
    expect(f.user.avatarUrl).toBe(publicUrl);
  });
  it('removes every displayed avatar without accepting a file URL', async () => {
    const f = fixture();
    await f.handler.execute('u', null);
    expect(f.employee.avatarUrl).toBeNull();
    expect(f.employee.publicImageUrl).toBeNull();
    expect(f.user.avatarUrl).toBeNull();
    expect(f.upload.execute).not.toHaveBeenCalled();
  });
  it('rejects an unrelated owner and oversized or non-image files before upload', async () => {
    const f = fixture();
    const file = { originalname: 'photo.png', mimetype: 'image/png', size: 8, buffer: Buffer.alloc(8) };
    await expect(f.handler.execute('other', file)).rejects.toThrow();
    await expect(f.handler.execute('u', { ...file, size: 1048577 })).rejects.toThrow();
    await expect(f.handler.execute('u', { ...file, mimetype: 'application/pdf' })).rejects.toThrow();
    expect(f.upload.execute).not.toHaveBeenCalled();
  });
});
