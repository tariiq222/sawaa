import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateContactMessageHandler } from './create-contact-message.handler';
import { CreateContactMessageDto } from './create-contact-message.dto';

describe('CreateContactMessageHandler', () => {
  let handler: CreateContactMessageHandler;
  let prisma: { contactMessage: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { contactMessage: { create: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateContactMessageHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<CreateContactMessageHandler>(CreateContactMessageHandler);
  });

  it('rejects when neither phone nor email is provided', async () => {
    await expect(
      handler.execute({ name: 'John', subject: 'hi', body: 'there' } as CreateContactMessageDto),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('persists the contact message with the requested shape', async () => {
    prisma.contactMessage.create.mockResolvedValue({
      id: 'msg-1',
      createdAt: new Date('2026-05-20T10:00:00Z'),
      status: 'PENDING',
    });

    await handler.execute({
      name: 'John',
      phone: '+966501234567',
      subject: 'Inquiry',
      body: 'Please call back',
    } as CreateContactMessageDto);

    expect(prisma.contactMessage.create).toHaveBeenCalledWith({
      data: {
        name: 'John',
        phone: '+966501234567',
        email: undefined,
        subject: 'Inquiry',
        body: 'Please call back',
      },
      select: { id: true, createdAt: true, status: true },
    });
  });

  it('returns the new id, createdAt, and PENDING status', async () => {
    const createdAt = new Date('2026-05-20T10:00:00Z');
    prisma.contactMessage.create.mockResolvedValue({ id: 'msg-2', createdAt, status: 'PENDING' });

    const result = await handler.execute({
      name: 'A', email: 'a@b.com', subject: 's', body: 'b',
    } as CreateContactMessageDto);

    expect(result).toEqual({ id: 'msg-2', createdAt, status: 'PENDING' });
  });
});