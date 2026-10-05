import { paymentCollectionDate, paymentCollectionDateSql, paymentCollectionDateWhere } from '../payment-collection-date.helper';
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
        ? paymentCollectionDateWhere({gte: query.fromDate, lte: query.toDate}, 'CREATED')
        : {}),
      ...(searchInvoiceIds !== undefined && !query.invoiceId
        ? { invoiceId: { in: searchInvoiceIds } }
        : {}),
    };

    // Resolve a bounded page using the same collection date used by filtering.
    // Prisma's field orderBy cannot express COALESCE; sorting after pagination
    // would silently return the wrong historical receipts.
    const pageIds = await this.prisma.$queryRaw<Array<{id: string}>>(Prisma.sql`
      SELECT p."id" FROM "Payment" p JOIN "Invoice" i ON i."id" = p."invoiceId"
      WHERE TRUE
      ${query.invoiceId ? Prisma.sql`AND p."invoiceId" = ${query.invoiceId}` : Prisma.empty}
      ${query.method ? Prisma.sql`AND p."method"::text = ${query.method}` : Prisma.empty}
      ${query.status ? Prisma.sql`AND p."status"::text = ${query.status}` : Prisma.empty}
      ${query.clientId ? Prisma.sql`AND i."clientId" = ${query.clientId}` : Prisma.empty}
      ${query.fromDate ? Prisma.sql`AND ${paymentCollectionDateSql('CREATED')} >= ${query.fromDate}` : Prisma.empty}
      ${query.toDate ? Prisma.sql`AND ${paymentCollectionDateSql('CREATED')} <= ${query.toDate}` : Prisma.empty}
      ${searchInvoiceIds !== undefined && !query.invoiceId
        ? searchInvoiceIds.length ? Prisma.sql`AND p."invoiceId" IN (${Prisma.join(searchInvoiceIds)})` : Prisma.sql`AND FALSE`
        : Prisma.empty}
      ORDER BY ${paymentCollectionDateSql('CREATED')} DESC, p."id" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `);
    const [pageItems, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: {...where, id: {in: pageIds.map(({id}) => id)}},
        include: { invoice: { select: { bookingId: true, clientId: true, total: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const pageOrder = new Map(pageIds.map(({id}, index) => [id, index]));
    const items = pageItems.sort((a, b) => pageOrder.get(a.id)! - pageOrder.get(b.id)!);
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
      collectionDate: paymentCollectionDate(p, 'CREATED').toISOString(),
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
