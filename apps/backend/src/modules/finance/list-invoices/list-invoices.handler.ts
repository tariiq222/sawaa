import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListInvoicesDto } from './list-invoices.dto';

export type ListInvoicesQuery = Omit<ListInvoicesDto, 'fromDate' | 'toDate'> & {
  fromDate?: Date;
  toDate?: Date;
};

/** Compose a display name from a client's first/last fields, falling back to `name`. */
function clientDisplayName(client: {
  name: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const composed = [client.firstName, client.lastName].filter(Boolean).join(' ').trim();
  return composed.length > 0 ? composed : client.name;
}

@Injectable()
export class ListInvoicesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListInvoicesQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Invoice has no `client` relation (only a clientId column), so resolve the
    // matching client IDs first (by name), then constrain invoices to them and
    // OR with the numeric invoice number — same pattern as list-bookings.
    const searchTerm = query.search?.trim();
    let searchClientIds: string[] = [];
    if (searchTerm) {
      const tokens = searchTerm.split(/\s+/).filter(Boolean);
      const orConditions: Prisma.ClientWhereInput[] = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
      ];
      // Full name spanning firstName + lastName: require every token to appear
      // in either name field.
      if (tokens.length > 1) {
        orConditions.push({
          AND: tokens.map((tok) => ({
            OR: [
              { firstName: { contains: tok, mode: 'insensitive' } },
              { lastName: { contains: tok, mode: 'insensitive' } },
            ],
          })),
        });
      }
      const matched = await this.prisma.client.findMany({
        where: { OR: orConditions },
        select: { id: true },
      });
      searchClientIds = matched.map((c) => c.id);
    }

    const where = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.bookingId ? { bookingId: query.bookingId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.fromDate || query.toDate
        ? { createdAt: { gte: query.fromDate, lte: query.toDate } }
        : {}),
      ...(searchTerm
        ? {
            OR: [
              ...(searchClientIds.length
                ? [{ clientId: { in: searchClientIds } }]
                : []),
              ...(/^\d+$/.test(searchTerm)
                ? [{ number: Number(searchTerm) }]
                : []),
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          clientId: true,
          bookingId: true,
          subtotal: true,
          vatAmt: true,
          total: true,
          refundedAmount: true,
          currency: true,
          status: true,
          issuedAt: true,
          paidAt: true,
          sentToClientAt: true,
          pdfUrl: true,
          createdAt: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const clientIds = Array.from(new Set(items.map((i) => i.clientId).filter(Boolean)));
    const clients =
      clientIds.length > 0
        ? await this.prisma.client.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, name: true, firstName: true, lastName: true },
          })
        : [];

    const clientById = new Map(clients.map((c) => [c.id, c]));

    const rows = items.map((inv) => {
      const client = clientById.get(inv.clientId);
      return {
        id: inv.id,
        number: inv.number,
        clientId: inv.clientId,
        bookingId: inv.bookingId,
        clientName: client ? clientDisplayName(client) : null,
        subtotal: inv.subtotal,
        vatAmt: inv.vatAmt,
        total: inv.total,
        refundedAmount: inv.refundedAmount,
        currency: inv.currency,
        status: inv.status,
        issuedAt: inv.issuedAt,
        paidAt: inv.paidAt,
        sentToClientAt: inv.sentToClientAt,
        hasPdf: !!inv.pdfUrl,
        createdAt: inv.createdAt,
      };
    });

    return toListResponse(rows, total, page, limit);
  }
}
