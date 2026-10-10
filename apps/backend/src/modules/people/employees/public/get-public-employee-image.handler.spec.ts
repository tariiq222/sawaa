import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ResolveEmployeeImageHandler } from '../../../media/files/resolve-employee-image.handler';
import { GetPublicEmployeeImageHandler } from './get-public-employee-image.handler';

describe('GetPublicEmployeeImageHandler', () => {
  const findFirst = jest.fn();
  const resolve = jest.fn();
  const handler = new GetPublicEmployeeImageHandler({ employee: { findFirst } } as unknown as PrismaService, { execute: resolve } as unknown as ResolveEmployeeImageHandler);
  beforeEach(() => { jest.clearAllMocks(); });
  it('looks up only active published staff and resolves the selected public image', async () => {
    findFirst.mockResolvedValue({ id: 'e1', publicImageUrl: 'old.jpg' });
    resolve.mockResolvedValue('https://files.test/signed');
    expect(await handler.execute('khalid')).toBe('https://files.test/signed');
    expect(findFirst.mock.calls[0][0].where).toEqual({ slug: 'khalid', isPublic: true, isActive: true });
    expect(resolve).toHaveBeenCalledWith({ employeeId: 'e1', reference: 'old.jpg' });
  });
  it('returns 404 without resolving files for hidden, inactive or missing staff', async () => {
    findFirst.mockResolvedValue(null);
    await expect(handler.execute('hidden')).rejects.toBeInstanceOf(NotFoundException);
    expect(resolve).not.toHaveBeenCalled();
  });
  it('returns 404 for an unresolved selected image', async () => {
    findFirst.mockResolvedValue({ id: 'e1', publicImageUrl: 'missing.jpg' });
    resolve.mockResolvedValue(null);
    await expect(handler.execute('e1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
