import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateContactMessageHandler } from './create-contact-message.handler';
import { ListContactMessagesHandler } from './list-contact-messages.handler';
import { UpdateContactMessageStatusHandler } from './update-contact-message-status.handler';
import { TenantContextService } from '../../../common/tenant';

const tenantProvider = {
  provide: TenantContextService,
  useValue: { requireOrganizationIdOrDefault: () => 'org-A' },
};

describe('ContactMessages handlers', () => {
  let createHandler: CreateContactMessageHandler;
  let listHandler: ListContactMessagesHandler;
  let updateHandler: UpdateContactMessageStatusHandler;
   
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateContactMessageHandler,
        ListContactMessagesHandler,
        UpdateContactMessageStatusHandler,
        tenantProvider,
        {
          provide: PrismaService,
          useValue: {
            contactMessage: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    createHandler = module.get(CreateContactMessageHandler);
    listHandler = module.get(ListContactMessagesHandler);
    updateHandler = module.get(UpdateContactMessageStatusHandler);
    prisma = module.get(PrismaService);
  });

  it('requires phone or email', async () => {
    await expect(
      createHandler.execute({ name: 'x', body: 'hello' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates message', async () => {
    prisma.contactMessage.create.mockResolvedValue({ id: 'm1', createdAt: new Date(), status: 'NEW' });
    const result = await createHandler.execute({ name: 'Ali', email: 'a@b.com', body: 'hello world' });
    expect(result.id).toBe('m1');
  });

  it('lists with pagination', async () => {
    prisma.contactMessage.findMany.mockResolvedValue([{ id: 'm1' }]);
    prisma.contactMessage.count.mockResolvedValue(1);
    const res = await listHandler.execute({ page: 1, limit: 10 });
    expect(res.items).toHaveLength(1);
  });

  it('updates status and sets readAt for READ', async () => {
    prisma.contactMessage.findFirst.mockResolvedValue({ id: 'm1', readAt: null });
    prisma.contactMessage.update.mockResolvedValue({ id: 'm1', status: 'READ' });
    await updateHandler.execute({ id: 'm1', status: 'READ' });
    expect(prisma.contactMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'READ', readAt: expect.any(Date) }) }),
    );
  });

  it('throws NotFound when id missing', async () => {
    prisma.contactMessage.findFirst.mockResolvedValue(null);
    await expect(
      updateHandler.execute({ id: 'x', status: 'READ' }),
    ).rejects.toThrow(NotFoundException);
  });
});
