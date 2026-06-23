import { Test, TestingModule } from '@nestjs/testing';
import { ContactMessageStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateContactMessageStatusHandler } from './update-contact-message-status.handler';

describe('UpdateContactMessageStatusHandler', () => {
  let handler: UpdateContactMessageStatusHandler;
  let prisma: { contactMessage: { findFirst: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = { contactMessage: { findFirst: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateContactMessageStatusHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<UpdateContactMessageStatusHandler>(UpdateContactMessageStatusHandler);
  });

  it('throws when the contact message does not exist', async () => {
    prisma.contactMessage.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ id: '00000000-0000-0000-0000-000000000001', status: ContactMessageStatus.NEW }),
    ).rejects.toThrow();
    expect(prisma.contactMessage.update).not.toHaveBeenCalled();
  });

  it('updates the contact message status when found', async () => {
    prisma.contactMessage.findFirst.mockResolvedValue({ id: 'm-1' });
    prisma.contactMessage.update.mockResolvedValue({ id: 'm-1', status: ContactMessageStatus.RESOLVED });

    await handler.execute({ id: 'm-1', status: ContactMessageStatus.RESOLVED });

    expect(prisma.contactMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-1' },
        data: { status: ContactMessageStatus.RESOLVED },
      }),
    );
  });
});