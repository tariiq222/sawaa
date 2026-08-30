import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { BankTransferUploadDto } from './bank-transfer-upload.dto';
import { validateMagicBytes } from '../../../common/security/magic-byte-validator';
import { resolveInvoiceDeposit } from '../deposit.helper';
import { decimalToHalalas } from '../money.helper';
import { assertBookingAcceptsPayment } from '../booking-payment-eligibility.helper';

const RECEIPTS_BUCKET = 'finance-receipts';
export const MAX_BANK_TRANSFER_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const ALLOWED_MIME_ARRAY = [...ALLOWED_MIME_TYPES] as const;
export const ALLOWED_BANK_TRANSFER_RECEIPT_MIME_TYPES = ALLOWED_MIME_ARRAY;

export type BankTransferUploadCommand = BankTransferUploadDto & {
  fileBuffer: Buffer;
  mimetype: string;
  filename: string;
  // SECURITY (P0-5): when present, the invoice MUST belong to this client.
  // Required for any client-facing surface (mobile/website). Dashboard staff
  // controllers may omit it (gated by CASL).
  clientId?: string;
};

@Injectable()
export class BankTransferUploadHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: BankTransferUploadCommand) {
    if (!Number.isSafeInteger(cmd.amount) || cmd.amount <= 0) {
      throw new BadRequestException('Transfer amount must be a positive number of integer halalas');
    }

    if (cmd.fileBuffer.length > MAX_BANK_TRANSFER_RECEIPT_BYTES) {
      throw new BadRequestException(`Receipt file exceeds maximum size of ${MAX_BANK_TRANSFER_RECEIPT_BYTES} bytes`);
    }

    if (!ALLOWED_MIME_TYPES.has(cmd.mimetype)) {
      throw new BadRequestException(`File type ${cmd.mimetype} not allowed. Use JPEG, PNG, WebP, or PDF.`);
    }

    const check = await validateMagicBytes(cmd.fileBuffer, cmd.mimetype, ALLOWED_MIME_ARRAY);
    if (!check.ok) {
      throw new BadRequestException(
        `Receipt content validation failed: ${check.reason ?? 'content does not match declared type'}`,
      );
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: cmd.invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }

    // SECURITY (P0-5): caller must own the invoice when invoked from a client surface.
    if (cmd.clientId && invoice.clientId !== cmd.clientId) {
      throw new ForbiddenException('Invoice does not belong to caller');
    }

    this.assertInvoiceAcceptsPayment(invoice.id, invoice.status);
    if (invoice.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: invoice.bookingId },
        select: { status: true },
      });
      if (!booking) throw new NotFoundException(`Booking ${invoice.bookingId} not found`);
      assertBookingAcceptsPayment(invoice.bookingId, booking.status);
    }

    const ext = cmd.filename.split('.').pop() ?? 'bin';
    const key = `invoices/${cmd.invoiceId}/${randomUUID()}.${ext}`;

    const receiptUrl = await this.storage.uploadFile(RECEIPTS_BUCKET, key, cmd.fileBuffer, cmd.mimetype);

    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        // Serialize every amount reservation and approval for this invoice.
        // The aggregate below includes unapproved bank transfers so two
        // concurrent uploads cannot reserve more than the invoice balance.
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${cmd.invoiceId} FOR UPDATE`,
        );

        const lockedInvoice = await tx.invoice.findFirst({
          where: { id: cmd.invoiceId },
        });
        if (!lockedInvoice) {
          throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
        }
        if (cmd.clientId && lockedInvoice.clientId !== cmd.clientId) {
          throw new ForbiddenException('Invoice does not belong to caller');
        }
        this.assertInvoiceAcceptsPayment(lockedInvoice.id, lockedInvoice.status);

        if (lockedInvoice.bookingId) {
          const booking = await tx.booking.findFirst({
            where: { id: lockedInvoice.bookingId },
            select: { status: true },
          });
          if (!booking) {
            throw new NotFoundException(`Booking ${lockedInvoice.bookingId} not found`);
          }
          assertBookingAcceptsPayment(lockedInvoice.bookingId, booking.status);
        }

        const committed = await tx.payment.aggregate({
          where: {
            invoiceId: lockedInvoice.id,
            status: {
              in: [PaymentStatus.COMPLETED, PaymentStatus.PENDING_VERIFICATION],
            },
          },
          _sum: { amount: true },
        });
        const alreadyCommitted = decimalToHalalas(committed._sum?.amount ?? 0);
        const invoiceTotal = decimalToHalalas(lockedInvoice.total);
        const outstanding = invoiceTotal - alreadyCommitted;
        if (outstanding <= 0) {
          throw new BadRequestException('Invoice is already fully paid or reserved');
        }

        const deposit = await resolveInvoiceDeposit(tx, lockedInvoice.bookingId);
        const allowed =
          alreadyCommitted === 0 && deposit.enabled && deposit.depositAmount != null
            ? [deposit.depositAmount, outstanding]
            : [outstanding];
        if (!allowed.includes(cmd.amount)) {
          if (cmd.amount > outstanding) {
            throw new BadRequestException(
              `Transfer amount ${cmd.amount} exceeds outstanding balance ${outstanding}`,
            );
          }
          throw new BadRequestException(
            `Transfer amount ${cmd.amount} does not match required amount ${allowed.join(' or ')}`,
          );
        }

        return tx.payment.create({
          data: {
            invoiceId: cmd.invoiceId,
            amount: cmd.amount,
            currency: lockedInvoice.currency,
            method: PaymentMethod.BANK_TRANSFER,
            status: PaymentStatus.PENDING_VERIFICATION,
            receiptUrl,
          },
        });
      });
    } catch (error) {
      // The object upload necessarily happens before the short DB transaction.
      // Best-effort cleanup keeps rejected/racing requests from accumulating
      // orphan receipts while preserving the original money-safety error.
      await this.storage.deleteFile(RECEIPTS_BUCKET, key).catch(() => undefined);
      throw error;
    }
  }

  private assertInvoiceAcceptsPayment(invoiceId: string, status: InvoiceStatus): void {
    if (status === InvoiceStatus.VOID || status === InvoiceStatus.REFUNDED) {
      throw new BadRequestException(
        `Invoice ${invoiceId} cannot accept payments (status: ${status})`,
      );
    }
  }
}
