import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CreateContactMessageHandler } from './create-contact-message.handler';
import { CreateContactMessageDto } from './create-contact-message.dto';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetStaffTargetsHandler } from '../notifications/get-staff-targets.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';

describe('CreateContactMessageHandler', () => {
  let handler: CreateContactMessageHandler;
  let prisma: { contactMessage: { create: jest.Mock } };
  let notify: { execute: jest.Mock };
  let staffTargets: { execute: jest.Mock };

  const savedMessage = {
    id: 'msg-1',
    createdAt: new Date('2026-05-20T10:00:00Z'),
    status: 'PENDING',
  };

  beforeEach(async () => {
    prisma = { contactMessage: { create: jest.fn() } };
    notify = { execute: jest.fn() };
    staffTargets = { execute: jest.fn().mockResolvedValue([{ userId: 'u1', role: 'ADMIN' }]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateContactMessageHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SendNotificationHandler, useValue: notify },
        { provide: GetStaffTargetsHandler, useValue: staffTargets },
      ],
    }).compile();

    handler = module.get<CreateContactMessageHandler>(CreateContactMessageHandler);
  });

  it('rejects when neither phone nor email is provided', async () => {
    await expect(
      handler.execute({ name: 'John', subject: 'hi', body: 'there' } as CreateContactMessageDto),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('persists the contact message with the requested shape', async () => {
    prisma.contactMessage.create.mockResolvedValue(savedMessage);

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

  it('notifies all active staff targets with a GENERAL in-app notification after persisting', async () => {
    prisma.contactMessage.create.mockResolvedValue(savedMessage);
    staffTargets.execute.mockResolvedValue([
      { userId: 'u1', role: 'ADMIN' },
      { userId: 'u2', role: 'RECEPTIONIST' },
    ]);

    await handler.execute({
      name: 'John',
      phone: '+966501234567',
      subject: 'Inquiry',
      body: 'Please call back',
    } as CreateContactMessageDto);

    expect(staffTargets.execute).toHaveBeenCalledWith({
      organizationId: DEFAULT_ORG_ID,
      roles: ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'],
    });

    expect(notify.execute).toHaveBeenCalledTimes(2);
    expect(notify.execute).toHaveBeenNthCalledWith(1, {
      organizationId: DEFAULT_ORG_ID,
      recipientId: 'u1',
      recipientType: RecipientType.EMPLOYEE,
      type: NotificationType.GENERAL,
      title: 'رسالة تواصل جديدة',
      body: 'تم استلام رسالة جديدة عبر الموقع',
      channels: ['in-app'],
      metadata: { contactMessageId: 'msg-1' },
    });
    expect(notify.execute).toHaveBeenNthCalledWith(2, {
      organizationId: DEFAULT_ORG_ID,
      recipientId: 'u2',
      recipientType: RecipientType.EMPLOYEE,
      type: NotificationType.GENERAL,
      title: 'رسالة تواصل جديدة',
      body: 'تم استلام رسالة جديدة عبر الموقع',
      channels: ['in-app'],
      metadata: { contactMessageId: 'msg-1' },
    });
  });

  it('does not notify when no staff targets match', async () => {
    prisma.contactMessage.create.mockResolvedValue(savedMessage);
    staffTargets.execute.mockResolvedValue([]);

    await expect(handler.execute({
      name: 'A', email: 'a@b.com', subject: 's', body: 'b',
    } as CreateContactMessageDto)).resolves.toEqual(savedMessage);
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('still succeeds when staff target lookup fails', async () => {
    prisma.contactMessage.create.mockResolvedValue(savedMessage);
    staffTargets.execute.mockRejectedValue(new Error('DB error'));

    await expect(handler.execute({
      name: 'A', email: 'a@b.com', subject: 's', body: 'b',
    } as CreateContactMessageDto)).resolves.toEqual(savedMessage);
    expect(notify.execute).not.toHaveBeenCalled();
  });

  it('still succeeds when a notification send fails', async () => {
    prisma.contactMessage.create.mockResolvedValue(savedMessage);
    notify.execute.mockRejectedValue(new Error('notify down'));

    await expect(handler.execute({
      name: 'A', email: 'a@b.com', subject: 's', body: 'b',
    } as CreateContactMessageDto)).resolves.toEqual(savedMessage);
    expect(notify.execute).toHaveBeenCalled();
  });

  it('logs a safe aggregate warning when individual sends fail and still resolves', async () => {
    prisma.contactMessage.create.mockResolvedValue(savedMessage);
    staffTargets.execute.mockResolvedValue([
      { userId: 'u1', role: 'ADMIN' },
      { userId: 'u2', role: 'RECEPTIONIST' },
    ]);
    notify.execute.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('provider boom'));

    const warnSpy = jest
      .spyOn((handler as any).logger, 'warn')
      .mockImplementation(() => undefined);

    try {
      await expect(handler.execute({
        name: 'A', email: 'a@b.com', subject: 's', body: 'b',
      } as CreateContactMessageDto)).resolves.toEqual(savedMessage);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logMessage = String(warnSpy.mock.calls[0][0]);
      expect(logMessage).toBe('Contact message msg-1: 1 of 2 staff notification(s) failed');
      expect(logMessage).not.toContain('provider boom');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not leak contact content into the notification payload', async () => {
    prisma.contactMessage.create.mockResolvedValue(savedMessage);

    await handler.execute({
      name: 'SensitiveName',
      phone: '+966500000000',
      email: 'sensitive@example.com',
      subject: 'Sensitive subject',
      body: 'Very private content',
    } as CreateContactMessageDto);

    expect(notify.execute).toHaveBeenCalledTimes(1);
    const payload = notify.execute.mock.calls[0][0];
    expect(payload.metadata).toEqual({ contactMessageId: 'msg-1' });

    for (const secret of [
      'SensitiveName',
      '+966500000000',
      'sensitive@example.com',
      'Sensitive subject',
      'Very private content',
    ]) {
      expect(payload.title).not.toContain(secret);
      expect(payload.body).not.toContain(secret);
      expect(JSON.stringify(payload.metadata)).not.toContain(secret);
    }
  });
});
