import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateInvoiceHandler } from './create-invoice.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

const buildPrisma = () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ id: 'book-1' }]),
  invoice: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((args: any) =>
      Promise.resolve({
        id: 'inv-1',
        ...args.data,
      }),
    ),
  },
});

const buildEventBus = () => ({
  publish: jest.fn().mockResolvedValue(undefined),
  publishOptional: jest.fn().mockResolvedValue(undefined),
});

describe('CreateInvoiceHandler', () => {
  let handler: CreateInvoiceHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let eventBus: ReturnType<typeof buildEventBus>;
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrisma();
    eventBus = buildEventBus();
    rlsTransaction = {
      withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateInvoiceHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<CreateInvoiceHandler>(CreateInvoiceHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates invoice with bookingId and null packagePurchaseId', async () => {
    const result = await handler.execute({
      bookingId: 'book-1',
      packagePurchaseId: null,
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 200,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'book-1',
          packagePurchaseId: null,
        }),
      }),
    );
    expect(result.bookingId).toBe('book-1');
    expect(result.packagePurchaseId).toBeNull();
  });

  it('locks and rechecks the booking inside the invoice transaction before creating', async () => {
    await handler.execute({
      bookingId: 'book-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 200,
    });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect((prisma.$queryRaw.mock.calls[0][0] as string[]).join('')).toMatch(
      /FROM "Booking".*FOR SHARE/is,
    );
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.invoice.create.mock.invocationCallOrder[0],
    );
  });

  it('rejects a missing booking without creating or publishing an invoice', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      handler.execute({
        bookingId: 'missing-booking',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        subtotal: 200,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(eventBus.publishOptional).not.toHaveBeenCalled();
  });

  it('publishes the booking invoice event only after its transaction commits', async () => {
    const order: string[] = [];
    rlsTransaction.withTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const result = await fn(prisma);
      order.push('commit');
      return result;
    });
    eventBus.publishOptional.mockImplementationOnce(async () => {
      order.push('publish');
    });

    await handler.execute({
      bookingId: 'book-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 200,
    });

    expect(order).toEqual(['commit', 'publish']);
  });

  it('keeps package-purchase invoice creation off the booking transaction path', async () => {
    await handler.execute({
      packagePurchaseId: 'bp-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 500,
    });

    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('P1-10: creates the invoice as DRAFT (issued only on first payment)', async () => {
    await handler.execute({
      bookingId: 'book-1',
      packagePurchaseId: null,
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 200,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT' }),
      }),
    );
  });

  it('creates invoice with packagePurchaseId and null bookingId', async () => {
    const result = await handler.execute({
      bookingId: null,
      packagePurchaseId: 'bp-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 500,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: null,
          packagePurchaseId: 'bp-1',
        }),
      }),
    );
    expect(result.packagePurchaseId).toBe('bp-1');
    expect(result.bookingId).toBeNull();
  });

  it('rejects invoice with both bookingId and packagePurchaseId null', async () => {
    await expect(
      handler.execute({
        bookingId: null,
        packagePurchaseId: null,
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        subtotal: 200,
      }),
    ).rejects.toThrow('Exactly one of bookingId or packagePurchaseId must be provided');
  });

  it('rejects invoice with both bookingId and packagePurchaseId non-null', async () => {
    await expect(
      handler.execute({
        bookingId: 'book-1',
        packagePurchaseId: 'bp-1',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        subtotal: 200,
      }),
    ).rejects.toThrow('Exactly one of bookingId or packagePurchaseId must be provided');
  });

  it('uses provided subtotal as snapshot price without re-fetching service price', async () => {
    const result = await handler.execute({
      bookingId: 'book-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 15000,
    });

    // subtotal is now passed as Prisma.Decimal — compare via Number() or string
    expect(Number(result.subtotal)).toBe(15000);
  });

  it('computes VAT correctly on package purchase invoice', async () => {
    const result = await handler.execute({
      bookingId: null,
      packagePurchaseId: 'bp-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 10000,
      vatRate: 0.15,
    });

    // vatAmt and total are now Prisma.Decimal — compare via Number()
    expect(Number(result.vatAmt)).toBe(1500);
    expect(Number(result.total)).toBe(11500);
  });

  it('publishes finance.invoice.created as an optional event after creation', async () => {
    await handler.execute({
      bookingId: 'book-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 200,
    });

    expect(eventBus.publishOptional).toHaveBeenCalledWith(
      'finance.invoice.created',
      expect.objectContaining({
        payload: expect.objectContaining({
          bookingId: 'book-1',
          total: expect.any(Number),
        }),
      }),
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('throws ConflictException when invoice already exists for booking', async () => {
    prisma.invoice.findUnique = jest.fn().mockResolvedValue({ id: 'existing-inv' });

    await expect(
      handler.execute({
        bookingId: 'book-1',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        subtotal: 200,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when invoice already exists for package purchase', async () => {
    prisma.invoice.findUnique = jest.fn().mockResolvedValue({ id: 'existing-inv' });

    await expect(
      handler.execute({
        bookingId: null,
        packagePurchaseId: 'bp-1',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        subtotal: 500,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
