import { GetCategoryHandler } from './get-category.handler';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('GetCategoryHandler', () => {
  const prisma = { serviceCategory: { findFirst: jest.fn() } };
  const storage = { getSignedUrl: jest.fn().mockResolvedValue('signed-image') };
  const handler = new GetCategoryHandler(prisma as any, storage as any, {getOrThrow: () => 'media'} as any);
  beforeEach(() => jest.clearAllMocks());
  it('finds a category beyond page 1 by its readable reference and signs its image', async () => {
    prisma.serviceCategory.findFirst.mockResolvedValue({id:'cat-120',ref:120,imageUrl:'images/clinic.png',department:null});
    const category = await handler.execute({categoryId:'CAT-120'});
    expect(prisma.serviceCategory.findFirst.mock.calls[0][0].where).toEqual({ref:120});
    expect(category.imageUrl).toBe('signed-image');
    expect(storage.getSignedUrl).toHaveBeenCalledWith('media','images/clinic.png',300);
  });
  it('queries exact UUID identity without paging through the list', async () => {
    const id='00000000-0000-4000-a000-000000000001';
    prisma.serviceCategory.findFirst.mockResolvedValue({id,imageUrl:null});
    expect((await handler.execute({categoryId:id})).id).toBe(id);
    expect(prisma.serviceCategory.findFirst.mock.calls[0][0].where).toEqual({id});
  });
  it('rejects missing and malformed identifiers without fallback records', async () => {
    prisma.serviceCategory.findFirst.mockResolvedValue(null);
    await expect(handler.execute({categoryId:'CAT-999'})).rejects.toBeInstanceOf(NotFoundException);
    await expect(handler.execute({categoryId:'wrong'})).rejects.toBeInstanceOf(BadRequestException);
  });
});
