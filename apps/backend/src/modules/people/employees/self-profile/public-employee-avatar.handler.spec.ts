import { NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { PublicEmployeeAvatarHandler } from './public-employee-avatar.handler';

function fixture() {
  const url = 'https://staging.example.com/api/v1/public/employees/images/file-id';
  const file = { id: 'file-id', uploadedBy: 'u', ownerId: 'e', ownerType: 'employee', visibility: 'PUBLIC', isDeleted: false, mimetype: 'image/png', bucket: 'b', storageKey: 'k', size: 3 };
  const employee = { id: 'e', userId: 'u', isActive: true, avatarUrl: url, publicImageUrl: url };
  const user = { id: 'u', isActive: true, role: 'EMPLOYEE' };
  const db = {
    file: { findFirst: jest.fn(async ({ where }) => file.visibility === where.visibility && file.ownerType === where.ownerType && file.isDeleted === where.isDeleted ? file : null) },
    employee: { findFirst: jest.fn(async () => employee.isActive ? employee : null) },
    user: { findUnique: jest.fn(async () => user) },
  };
  const storage = { getFileStream: jest.fn(async () => Readable.from(Buffer.from('png'))) };
  const handler = new PublicEmployeeAvatarHandler(db as never, storage as never, { get: () => 'https://staging.example.com' } as never);
  return { handler, file, employee, user, storage };
}
describe('Public current employee image', () => {
  it('streams only the current explicitly public employee image from internal storage', async () => {
    const f = fixture();
    const result = await f.handler.execute('file-id');
    expect(result.mimetype).toBe('image/png');
    expect(f.storage.getFileStream).toHaveBeenCalledWith('b', 'k');
  });
  it.each(['private', 'deleted', 'other-owner', 'document', 'inactive-user', 'inactive-employee', 'replaced', 'removed'])('does not expose %s files', async scenario => {
    const f = fixture();
    if (scenario === 'private') f.file.visibility = 'PRIVATE';
    if (scenario === 'deleted') f.file.isDeleted = true;
    if (scenario === 'other-owner') f.file.ownerId = 'other';
    if (scenario === 'document') f.file.mimetype = 'application/pdf';
    if (scenario === 'inactive-user') f.user.isActive = false;
    if (scenario === 'inactive-employee') f.employee.isActive = false;
    if (scenario === 'replaced') f.employee.publicImageUrl = 'new';
    if (scenario === 'removed') f.employee.avatarUrl = '';
    await expect(f.handler.execute('file-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(f.storage.getFileStream).not.toHaveBeenCalled();
  });
  it('returns not found for a missing object without returning an internal storage URL', async () => {
    const f = fixture();
    f.storage.getFileStream.mockRejectedValue(Object.assign(new Error('missing'), { code: 'NoSuchKey' }));
    await expect(f.handler.execute('file-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
