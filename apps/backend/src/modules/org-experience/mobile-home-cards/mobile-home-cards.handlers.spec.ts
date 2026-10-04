import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateMobileHomeCardHandler } from './create-mobile-home-card.handler';
import { GetPublicMobileHomeCardsHandler } from './get-public-mobile-home-cards.handler';
import { ListMobileHomeCardsHandler } from './list-mobile-home-cards.handler';
import { ReorderMobileHomeCardsHandler } from './reorder-mobile-home-cards.handler';
import { UpdateMobileHomeCardHandler } from './update-mobile-home-card.handler';

const stamp = new Date('2026-09-27T00:00:00.000Z');
const card = {
  id: '00000000-0000-4000-8000-000000000001', titleAr: 'عنوان', titleEn: null, descriptionAr: null, descriptionEn: null,
  imageFileId: '00000000-0000-4000-8000-000000000101', imageAltAr: 'وصف الصورة', imageAltEn: null, destination: null,
  sortOrder: 0, isPublished: true, createdAt: stamp, updatedAt: stamp,
};

describe('mobile home card handlers', () => {
  it('rejects private or non-image files when attaching an image', async () => {
    const prisma = { file: { findFirst: jest.fn().mockResolvedValue({
      id: card.imageFileId, visibility: 'PRIVATE', isDeleted: false, mimetype: 'image/png',
    }) }, mobileHomeCard: { create: jest.fn() } };
    const handler = new CreateMobileHomeCardHandler(prisma as any, { getSignedUrl: jest.fn() } as any);
    await expect(handler.execute({
      titleAr: 'عنوان', imageFileId: card.imageFileId, imageAltAr: 'وصف الصورة',
    } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.mobileHomeCard.create).not.toHaveBeenCalled();
  });

  it('rejects deleted files and non-image public files when attaching an image', async () => {
    const file = { id: card.imageFileId, visibility: 'PUBLIC', isDeleted: true, mimetype: 'image/png' };
    const prisma: any = {
      file: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ ...file, isDeleted: false, mimetype: 'application/pdf' }) },
      mobileHomeCard: { create: jest.fn() },
    };
    const handler = new CreateMobileHomeCardHandler(prisma, { getSignedUrl: jest.fn() } as any);
    const body = { titleAr: 'عنوان', imageFileId: card.imageFileId, imageAltAr: 'وصف الصورة' };
    await expect(handler.execute(body as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(handler.execute(body as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.mobileHomeCard.create).not.toHaveBeenCalled();
  });

  it('creates a card and returns its current safe image URL', async () => {
    const created = { ...card, updatedAt: new Date(stamp.getTime() + 1) };
    const prisma = {
      file: {
        findFirst: jest.fn().mockResolvedValue({ id: card.imageFileId, visibility: 'PUBLIC', isDeleted: false, mimetype: 'image/png' }),
        findMany: jest.fn().mockResolvedValue([{ id: card.imageFileId, bucket: 'public', storageKey: 'cards/card.png' }]),
      },
      mobileHomeCard: { create: jest.fn().mockResolvedValue(created) },
    };
    const storage = { getSignedUrl: jest.fn().mockResolvedValue('https://cdn.example/card.png?sig=ok') };
    const handler = new CreateMobileHomeCardHandler(prisma as any, storage as any);
    const result = await handler.execute({
      titleAr: 'عنوان', imageFileId: card.imageFileId, imageAltAr: 'وصف الصورة',
    } as any);
    expect(result).toMatchObject({ id: card.id, imageFileId: card.imageFileId, imageUrl: 'https://cdn.example/card.png?sig=ok' });
  });

  it('filters private and deleted image files again before returning public cards', async () => {
    const prisma = {
      mobileHomeCard: { findMany: jest.fn().mockResolvedValue([card]) },
      file: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const storage = { getSignedUrl: jest.fn() };
    const handler = new GetPublicMobileHomeCardsHandler(prisma as any, storage as any);
    const result = await handler.execute();
    expect(prisma.mobileHomeCard.findMany).toHaveBeenCalledWith({
      where: { isPublished: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.file.findMany).toHaveBeenCalledWith({
      where: { id: { in: [card.imageFileId] }, visibility: 'PUBLIC', isDeleted: false, mimetype: { startsWith: 'image/' } },
      select: { id: true, bucket: true, storageKey: true },
    });
    expect(result).toEqual([expect.objectContaining({ id: card.id, imageUrl: null })]);
    expect(result[0]).not.toHaveProperty('imageFileId');
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });

  it('returns admin cards in order without signing private image ids', async () => {
    const prisma = {
      mobileHomeCard: { findMany: jest.fn().mockResolvedValue([card]) },
      file: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const handler = new ListMobileHomeCardsHandler(prisma as any, { getSignedUrl: jest.fn() } as any);
    const result = await handler.execute();
    expect(result[0]).toMatchObject({ id: card.id, imageFileId: card.imageFileId, imageUrl: null });
  });

  it('rejects stale updates before writing', async () => {
    const prisma = { mobileHomeCard: {
      findUnique: jest.fn().mockResolvedValue(card),
      updateMany: jest.fn(),
    }, file: { findFirst: jest.fn() } };
    const rls = { withTransaction: jest.fn((callback: (tx: any) => unknown) => callback(prisma)) };
    const handler = new UpdateMobileHomeCardHandler(prisma as any, rls as any, { getSignedUrl: jest.fn() } as any);
    await expect(handler.execute({ id: card.id, titleAr: 'تحديث', expectedUpdatedAt: '2026-09-26T00:00:00.000Z' } as any))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.mobileHomeCard.updateMany).not.toHaveBeenCalled();
  });

  it('updates with a monotonic version and returns the committed AdminCard with image URL', async () => {
    const updated = { ...card, titleAr: 'تحديث', updatedAt: new Date(stamp.getTime() + 1) };
    const prisma: any = {
      mobileHomeCard: {
        findUnique: jest.fn().mockResolvedValueOnce(card).mockResolvedValueOnce(updated),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      file: {
        findFirst: jest.fn().mockResolvedValue({ id: card.imageFileId, visibility: 'PUBLIC', isDeleted: false, mimetype: 'image/png' }),
        findMany: jest.fn().mockResolvedValue([{ id: card.imageFileId, bucket: 'public', storageKey: 'cards/card.png' }]),
      },
    };
    const rls = { withTransaction: jest.fn((callback: (tx: any) => unknown) => callback(prisma)) };
    const storage = { getSignedUrl: jest.fn().mockResolvedValue('https://cdn.example/card.png?sig=ok') };
    const handler = new UpdateMobileHomeCardHandler(prisma, rls as any, storage as any);
    const result = await handler.execute({ id: card.id, titleAr: 'تحديث', expectedUpdatedAt: stamp.toISOString() } as any);
    expect(prisma.mobileHomeCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: card.id, updatedAt: stamp },
      data: expect.objectContaining({ titleAr: 'تحديث', updatedAt: expect.any(Date) }),
    }));
    expect(prisma.mobileHomeCard.updateMany.mock.calls[0][0].data.updatedAt.getTime()).toBeGreaterThan(stamp.getTime());
    expect(result).toMatchObject({ titleAr: 'تحديث', updatedAt: updated.updatedAt, imageUrl: 'https://cdn.example/card.png?sig=ok' });
  });

  it('rejects duplicate reorder ids without opening a transaction', async () => {
    const rls = { withTransaction: jest.fn() };
    const handler = new ReorderMobileHomeCardsHandler({} as any, rls as any, { getSignedUrl: jest.fn() } as any);
    await expect(handler.execute({ items: [
      { id: card.id, expectedUpdatedAt: stamp.toISOString() },
      { id: card.id, expectedUpdatedAt: stamp.toISOString() },
    ] } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(rls.withTransaction).not.toHaveBeenCalled();
  });

  it('rejects a reorder that omits a current card without writing', async () => {
    const tx = { mobileHomeCard: {
      findMany: jest.fn().mockResolvedValue([card, { ...card, id: 'card-2' }]),
      updateMany: jest.fn(),
    } };
    const rls = { withTransaction: jest.fn((fn: (client: typeof tx) => unknown, _options?: unknown) => fn(tx)) };
    const handler = new ReorderMobileHomeCardsHandler({} as any, rls as any, { getSignedUrl: jest.fn() } as any);
    await expect(handler.execute({ items: [{ id: card.id, expectedUpdatedAt: stamp.toISOString() }] } as any))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.mobileHomeCard.updateMany).not.toHaveBeenCalled();
  });

  it('keeps reorder writes inside the transaction and rolls them back when a later item is stale', async () => {
    const card2 = { ...card, id: '00000000-0000-4000-8000-000000000002', updatedAt: new Date(stamp.getTime() + 10) };
    const databaseState = [card, card2].map((item) => ({ ...item }));
    const tx = { mobileHomeCard: {
      findMany: jest.fn().mockResolvedValue(databaseState.map((item) => ({ ...item }))),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const item = databaseState.find((row) => row.id === where.id && row.updatedAt.getTime() === where.updatedAt.getTime());
        if (!item) return { count: 0 };
        item.sortOrder = data.sortOrder;
        item.updatedAt = data.updatedAt;
        return { count: 1 };
      }),
    } };
    const rls = { withTransaction: jest.fn(async (callback: (client: typeof tx) => unknown, options?: unknown) => {
      const before = databaseState.map((item) => ({ ...item }));
      try {
        return await callback(tx);
      } catch (error) {
        databaseState.splice(0, databaseState.length, ...before);
        throw error;
      }
    }) };
    const handler = new ReorderMobileHomeCardsHandler({} as any, rls as any, { getSignedUrl: jest.fn() } as any);
    await expect(handler.execute({ items: [
      { id: card.id, expectedUpdatedAt: stamp.toISOString() },
      { id: card2.id, expectedUpdatedAt: '2026-09-26T00:00:00.000Z' },
    ] } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.mobileHomeCard.updateMany).toHaveBeenCalledTimes(1);
    expect(rls.withTransaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(databaseState.map(({ id, sortOrder, updatedAt }) => ({ id, sortOrder, updatedAt })))
      .toEqual([{ id: card.id, sortOrder: 0, updatedAt: stamp }, { id: card2.id, sortOrder: 0, updatedAt: card2.updatedAt }]);
  });

  it('maps a card missing during admin listing to an empty list', async () => {
    const prisma = { mobileHomeCard: { findMany: jest.fn().mockResolvedValue([]) }, file: { findMany: jest.fn() } };
    const handler = new ListMobileHomeCardsHandler(prisma as any, { getSignedUrl: jest.fn() } as any);
    await expect(handler.execute()).resolves.toEqual([]);
  });
});
