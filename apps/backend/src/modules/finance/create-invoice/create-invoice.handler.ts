import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CreateInvoiceDto } from './create-invoice.dto';

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

    const subtotal = dto.subtotal;
    const discountAmt = dto.discountAmt ?? 0;
    const vatRate = dto.vatRate ?? DEFAULT_VAT_RATE;
    const subtotalDec = new Prisma.Decimal(subtotal.toString());
    const discountAmtDec = new Prisma.Decimal(discountAmt.toString());
    const vatRateDec = new Prisma.Decimal(vatRate.toString());
    const vatBaseDec = subtotalDec.minus(discountAmtDec);
    const vatAmt = vatBaseDec.times(vatRateDec).toDecimalPlaces(2).toNumber();
    const total = vatBaseDec.plus(vatAmt).toDecimalPlaces(2).toNumber();

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
          subtotal,
          discountAmt,
          vatRate,
          vatAmt,
          total,
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
