import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { BankTransferUploadHandler, MAX_BANK_TRANSFER_RECEIPT_BYTES } from './bank-transfer-upload.handler';

// ── Magic-byte fixtures ──────────────────────────────────────────────────────

/** Valid JPEG: SOI + JFIF APP0 marker */
const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

/** Valid PNG: signature bytes */
const PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('png-body'),
]);

/** Valid PDF: %PDF- magic */
const PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\nstartxref\n0\n%%EOF\n');

/** MP4 ftyp box — spoofing attempts */
const MP4_BUFFER = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
  0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
]);

const mockInvoice = {
  id: 'inv-1',
  bookingId: 'booking-1',
  total: new (require('decimal.js')).Decimal(230),
  currency: 'SAR',
  clientId: 'client-1',
  organizationId: '00000000-0000-0000-0000-000000000001',
};

const mockPayment = {
  id: 'pay-1',
  method: PaymentMethod.BANK_TRANSFER,
  status: PaymentStatus.PENDING_VERIFICATION,
  receiptUrl: 'http://minio/bucket/path.jpg',
};

const buildPrisma = (invoiceOverrides = {}) => {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'inv-1' }]),
    $transaction: jest.fn(),
    invoice: {
      findFirst: jest.fn().mockResolvedValue({ ...mockInvoice, ...invoiceOverrides }),
    },
    booking: {
      findFirst: jest.fn().mockResolvedValue({
        serviceId: 'service-1',
        programId: null,
        status: BookingStatus.CONFIRMED,
      }),
    },
    service: {
      findFirst: jest.fn().mockResolvedValue({ depositEnabled: false, depositAmount: null }),
    },
    payment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      create: jest.fn().mockResolvedValue(mockPayment),
    },
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return prisma;
};

