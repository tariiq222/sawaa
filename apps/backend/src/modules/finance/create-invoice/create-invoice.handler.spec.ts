import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateInvoiceHandler } from './create-invoice.handler';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

const buildPrisma = () => ({
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
});

describe('CreateInvoiceHandler', () => {
  let handler: CreateInvoiceHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let eventBus: ReturnType<typeof buildEventBus>;

  beforeEach(async () => {
    prisma = buildPrisma();
    eventBus = buildEventBus();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateInvoiceHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<CreateInvoiceHandler>(CreateInvoiceHandler);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates invoice with bookingId and null bundlePurchaseId', async () => {
    const result = await handler.execute({
      bookingId: 'book-1',
      bundlePurchaseId: null,
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 200,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'book-1',
          bundlePurchaseId: null,
        }),
      }),
    );
    expect(result.bookingId).toBe('book-1');
    expect(result.bundlePurchaseId).toBeNull();
  });

  it('creates invoice with bundlePurchaseId and null bookingId', async () => {
    const result = await handler.execute({
      bookingId: null,
      bundlePurchaseId: 'bp-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 500,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: null,
          bundlePurchaseId: 'bp-1',
        }),
      }),
    );
    expect(result.bundlePurchaseId).toBe('bp-1');
    expect(result.bookingId).toBeNull();
  });

  it('rejects invoice with both bookingId and bundlePurchaseId null', async () => {
    await expect(
      handler.execute({
        bookingId: null,
        bundlePurchaseId: null,
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        subtotal: 200,
      }),
    ).rejects.toThrow('Exactly one of bookingId or bundlePurchaseId must be provided');
  });

  it('rejects invoice with both bookingId and bundlePurchaseId non-null', async () => {
    await expect(
      handler.execute({
        bookingId: 'book-1',
        bundlePurchaseId: 'bp-1',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        subtotal: 200,
      }),
    ).rejects.toThrow('Exactly one of bookingId or bundlePurchaseId must be provided');
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

  it('computes VAT correctly on bundle purchase invoice', async () => {
    const result = await handler.execute({
      bookingId: null,
      bundlePurchaseId: 'bp-1',
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

  it('publishes finance.invoice.created event after creation', async () => {
    await handler.execute({
      bookingId: 'book-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      subtotal: 200,
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.invoice.created',
      expect.objectContaining({
        payload: expect.objectContaining({
          bookingId: 'book-1',
          total: expect.any(Number),
        }),
      }),
    );
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

  it('throws ConflictException when invoice already exists for bundle purchase', async () => {
    prisma.invoice.findUnique = jest.fn().mockResolvedValue({ id: 'existing-inv' });

    await expect(
      handler.execute({
        bookingId: null,
        bundlePurchaseId: 'bp-1',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        subtotal: 500,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
