import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListPaymentsDto } from './list-payments.dto';

export type ListPaymentsQuery = Omit<ListPaymentsDto, 'fromDate' | 'toDate'> & {
  fromDate?: Date;
  toDate?: Date;
};

@Injectable()
export class ListPaymentsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListPaymentsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Payment has no `client` relation; it reaches the client through its
    // invoice. Resolve the matching invoice IDs first (by invoice number or by
    // client name), then constrain payments to them — mirrors list-bookings.
    const searchTerm = query.search?.trim();
    let searchInvoiceIds: string[] | undefined;
    if (searchTerm) {
      const tokens = searchTerm.split(/\s+/).filter(Boolean);
      const clientNameConditions: Prisma.ClientWhereInput[] = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
      ];
      // Full name spanning firstName + lastName: require every token to appear
      // in either name field.
      if (tokens.length > 1) {
        clientNameConditions.push({
          AND: tokens.map((tok) => ({
            OR: [
              { firstName: { contains: tok, mode: 'insensitive' } },
              { lastName: { contains: tok, mode: 'insensitive' } },
            ],
          })),
        });
      }
      const matchedClients = await this.prisma.client.findMany({
        where: { OR: clientNameConditions },
        select: { id: true },
      });
      const clientIds = matchedClients.map((c) => c.id);

      const invoiceOr: Prisma.InvoiceWhereInput[] = [
        ...(clientIds.length ? [{ clientId: { in: clientIds } }] : []),
        ...(/^\d+$/.test(searchTerm) ? [{ number: Number(searchTerm) }] : []),
      ];
      const matchedInvoices = invoiceOr.length
        ? await this.prisma.invoice.findMany({
            where: { OR: invoiceOr },
            select: { id: true },
          })
        : [];
      searchInvoiceIds = matchedInvoices.map((i) => i.id);
    }

    const where = {
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId
        ? { invoice: { clientId: query.clientId } }
        : {}),
      ...(query.fromDate || query.toDate
        ? { createdAt: { gte: query.fromDate, lte: query.toDate } }
        : {}),
      ...(searchInvoiceIds !== undefined && !query.invoiceId
        ? { invoiceId: { in: searchInvoiceIds } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { invoice: { select: { bookingId: true, clientId: true, total: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const clientIds = Array.from(new Set(items.map((p) => p.invoice?.clientId).filter(Boolean)));
    const clients =
      clientIds.length > 0
        ? await this.prisma.client.findMany({
            where: { id: { in: clientIds as string[] } },
            select: { id: true, name: true, firstName: true, lastName: true, phone: true },
          })
        : [];

    const clientById = new Map(clients.map((c) => [c.id, c]));
    const enrichedItems = items.map((p) => ({
      ...p,
      invoice: p.invoice
        ? {
            ...p.invoice,
            client: clientById.get(p.invoice.clientId) ?? null,
          }
        : null,
    }));

    return toListResponse(enrichedItems, total, page, limit);
  }
}
