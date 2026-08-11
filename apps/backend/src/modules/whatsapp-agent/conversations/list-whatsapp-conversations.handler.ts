import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import type { WhatsappConversationStatus } from '@prisma/client';

export interface ListWhatsappConversationsQuery {
  status?: string;
  bookingFilter?: 'BOOKED' | 'NOT_BOOKED';
  search?: string;
  unread?: boolean;
  staffTakeover?: boolean;
  deliveryFailure?: boolean;
  from?: string;
  to?: string;
  staffUserId?: string;
  sort?: 'recent' | 'oldest';
  page: number;
  pageSize: number;
}

export interface WhatsappConversationSummary {
  id: string;
  phone: string;
  contactName: string | null;
  clientId: string | null;
  clientName: string | null;
  status: string;
  language: string;
  staffTakeover: boolean;
  unreadCount: number;
  lastInboundAt: Date | null;
  lastMessageAt: Date;
  messageCount: number;
  lastMessagePreview: string | null;
}

const VALID_STATUSES: WhatsappConversationStatus[] = [
  'ACTIVE',
  'COMPLETED',
  'ABANDONED',
  'TAKEOVER',
  'BLOCKED',
];

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

@Injectable()
export class ListWhatsappConversationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListWhatsappConversationsQuery) {
    const search = query.search?.trim();
    const matchingClients = search
      ? await this.prisma.client.findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          },
          select: { id: true },
          take: 100,
        })
      : [];

    const statuses = (query.status ?? '')
      .split(',')
      .map((status) => status.trim().toUpperCase())
      .filter((status): status is WhatsappConversationStatus =>
        VALID_STATUSES.includes(status as WhatsappConversationStatus),
      );
    const from = parseDate(query.from);
    const to = parseDate(query.to, true);
    const whatsappBookingClientIds = query.bookingFilter
      ? (await this.prisma.booking.findMany({
          where: { source: 'WHATSAPP' },
          select: { clientId: true },
          distinct: ['clientId'],
        })).map((booking) => booking.clientId)
      : [];

    const bookingFilter = query.bookingFilter === 'BOOKED'
      ? { clientId: { in: whatsappBookingClientIds } }
      : query.bookingFilter === 'NOT_BOOKED'
        ? whatsappBookingClientIds.length
          ? { OR: [{ clientId: null }, { clientId: { notIn: whatsappBookingClientIds } }] }
          : { clientId: null }
        : undefined;

    const where: Prisma.WhatsappConversationWhereInput = {
      ...(bookingFilter ? { AND: [bookingFilter] } : {}),
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(query.unread ? { unreadCount: { gt: 0 } } : {}),
      ...(typeof query.staffTakeover === 'boolean' ? { staffTakeover: query.staffTakeover } : {}),
      ...(query.staffUserId ? { staffUserId: query.staffUserId } : {}),
      ...(query.deliveryFailure
        ? {
            messages: {
              some: {
                deliveryStatus: 'FAILED',
                NOT: { errorMessage: 'STAFF_TAKEOVER' },
              },
            },
          }
        : {}),
      ...(from || to
        ? { lastMessageAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };

    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        ...(matchingClients.length ? [{ clientId: { in: matchingClients.map((client) => client.id) } }] : []),
      ];
    }

    const orderBy = query.sort === 'oldest'
      ? [{ lastMessageAt: 'asc' as const }, { id: 'asc' as const }]
      : [{ lastMessageAt: 'desc' as const }, { id: 'desc' as const }];

    const [total, rows] = await Promise.all([
      this.prisma.whatsappConversation.count({ where }),
      this.prisma.whatsappConversation.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          phone: true,
          contactName: true,
          clientId: true,
          status: true,
          language: true,
          staffTakeover: true,
          unreadCount: true,
          lastInboundAt: true,
          lastMessageAt: true,
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true },
          },
        },
      }),
    ]);

    const clientIds = rows.map((row) => row.clientId).filter((id): id is string => !!id);
    const clients = clientIds.length
      ? await this.prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : [];
    const clientNames = new Map(clients.map((client) => [client.id, client.name]));

    const items: WhatsappConversationSummary[] = rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      contactName: row.contactName,
      clientId: row.clientId,
      clientName: row.clientId ? clientNames.get(row.clientId) ?? null : null,
      status: row.status,
      language: row.language,
      staffTakeover: row.staffTakeover,
      unreadCount: row.unreadCount,
      lastInboundAt: row.lastInboundAt,
      lastMessageAt: row.lastMessageAt,
      messageCount: row._count.messages,
      lastMessagePreview: row.messages[0]?.content.slice(0, 120) ?? null,
    }));

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
}
