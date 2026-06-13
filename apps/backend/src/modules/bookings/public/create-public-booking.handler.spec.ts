import { NotFoundException } from '@nestjs/common';
import { CreatePublicBookingHandler, CreatePublicBookingCommand } from './create-public-booking.handler';

const BRANCH_MAIN_ID = '00000000-0000-4000-a000-000000000010';
const BRANCH_FALLBACK_ID = '00000000-0000-4000-a000-000000000011';
const EXPLICIT_BRANCH_ID = '00000000-0000-4000-a000-000000000012';

const baseCommand: Omit<CreatePublicBookingCommand, 'branchId'> = {
  clientId: 'client-1',
  employeeId: 'employee-1',
  serviceId: 'service-1',
  scheduledAt: new Date('2027-01-01T09:00:00Z'),
};

const buildPrisma = ({
  mainBranch,
  fallbackBranch,
}: {
  mainBranch: { id: string } | null;
  fallbackBranch: { id: string } | null;
}) => ({
  branch: {
    findFirst: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.isMain === true) return Promise.resolve(mainBranch);
      return Promise.resolve(fallbackBranch);
    }),
  },
});

const buildMockCreateBookingHandler = () => ({
  execute: jest.fn().mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' }),
});

describe('CreatePublicBookingHandler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when branchId is omitted', () => {
    it('uses the main branch (isMain: true) when available', async () => {
      const prisma = buildPrisma({
        mainBranch: { id: BRANCH_MAIN_ID },
        fallbackBranch: { id: BRANCH_FALLBACK_ID },
      });
      const mockDelegate = buildMockCreateBookingHandler();
      const handler = new CreatePublicBookingHandler(prisma as never, mockDelegate as never);

      await handler.execute({ ...baseCommand });

      expect(mockDelegate.execute).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: BRANCH_MAIN_ID }),
      );
      // First findFirst call should query isMain: true
      const firstCall = (prisma.branch.findFirst as jest.Mock).mock.calls[0][0];
      expect(firstCall.where).toMatchObject({ isMain: true, isActive: true });
    });

    it('falls back to oldest active branch when no main branch exists', async () => {
      const prisma = buildPrisma({
        mainBranch: null,
        fallbackBranch: { id: BRANCH_FALLBACK_ID },
      });
      const mockDelegate = buildMockCreateBookingHandler();
      const handler = new CreatePublicBookingHandler(prisma as never, mockDelegate as never);

      await handler.execute({ ...baseCommand });

      expect(mockDelegate.execute).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: BRANCH_FALLBACK_ID }),
      );
    });

    it('throws NotFoundException when no active branch exists at all', async () => {
      const prisma = buildPrisma({ mainBranch: null, fallbackBranch: null });
      const mockDelegate = buildMockCreateBookingHandler();
      const handler = new CreatePublicBookingHandler(prisma as never, mockDelegate as never);

      await expect(handler.execute({ ...baseCommand })).rejects.toThrow(NotFoundException);
      await expect(handler.execute({ ...baseCommand })).rejects.toThrow('No active branch found');
      expect(mockDelegate.execute).not.toHaveBeenCalled();
    });
  });

  describe('when branchId is explicitly provided', () => {
    it('passes the explicit branchId directly without querying the DB', async () => {
      const prisma = buildPrisma({
        mainBranch: { id: BRANCH_MAIN_ID },
        fallbackBranch: { id: BRANCH_FALLBACK_ID },
      });
      const mockDelegate = buildMockCreateBookingHandler();
      const handler = new CreatePublicBookingHandler(prisma as never, mockDelegate as never);

      await handler.execute({ ...baseCommand, branchId: EXPLICIT_BRANCH_ID });

      expect(mockDelegate.execute).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: EXPLICIT_BRANCH_ID }),
      );
      // Should not need to look up a branch when one is explicitly provided
      expect(prisma.branch.findFirst).not.toHaveBeenCalled();
    });

    it('passes all other fields through to the delegate handler unchanged', async () => {
      const prisma = buildPrisma({ mainBranch: null, fallbackBranch: null });
      const mockDelegate = buildMockCreateBookingHandler();
      const handler = new CreatePublicBookingHandler(prisma as never, mockDelegate as never);

      await handler.execute({
        ...baseCommand,
        branchId: EXPLICIT_BRANCH_ID,
        couponCode: 'SAVE10',
        notes: 'First visit',
      });

      expect(mockDelegate.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          employeeId: 'employee-1',
          serviceId: 'service-1',
          branchId: EXPLICIT_BRANCH_ID,
          couponCode: 'SAVE10',
          notes: 'First visit',
        }),
      );
    });

    it('clientId always comes from the command, never gets overridden', async () => {
      const prisma = buildPrisma({ mainBranch: null, fallbackBranch: null });
      const mockDelegate = buildMockCreateBookingHandler();
      const handler = new CreatePublicBookingHandler(prisma as never, mockDelegate as never);

      await handler.execute({ ...baseCommand, branchId: EXPLICIT_BRANCH_ID });

      const delegateArg = (mockDelegate.execute as jest.Mock).mock.calls[0][0];
      expect(delegateArg.clientId).toBe('client-1');
    });
  });
});
