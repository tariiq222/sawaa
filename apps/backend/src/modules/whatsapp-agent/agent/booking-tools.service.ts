// booking-tools — wraps the public booking/availability API for the LLM.
//
// The agent orchestrator passes these tool definitions to ChatAdapter; the
// model returns a tool_call, we execute the matching function, and the
// result rejoins the conversation as a `tool` message.
//
// MVP approach: the agent doesn't create the booking directly. It collects
// the full intent (name, email, phone, service, employee, time, payment
// method) and writes a ContactMessage so the staff can finalize in the
// dashboard. This avoids re-implementing the slot-availability / overlap
// exclusion / price-resolution logic in two places.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetPublicAvailabilityHandler } from '../../bookings/availability/public/get-public-availability.handler';

export interface ToolContext {
  phone: string;
}

interface CollectedIntent {
  name?: string;
  email?: string;
  serviceId?: string;
  serviceName?: string;
  employeeId?: string;
  employeeName?: string;
  scheduledAt?: string;
  paymentMethod?: 'payAtClinic' | 'online';
  notes?: string;
}

@Injectable()
export class BookingToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicAvailability: GetPublicAvailabilityHandler,
  ) {}

  listTools() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'listServices',
          description:
            'List available consultation services (id, nameAr, nameEn, durations, prices).',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'listCounselors',
          description: 'List public counselors (id, name, bio). Optionally filter by serviceId.',
          parameters: {
            type: 'object',
            properties: {
              serviceId: {
                type: 'string',
                description: 'Optional service UUID to filter by',
              },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'checkAvailability',
          description:
            'Return exact currently bookable slots for a counselor on a date.',
          parameters: {
            type: 'object',
            properties: {
              employeeId: { type: 'string' },
              date: { type: 'string', description: 'YYYY-MM-DD' },
              serviceId: { type: 'string' },
              branchId: { type: 'string' },
              durationOptionId: { type: 'string' },
              deliveryType: { type: 'string', enum: ['IN_PERSON', 'ONLINE'] },
            },
            required: ['employeeId', 'date'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'collectBookingIntent',
          description:
            'Persist the full booking intent. Used after the customer has confirmed service, counselor, date/time, contact info, and payment method. The staff will finalize the booking in the dashboard.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              serviceId: { type: 'string' },
              serviceName: { type: 'string' },
              employeeId: { type: 'string' },
              employeeName: { type: 'string' },
              scheduledAt: { type: 'string', description: 'ISO 8601 datetime' },
              paymentMethod: { type: 'string', enum: ['payAtClinic', 'online'] },
              notes: { type: 'string' },
            },
            required: ['name', 'serviceId', 'employeeId', 'scheduledAt', 'paymentMethod'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'lookupClient',
          description:
            'Look up an existing client by phone. Returns { found: true, clientId, name } or { found: false }.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'listMyBookings',
          description: 'List the upcoming bookings for this phone number.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'cancelBookingRequest',
          description:
            'Record a cancellation request. Staff will finalize in the dashboard.',
          parameters: {
            type: 'object',
            properties: {
              bookingId: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['bookingId'],
            additionalProperties: false,
          },
        },
      },
    ];
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<unknown> {
    switch (toolName) {
      case 'listServices':
        return this.listServices();
      case 'listCounselors':
        return this.listCounselors(args.serviceId as string | undefined);
      case 'checkAvailability':
        return this.checkAvailability(args);
      case 'collectBookingIntent':
        return this.collectBookingIntent(ctx.phone, args);
      case 'lookupClient':
        return this.lookupClient(ctx.phone);
      case 'listMyBookings':
        return this.listMyBookings(ctx.phone);
      case 'cancelBookingRequest':
        return this.cancelBookingRequest(ctx.phone, args.bookingId as string, args.reason as string | undefined);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // ── Tool implementations ──────────────────────────────────────────────────

  private async listServices() {
    const services = await this.prisma.service.findMany({
      where: { isActive: true, isHidden: false },
      orderBy: { nameAr: 'asc' },
      take: 30,
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        durationMins: true,
        durationOptions: {
          where: { isActive: true },
          orderBy: { durationMins: 'asc' },
          select: { id: true, durationMins: true, price: true },
        },
      },
    });
    return services.map((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      durationMins: s.durationMins,
      durationOptions: s.durationOptions.map((d: { id: string; durationMins: number; price: unknown }) => ({
        id: d.id,
        durationMins: d.durationMins,
        price: Number(d.price),
      })),
    }));
  }

  private async listCounselors(serviceId?: string) {
    const where: Record<string, unknown> = {
      isActive: true,
      isPublic: true,
      deletedAt: null,
    };
    if (serviceId) {
      where['employeeServices'] = { some: { serviceId } };
    }
    const employees = await this.prisma.employee.findMany({
      where,
      take: 30,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
    });
    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      bio: e.bio,
      avatarUrl: e.avatarUrl,
    }));
  }

  private async checkAvailability(args: Record<string, unknown>) {
    const date = args.date as string;
    const slots = await this.publicAvailability.execute({
      employeeId: args.employeeId as string,
      date,
      serviceId: args.serviceId as string | undefined,
      branchId: args.branchId as string | undefined,
      durationOptionId: args.durationOptionId as string | undefined,
      deliveryType: args.deliveryType as 'IN_PERSON' | 'ONLINE' | undefined,
    });
    return {
      available: slots.length > 0,
      date,
      slots: slots.map((slot) => ({
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
      })),
    };
  }

  private async collectBookingIntent(phone: string, args: Record<string, unknown>) {
    const intent: CollectedIntent = {
      name: args.name as string,
      email: args.email as string | undefined,
      serviceId: args.serviceId as string,
      serviceName: args.serviceName as string | undefined,
      employeeId: args.employeeId as string,
      employeeName: args.employeeName as string | undefined,
      scheduledAt: args.scheduledAt as string,
      paymentMethod: args.paymentMethod as 'payAtClinic' | 'online',
      notes: args.notes as string | undefined,
    };

    const body = JSON.stringify(intent, null, 2);
    const subject = `WhatsApp booking intent — ${intent.name} — ${intent.scheduledAt}`;
    await this.prisma.contactMessage.create({
      data: {
        name: intent.name ?? 'Unknown',
        phone,
        email: intent.email ?? null,
        subject,
        body: `Customer requested booking via WhatsApp. Staff to finalize:\n\n${body}`,
        status: 'NEW',
      },
    });

    return {
      ok: true,
      message: 'Booking intent recorded. Staff will confirm in the dashboard.',
      reference: subject,
    };
  }

  private async lookupClient(phone: string) {
    const client = await this.prisma.client.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true, name: true },
    });
    return client
      ? { found: true, clientId: client.id, name: client.name }
      : { found: false };
  }

  private async listMyBookings(phone: string) {
    const client = await this.prisma.client.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true },
    });
    if (!client) return { found: false, bookings: [] };
    const bookings = await this.prisma.booking.findMany({
      where: {
        clientId: client.id,
        scheduledAt: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
      },
    });
    return { found: true, bookings };
  }

  private async cancelBookingRequest(phone: string, bookingId: string, reason?: string) {
    const client = await this.prisma.client.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new Error('No client found for this phone');

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, clientId: client.id },
    });
    if (!booking) throw new Error('Booking not found');

    await this.prisma.contactMessage.create({
      data: {
        name: 'WhatsApp cancel request',
        phone,
        subject: `Cancel request — booking ${bookingId}`,
        body: `Customer requests to cancel booking ${bookingId}.\nReason: ${reason ?? 'not provided'}`,
        status: 'NEW',
      },
    });

    return { ok: true, message: 'Cancellation request recorded. Staff will process shortly.' };
  }
}
