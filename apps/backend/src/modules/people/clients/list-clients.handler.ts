import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListClientsDto } from './list-clients.dto';
import { serializeClient } from './client.serializer';

/**
 * Normalizes a search term to the canonical Saudi local mobile suffix so a
 * phone search matches regardless of how the user typed the number.
 * "056", "0560566676", "+966560566676", "966560566676", "560566676" all
 * collapse to a digit string starting at the leading 5 (or the raw digits
 * if no normalization applies). Returns null when the term has no digits.
 */
function toPhoneSearch(term: string): string | null {
  const digits = term.replace(/\D/g, '');
  if (!digits) return null;
  let local = digits;
  if (local.startsWith('966')) local = local.slice(3);
  if (local.startsWith('0')) local = local.replace(/^0+/, '');
  return local || null;
}

export type ListClientsQuery = ListClientsDto & {
  page: number;
  limit: number;
};

@Injectable()
export class ListClientsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListClientsQuery) {
    const where = {
      deletedAt: null,
      isActive: query.isActive,
      gender: query.gender,
      source: query.source,
      ...(query.search
        ? (() => {
            const term = query.search;
            const phoneSearch = toPhoneSearch(term);
            const or: Array<Record<string, unknown>> = [
              { name: { contains: term, mode: 'insensitive' as const } },
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { lastName: { contains: term, mode: 'insensitive' as const } },
              // Phone: match on the normalized local suffix so the +966 prefix
              // and any leading zero the user typed are ignored.
              { phone: { contains: phoneSearch ?? term, mode: 'insensitive' as const } },
              { email: { contains: term, mode: 'insensitive' as const } },
            ];
            return { OR: or };
          })()
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    const bookingSummaries = await this.loadBookingSummaries(
      items.map((c) => c.id),
    );

    return toListResponse(
      items.map((c) =>
        serializeClient(c, {
          lastBooking: bookingSummaries.last.get(c.id) ?? null,
          nextBooking: bookingSummaries.next.get(c.id) ?? null,
        }),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  // Pulls the most recent past booking and the next future booking per client.
  // Done as two bulk groupBy-style queries so the list endpoint stays O(1)
  // round-trips regardless of page size.
  private async loadBookingSummaries(
    clientIds: string[],
  ) {
    const empty = {
      last: new Map<string, { id: string; date: string; status: string }>(),
      next: new Map<string, { id: string; date: string; status: string }>(),
    };
    if (clientIds.length === 0) return empty;

    const now = new Date();

    const [pastBookings, futureBookings] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          clientId: { in: clientIds },
          scheduledAt: { lte: now },
        },
        orderBy: { scheduledAt: 'desc' },
        select: { id: true, clientId: true, scheduledAt: true, status: true },
      }),
      this.prisma.booking.findMany({
        where: {
          clientId: { in: clientIds },
          scheduledAt: { gt: now },
        },
        orderBy: { scheduledAt: 'asc' },
        select: { id: true, clientId: true, scheduledAt: true, status: true },
      }),
    ]);

    const last = new Map<string, { id: string; date: string; status: string }>();
    for (const b of pastBookings) {
      if (!last.has(b.clientId)) {
        last.set(b.clientId, {
          id: b.id,
          date: b.scheduledAt.toISOString(),
          status: b.status,
        });
      }
    }

    const next = new Map<string, { id: string; date: string; status: string }>();
    for (const b of futureBookings) {
      if (!next.has(b.clientId)) {
        next.set(b.clientId, {
          id: b.id,
          date: b.scheduledAt.toISOString(),
          status: b.status,
        });
      }
    }

    return { last, next };
  }
}
