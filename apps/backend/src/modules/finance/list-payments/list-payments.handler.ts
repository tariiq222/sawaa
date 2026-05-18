import { Injectable } from '@nestjs/common';
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
