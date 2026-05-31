import { Injectable } from '@nestjs/common';
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
    const where = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.bookingId ? { bookingId: query.bookingId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.fromDate || query.toDate
        ? { createdAt: { gte: query.fromDate, lte: query.toDate } }
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
