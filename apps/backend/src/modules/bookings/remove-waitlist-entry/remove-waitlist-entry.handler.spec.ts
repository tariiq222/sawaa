import { NotFoundException } from '@nestjs/common';
import { RemoveWaitlistEntryHandler } from './remove-waitlist-entry.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

describe('RemoveWaitlistEntryHandler', () => {
  it('removes a waitlist entry', async () => {
    const prisma = buildPrisma();
    await new RemoveWaitlistEntryHandler(prisma as never).execute({ id: 'wl-1' });
    expect(prisma.waitlistEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: 'wl-1' },
    });
  });

  it('throws NotFoundException when entry does not exist', async () => {
    const prisma = buildPrisma();
    prisma.waitlistEntry.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      new RemoveWaitlistEntryHandler(prisma as never).execute({ id: 'missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});
