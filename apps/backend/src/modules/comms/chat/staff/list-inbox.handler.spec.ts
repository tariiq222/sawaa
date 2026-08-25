import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { ListInboxHandler } from './list-inbox.handler';

describe('ListInboxHandler', () => {
  it('builds deterministic filters and returns only the staff-safe projection', async () => {
    const prisma: any = {
      chatConversation: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'conv-1',
          clientId: null,
          isAiChat: true,
          status: ConversationStatus.WAITING_FOR_STAFF,
          guestName: 'سارة',
          guestPhone: '+966501234567',
          language: 'ar',
          assignedStaffUserId: null,
          handoffRequestedAt: new Date('2026-08-13T08:00:00Z'),
          staffClaimedAt: null,
          closedAt: null,
          staffUnreadCount: 2,
          clientUnreadCount: 0,
          lastMessageAt: new Date('2026-08-13T08:05:00Z'),
          createdAt: new Date('2026-08-13T07:00:00Z'),
          updatedAt: new Date('2026-08-13T08:05:00Z'),
          guestTokenHash: 'never-return',
          assistantLeaseOwner: 'never-return',
        }]),
        findFirst: jest.fn(),
      },
    };
    const handler = new ListInboxHandler(prisma as PrismaService);

    const result = await handler.execute({
      staffUserId: 'staff-a',
      staffRole: 'RECEPTIONIST',
      limit: 20,
      status: ConversationStatus.WAITING_FOR_STAFF,
      unreadOnly: true,
      assigned: 'unassigned',
      search: '  سارة  ',
      from: new Date('2026-08-01T00:00:00Z'),
      to: new Date('2026-08-31T23:59:59Z'),
    });

    expect(prisma.chatConversation.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { OR: [{ assignedStaffUserId: null }, { assignedStaffUserId: 'staff-a' }] },
        ],
        status: ConversationStatus.WAITING_FOR_STAFF,
        staffUnreadCount: { gt: 0 },
        assignedStaffUserId: null,
        OR: [
          { guestName: { contains: 'سارة', mode: 'insensitive' } },
          { guestPhone: { contains: 'سارة' } },
        ],
        createdAt: { gte: new Date('2026-08-01T00:00:00Z'), lte: new Date('2026-08-31T23:59:59Z') },
      },
      select: expect.not.objectContaining({
        guestTokenHash: expect.anything(),
        assistantLeaseOwner: expect.anything(),
      }),
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 21,
    });
    expect(result.data).toEqual([expect.objectContaining({ guestName: 'سارة', guestPhone: '+966501234567', isAiChat: true })]);
    expect(JSON.stringify(result)).not.toMatch(/guestTokenHash|assistantLease|never-return/);
  });

  it('supports assigned-to-me keyset pagination with a deterministic cursor', async () => {
    const prisma: any = {
      chatConversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cursor-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const handler = new ListInboxHandler(prisma as PrismaService);
    await handler.execute({ staffUserId: 'staff-a', staffRole: 'RECEPTIONIST', assigned: 'me', cursor: 'cursor-1', limit: 10 });
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [{ OR: [{ assignedStaffUserId: null }, { assignedStaffUserId: 'staff-a' }] }],
        assignedStaffUserId: 'staff-a',
        id: 'cursor-1',
      },
      select: { id: true },
    });
    expect(prisma.chatConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [{ OR: [{ assignedStaffUserId: null }, { assignedStaffUserId: 'staff-a' }] }],
        assignedStaffUserId: 'staff-a',
      },
      cursor: { id: 'cursor-1' },
      skip: 1,
      take: 11,
    }));
  });

  it.each(['all', undefined] as const)('never lets reception select another staff assignment for filter %s', async (assigned) => {
    const prisma: any = {
      chatConversation: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    const handler = new ListInboxHandler(prisma as PrismaService);
    await handler.execute({ staffUserId: 'staff-a', staffRole: 'RECEPTIONIST', assigned, search: '+966500000999', limit: 20 });
    expect(prisma.chatConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [{ OR: [{ assignedStaffUserId: null }, { assignedStaffUserId: 'staff-a' }] }],
        OR: [
          { guestName: { contains: '+966500000999', mode: 'insensitive' } },
          { guestPhone: { contains: '+966500000999' } },
        ],
      }),
    }));
  });

  it.each(['ADMIN', 'SUPER_ADMIN'])('lets %s use all assignments', async (staffRole) => {
    const prisma: any = { chatConversation: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) } };
    const handler = new ListInboxHandler(prisma as PrismaService);
    await handler.execute({ staffUserId: 'admin-a', staffRole, assigned: 'all', limit: 20 });
    expect(prisma.chatConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it.each(['OWNER', 'ACCOUNTANT', 'EMPLOYEE', 'CLIENT'])('rejects non-Conversation role %s before querying', async (staffRole) => {
    const prisma: any = { chatConversation: { findFirst: jest.fn(), findMany: jest.fn() } };
    const handler = new ListInboxHandler(prisma as PrismaService);
    await expect(handler.execute({ staffUserId: 'user-a', staffRole, assigned: 'all', limit: 20 })).rejects.toThrow();
    expect(prisma.chatConversation.findMany).not.toHaveBeenCalled();
  });
});
