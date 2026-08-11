import { ListWhatsappConversationsHandler } from './list-whatsapp-conversations.handler';

function buildPrisma() {
  return {
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    client: { findMany: jest.fn().mockResolvedValue([]) },
    whatsappConversation: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

const query = { page: 1, pageSize: 20 };

describe('ListWhatsappConversationsHandler booking filters', () => {
  it('filters booked conversations by WhatsApp booking client IDs', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany.mockResolvedValue([{ clientId: 'client-1' }]);

    await new ListWhatsappConversationsHandler(prisma as never).execute({
      ...query,
      bookingFilter: 'BOOKED',
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { source: 'WHATSAPP' },
      select: { clientId: true },
      distinct: ['clientId'],
    });
    expect(prisma.whatsappConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ clientId: { in: ['client-1'] } }],
        }),
      }),
    );
  });

  it('includes conversations without a WhatsApp booking in NOT_BOOKED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany.mockResolvedValue([{ clientId: 'client-1' }]);

    await new ListWhatsappConversationsHandler(prisma as never).execute({
      ...query,
      bookingFilter: 'NOT_BOOKED',
    });

    expect(prisma.whatsappConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{
            OR: [{ clientId: null }, { clientId: { notIn: ['client-1'] } }],
          }],
        }),
      }),
    );
  });
});