const buildStorage = () => ({
  uploadFile: jest.fn().mockResolvedValue('http://minio/bucket/path.jpg'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
});

const buildHandler = (
  prisma = buildPrisma(),
  storage = buildStorage(),
) => new BankTransferUploadHandler(
  prisma as never,
  storage as never,
  {
    withTransaction: jest.fn((fn: (tx: typeof prisma) => unknown) =>
      prisma.$transaction(fn)),
  } as never,
);

const baseCmd = {
  invoiceId: 'inv-1',
  clientId: 'client-1',
  amount: 230,
};

describe('BankTransferUploadHandler', () => {
  describe('valid uploads', () => {
    it('uploads JPEG receipt and creates PENDING_VERIFICATION payment', async () => {
      const prisma = buildPrisma();
      const storage = buildStorage();
      const handler = buildHandler(prisma, storage);

      const result = await handler.execute({
        ...baseCmd,
        fileBuffer: JPEG_BUFFER,
        mimetype: 'image/jpeg',
        filename: 'receipt.jpg',
      });

      expect(storage.uploadFile).toHaveBeenCalledWith(
        'finance-receipts',
        expect.stringContaining('inv-1/'),
        JPEG_BUFFER,
        'image/jpeg',
      );
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.PENDING_VERIFICATION,
            method: PaymentMethod.BANK_TRANSFER,
            receiptUrl: 'http://minio/bucket/path.jpg',
          }),
        }),
      );
      expect(result.id).toBe('pay-1');
    });

    it('uploads PNG receipt', async () => {
      const storage = buildStorage();
      const handler = buildHandler(buildPrisma(), storage);

      await handler.execute({
        ...baseCmd,
        fileBuffer: PNG_BUFFER,
        mimetype: 'image/png',
        filename: 'receipt.png',
      });

      expect(storage.uploadFile).toHaveBeenCalledWith(
        'finance-receipts',
        expect.stringContaining('inv-1/'),
        PNG_BUFFER,
        'image/png',
      );
    });

    it('uploads PDF receipt', async () => {
      const storage = buildStorage();
      const handler = buildHandler(buildPrisma(), storage);

      await handler.execute({
        ...baseCmd,
        fileBuffer: PDF_BUFFER,
        mimetype: 'application/pdf',
        filename: 'receipt.pdf',
      });

      expect(storage.uploadFile).toHaveBeenCalledWith(
        'finance-receipts',
        expect.stringContaining('inv-1/'),
        PDF_BUFFER,
        'application/pdf',
      );
    });
  });

  describe('magic-byte rejection', () => {
    it('rejects MP4 bytes claimed as image/jpeg', async () => {
      const storage = buildStorage();
      const handler = buildHandler(buildPrisma(), storage);

      await expect(
        handler.execute({
          ...baseCmd,
          fileBuffer: MP4_BUFFER,
          mimetype: 'image/jpeg',
          filename: 'evil.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects PNG bytes claimed as application/pdf', async () => {
      const storage = buildStorage();
      const handler = buildHandler(buildPrisma(), storage);

      await expect(
        handler.execute({
          ...baseCmd,
          fileBuffer: PNG_BUFFER,
          mimetype: 'application/pdf',
          filename: 'spoof.pdf',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('ownership and amount validation', () => {
    it('throws NotFoundException when invoice belongs to another client', async () => {
      // commit 2c3fb949: handler now scopes invoice lookup by organizationId only.
      // A foreign-client invoice that shares the same org returns null → NotFoundException.
      // To simulate: return null from findFirst (invoice not visible under tenant scope).
      const prisma = buildPrisma();
      prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);
      const handler = buildHandler(prisma, buildStorage());

      await expect(
        handler.execute({
          ...baseCmd,
          fileBuffer: JPEG_BUFFER,
          mimetype: 'image/jpeg',
          filename: 'receipt.jpg',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects fractional halala amounts before uploading the receipt', async () => {
      const prisma = buildPrisma();
      const storage = buildStorage();
      const handler = buildHandler(prisma, storage);

      await expect(
        handler.execute({
          ...baseCmd,
          amount: 229.99,
          fileBuffer: JPEG_BUFFER,
          mimetype: 'image/jpeg',
          filename: 'receipt.jpg',
        }),
      ).rejects.toThrow('integer halalas');
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects a transfer for a cancelled booking', async () => {
      const prisma = buildPrisma();
      prisma.booking.findFirst.mockResolvedValue({
        serviceId: 'service-1',
        programId: null,
        status: BookingStatus.CANCELLED,
      });
      const storage = buildStorage();
      const handler = buildHandler(prisma, storage);

      await expect(
        handler.execute({
          ...baseCmd,
          fileBuffer: JPEG_BUFFER,
          mimetype: 'image/jpeg',
          filename: 'receipt.jpg',
        }),
      ).rejects.toThrow('cannot accept payments');
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('accepts the configured deposit as the first bank-transfer amount', async () => {
      const prisma = buildPrisma();
      prisma.service.findFirst.mockResolvedValue({
        depositEnabled: true,
        depositAmount: 50,
      });
      const handler = buildHandler(prisma, buildStorage());

      await expect(handler.execute({
        ...baseCmd,
        amount: 50,
        fileBuffer: JPEG_BUFFER,
        mimetype: 'image/jpeg',
        filename: 'deposit.jpg',
      })).resolves.toHaveProperty('id', 'pay-1');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 50 }) }),
      );
    });

    it('accepts only the outstanding balance after a completed deposit', async () => {
      const prisma = buildPrisma();
      prisma.service.findFirst.mockResolvedValue({
        depositEnabled: true,
        depositAmount: 50,
      });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 50 } });
      const handler = buildHandler(prisma, buildStorage());

      await expect(handler.execute({
        ...baseCmd,
        amount: 180,
        fileBuffer: JPEG_BUFFER,
        mimetype: 'image/jpeg',
        filename: 'remainder.jpg',
      })).resolves.toHaveProperty('id', 'pay-1');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 180 }) }),
      );
    });

    it('rejects the invoice total after a deposit because it exceeds outstanding', async () => {
      const prisma = buildPrisma();
      prisma.service.findFirst.mockResolvedValue({
        depositEnabled: true,
        depositAmount: 50,
      });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 50 } });
      const handler = buildHandler(prisma, buildStorage());

      await expect(handler.execute({
        ...baseCmd,
        amount: 230,
        fileBuffer: JPEG_BUFFER,
        mimetype: 'image/jpeg',
        filename: 'overpay.jpg',
      })).rejects.toThrow('outstanding balance 180');
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('serializes concurrent uploads so pending transfers cannot over-reserve the invoice', async () => {
      const prisma = buildPrisma();
      const storage = buildStorage();
      let reserved = 0;
      let transactionTail = Promise.resolve<unknown>(undefined);
      prisma.payment.aggregate.mockImplementation(() =>
        Promise.resolve({ _sum: { amount: reserved } }),
      );
      prisma.payment.create.mockImplementation(({ data }: { data: { amount: number } }) => {
        reserved += data.amount;
        return Promise.resolve({ ...mockPayment, amount: data.amount });
      });
      prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => {
        const run = transactionTail.then(() => fn(prisma));
        transactionTail = run.catch(() => undefined);
        return run;
      });
      const handler = buildHandler(prisma, storage);
      const command = {
        ...baseCmd,
        fileBuffer: JPEG_BUFFER,
        mimetype: 'image/jpeg',
        filename: 'receipt.jpg',
      };

      const outcomes = await Promise.allSettled([
        handler.execute(command),
        handler.execute(command),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
      expect(prisma.payment.aggregate).toHaveBeenCalledWith({
        where: {
          invoiceId: 'inv-1',
          status: {
            in: [PaymentStatus.COMPLETED, PaymentStatus.PENDING_VERIFICATION],
          },
        },
        _sum: { amount: true },
      });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(storage.deleteFile).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when transfer amount does not match invoice total', async () => {
      const prisma = buildPrisma();
      const handler = buildHandler(prisma, buildStorage());

      await expect(
        handler.execute({
          ...baseCmd,
          amount: 99,
          fileBuffer: JPEG_BUFFER,
          mimetype: 'image/jpeg',
          filename: 'receipt.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for disallowed mime type', async () => {
      const handler = buildHandler();
      await expect(
        handler.execute({ ...baseCmd, fileBuffer: JPEG_BUFFER, mimetype: 'text/html', filename: 'x.html' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when receipt exceeds maximum size', async () => {
      const handler = buildHandler();
      await expect(
        handler.execute({
          ...baseCmd,
          fileBuffer: Buffer.alloc(MAX_BANK_TRANSFER_RECEIPT_BYTES + 1),
          mimetype: 'image/jpeg',
          filename: 'receipt.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when invoice not found', async () => {
      const prisma = buildPrisma();
      prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);
      const handler = buildHandler(prisma, buildStorage());
      await expect(
        handler.execute({ ...baseCmd, fileBuffer: JPEG_BUFFER, mimetype: 'image/jpeg', filename: 'receipt.jpg' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when client tries to pay another client\'s invoice (P0-5)', async () => {
      const prisma = buildPrisma({ clientId: 'other-client' });
      const handler = buildHandler(prisma, buildStorage());
      await expect(
        handler.execute({
          ...baseCmd,
          clientId: 'attacker',
          fileBuffer: JPEG_BUFFER,
          mimetype: 'image/jpeg',
          filename: 'receipt.jpg',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });
});
