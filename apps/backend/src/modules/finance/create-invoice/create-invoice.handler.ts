import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CreateInvoiceDto } from './create-invoice.dto';
import { computeVat } from '../money.helper';

const DEFAULT_VAT_RATE = 0;

export type CreateInvoiceCommand = Omit<CreateInvoiceDto, 'dueAt'> & {
  dueAt?: Date;
};

function validateXor(dto: CreateInvoiceCommand): void {
  const hasBooking = !!dto.bookingId;
  const hasPackage = !!dto.packagePurchaseId;
  if ((hasBooking && hasPackage) || (!hasBooking && !hasPackage)) {
    throw new BadRequestException('Exactly one of bookingId or packagePurchaseId must be provided');
  }
}

@Injectable()
export class CreateInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: CreateInvoiceCommand) {
    validateXor(dto);

    const subtotalDec = new Prisma.Decimal(dto.subtotal.toString());
    const discountAmtDec = new Prisma.Decimal((dto.discountAmt ?? 0).toString());
    const vatRateDec = new Prisma.Decimal((dto.vatRate ?? DEFAULT_VAT_RATE).toString());
    // vatBase = subtotal minus discount (stays Decimal, no float conversion)
    const vatBaseDec = subtotalDec.minus(discountAmtDec);
    // computeVat uses pure Decimal arithmetic — no .toNumber() on amounts
    const { vatAmtHalalas, totalHalalas } = computeVat(vatBaseDec, vatRateDec);

    const create = async (db: Prisma.TransactionClient) => {
      // Check for existing invoice by the non-null key.
      if (dto.bookingId) {
        const existing = await db.invoice.findUnique({
          where: { bookingId: dto.bookingId },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException({
            code: 'INVOICE_ALREADY_EXISTS',
            bookingId: dto.bookingId,
            invoiceId: existing.id,
          });
        }
      }
      if (dto.packagePurchaseId) {
        const existing = await db.invoice.findUnique({
          where: { packagePurchaseId: dto.packagePurchaseId },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException({
            code: 'INVOICE_ALREADY_EXISTS',
            packagePurchaseId: dto.packagePurchaseId,
            invoiceId: existing.id,
          });
        }
      }

      return db.invoice.create({
        data: {
          branchId: dto.branchId,
          clientId: dto.clientId,
          employeeId: dto.employeeId,
          bookingId: dto.bookingId ?? null,
          packagePurchaseId: dto.packagePurchaseId ?? null,
          subtotal: subtotalDec,
          discountAmt: discountAmtDec,
          vatRate: vatRateDec,
          vatAmt: vatAmtHalalas,
          total: totalHalalas,
          notes: dto.notes,
          dueAt: dto.dueAt,
          // DRAFT ("awaiting payment") until the first COMPLETED payment stamps
          // issuedAt and flips it to PARTIALLY_PAID/PAID. See process-payment +
          // moyasar-webhook handlers.
          status: 'DRAFT',
        },
      });
    };

    let invoice;
    try {
      invoice = dto.bookingId
        ? await this.rlsTransaction.withTransaction(async (tx) => {
            const bookingRows = await tx.$queryRaw<Array<{ id: string }>>`
              SELECT "id" FROM "Booking"
              WHERE "id" = ${dto.bookingId}
              FOR SHARE
            `;
            if (bookingRows.length === 0) {
              throw new NotFoundException(`Booking ${dto.bookingId} not found`);
            }
            return create(tx);
          })
        : await create(this.prisma as unknown as Prisma.TransactionClient);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'INVOICE_ALREADY_EXISTS',
          bookingId: dto.bookingId,
          packagePurchaseId: dto.packagePurchaseId,
        });
      }
      throw err;
    }

    await this.eventBus.publishOptional('finance.invoice.created', {
      eventId: invoice.id,
      source: 'finance',
      version: 1,
      occurredAt: new Date(),
      payload: {
        invoiceId: invoice.id,
        bookingId: invoice.bookingId,
        packagePurchaseId: invoice.packagePurchaseId,
        clientId: invoice.clientId,
        total: Number(invoice.total),
      },
    });

    return invoice;
  }
}
