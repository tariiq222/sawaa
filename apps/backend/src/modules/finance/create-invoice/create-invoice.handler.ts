import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CreateInvoiceDto } from './create-invoice.dto';
import { computeVat } from '../money.helper';

const DEFAULT_VAT_RATE = 0.15;

export type CreateInvoiceCommand = Omit<CreateInvoiceDto, 'dueAt'> & {
  dueAt?: Date;
};

function validateXor(dto: CreateInvoiceCommand): void {
  const hasBooking = !!dto.bookingId;
  const hasBundle = !!dto.bundlePurchaseId;
  if ((hasBooking && hasBundle) || (!hasBooking && !hasBundle)) {
    throw new BadRequestException('Exactly one of bookingId or bundlePurchaseId must be provided');
  }
}

@Injectable()
export class CreateInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
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

    // Check for existing invoice by the non-null key
    if (dto.bookingId) {
      const existing = await this.prisma.invoice.findUnique({
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
    if (dto.bundlePurchaseId) {
      const existing = await this.prisma.invoice.findUnique({
        where: { bundlePurchaseId: dto.bundlePurchaseId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'INVOICE_ALREADY_EXISTS',
          bundlePurchaseId: dto.bundlePurchaseId,
          invoiceId: existing.id,
        });
      }
    }

    let invoice;
    try {
      invoice = await this.prisma.invoice.create({
        data: {
          branchId: dto.branchId,
          clientId: dto.clientId,
          employeeId: dto.employeeId,
          bookingId: dto.bookingId ?? null,
          bundlePurchaseId: dto.bundlePurchaseId ?? null,
          subtotal: subtotalDec,
          discountAmt: discountAmtDec,
          vatRate: vatRateDec,
          vatAmt: vatAmtHalalas,
          total: totalHalalas,
          notes: dto.notes,
          dueAt: dto.dueAt,
          status: 'ISSUED',
          issuedAt: new Date(),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'INVOICE_ALREADY_EXISTS',
          bookingId: dto.bookingId,
          bundlePurchaseId: dto.bundlePurchaseId,
        });
      }
      throw err;
    }

    await this.eventBus.publish('finance.invoice.created', {
      eventId: invoice.id,
      source: 'finance',
      version: 1,
      occurredAt: new Date(),
      payload: {
        invoiceId: invoice.id,
        bookingId: invoice.bookingId,
        bundlePurchaseId: invoice.bundlePurchaseId,
        clientId: invoice.clientId,
        total: Number(invoice.total),
      },
    });

    return invoice;
  }
}
