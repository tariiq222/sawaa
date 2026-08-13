import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingType,
  type DeliveryType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { CheckAvailabilityHandler } from '../../../bookings/check-availability/check-availability.handler';
import { assertBookingIsMutable } from '../../../bookings/booking-lifecycle.helper';
import { assertTransition } from '../../../bookings/booking-state-machine';
import { PriceResolverService } from '../../../org-experience/services/price-resolver.service';

export interface PreparedBookingPayload {
  branchId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: string;
  endsAt: string;
  durationMins: number;
  durationOptionId: string | null;
  bookingType: 'INDIVIDUAL';
  deliveryType: DeliveryType;
  price: number;
  currency: string;
}

export interface PreparedBookingSummary {
  action: 'CREATE_BOOKING';
  scheduledAt: string;
  endsAt: string;
  durationMins: number;
  price: number;
  currency: string;
  serviceName: string;
  employeeName: string;
  branchName: string;
  deliveryType: DeliveryType;
}

export interface PreparedBookingQuote {
  payload: PreparedBookingPayload;
  summary: PreparedBookingSummary;
}

export interface QuoteBookingInput {
  clientId: string;
  branchId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: string;
  durationOptionId?: string;
  deliveryType: DeliveryType;
  transaction?: Prisma.TransactionClient;
}

export interface PreparedReschedulePayload {
  bookingId: string;
  branchId: string;
  employeeId: string;
  serviceId: string;
  oldScheduledAt: string;
  newScheduledAt: string;
  newEndsAt: string;
  durationMins: number;
  durationOptionId: string | null;
  bookingType: string;
  deliveryType: DeliveryType;
  price: number;
  currency: string;
}

export interface PreparedCancellationPayload {
  bookingId: string;
  scheduledAt: string;
  durationMins: number;
  status: string;
  deliveryType: DeliveryType;
}

export interface QuoteRescheduleInput {
  clientId: string;
  bookingId: string;
  newScheduledAt: string;
  transaction?: Prisma.TransactionClient;
}

export interface QuoteCancellationInput {
  clientId: string;
  bookingId: string;
  transaction?: Prisma.TransactionClient;
}

type BookingDb = Prisma.TransactionClient;

@Injectable()
export class ChatBookingQuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceResolver: PriceResolverService,
    private readonly availability: CheckAvailabilityHandler,
  ) {}

  async quoteBooking(input: QuoteBookingInput): Promise<PreparedBookingQuote> {
    const db = (input.transaction ?? this.prisma) as unknown as BookingDb;
    const scheduledAt = this.futureDate(input.scheduledAt, 'Booking must be scheduled in the future');

    const [branch, client, employee, service, employeeService, bookingConfig] = await Promise.all([
      db.branch.findFirst({
        where: { id: input.branchId },
        select: { id: true, nameAr: true, nameEn: true, isActive: true },
      }),
      db.client.findFirst({ where: { id: input.clientId, deletedAt: null }, select: { id: true } }),
      db.employee.findFirst({
        where: { id: input.employeeId },
        select: { id: true, name: true, nameAr: true, isActive: true },
      }),
      db.service.findFirst({
        where: { id: input.serviceId },
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          isActive: true,
          archivedAt: true,
          isHidden: true,
          category: { select: { bookingMode: true } },
        },
      }),
      db.employeeService.findUnique({
        where: { employeeId_serviceId: { employeeId: input.employeeId, serviceId: input.serviceId } },
      }),
      db.serviceBookingConfig.findUnique({
        where: {
          serviceId_deliveryType: {
            serviceId: input.serviceId,
            deliveryType: input.deliveryType,
          },
        },
      }),
    ]);

    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isActive === false) throw new BadRequestException('Branch is not active');
    if (!client) throw new NotFoundException('Client not found');
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.isActive === false) throw new BadRequestException('Employee is not active');
    if (!service) throw new NotFoundException('Service not found');
    if (service.isActive === false) throw new BadRequestException('Service is not active');
    if (service.archivedAt) throw new BadRequestException('Service is archived');
    if (service.isHidden && service.category?.bookingMode !== 'DIRECT') {
      throw new BadRequestException('Service is hidden');
    }
    if (!employeeService || employeeService.isActive === false) {
      throw new BadRequestException('Employee does not provide this service');
    }
    if ((employeeService.disabledDeliveryTypes as DeliveryType[]).includes(input.deliveryType)) {
      throw new BadRequestException('Practitioner does not offer this delivery type');
    }
    if (!bookingConfig || bookingConfig.isActive === false) {
      throw new BadRequestException('Service does not support the requested delivery type');
    }

    const resolved = await this.priceResolver.resolve({
      serviceId: input.serviceId,
      employeeServiceId: employeeService.id,
      durationOptionId: input.durationOptionId ?? null,
      bookingType: BookingType.INDIVIDUAL,
      deliveryType: input.deliveryType,
      useCustomPricing: employeeService.useCustomPricing === true,
    }, input.transaction);

    const endsAt = new Date(scheduledAt.getTime() + resolved.durationMins * 60_000);
    const slots = await this.availability.execute({
      employeeId: input.employeeId,
      branchId: input.branchId,
      serviceId: input.serviceId,
      date: scheduledAt,
      durationMins: resolved.durationMins,
      bookingType: BookingType.INDIVIDUAL,
      deliveryType: input.deliveryType,
      transaction: input.transaction,
    });
    if (!slots.some((slot) => slot.startTime.getTime() === scheduledAt.getTime())) {
      throw new BadRequestException('Selected booking time is not available');
    }

    const payload: PreparedBookingPayload = {
      branchId: input.branchId,
      employeeId: input.employeeId,
      serviceId: input.serviceId,
      scheduledAt: scheduledAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMins: resolved.durationMins,
      durationOptionId: resolved.durationOptionId || null,
      bookingType: 'INDIVIDUAL',
      deliveryType: input.deliveryType,
      price: resolved.price,
      currency: resolved.currency,
    };
    return {
      payload,
      summary: {
        action: 'CREATE_BOOKING',
        scheduledAt: payload.scheduledAt,
        endsAt: payload.endsAt,
        durationMins: payload.durationMins,
        price: payload.price,
        currency: payload.currency,
        serviceName: service.nameAr ?? service.nameEn ?? '',
        employeeName: employee.nameAr ?? employee.name ?? '',
        branchName: branch.nameAr ?? branch.nameEn ?? '',
        deliveryType: payload.deliveryType,
      },
    };
  }

  async quoteReschedule(input: QuoteRescheduleInput) {
    const db = (input.transaction ?? this.prisma) as unknown as BookingDb;
    const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.clientId !== input.clientId) throw new ForbiddenException('You do not own this booking');
    assertBookingIsMutable(booking);
    assertTransition(booking.status, 'RESCHEDULE');
    if (!booking.serviceId) throw new BadRequestException('Program appointments cannot be rescheduled in chat');

    const newScheduledAt = this.futureDate(
      input.newScheduledAt,
      'New scheduled time must be in the future',
    );
    const newEndsAt = new Date(newScheduledAt.getTime() + booking.durationMins * 60_000);
    const slots = await this.availability.execute({
      employeeId: booking.employeeId,
      branchId: booking.branchId,
      serviceId: booking.serviceId,
      date: newScheduledAt,
      durationMins: booking.durationMins,
      durationOptionId: booking.durationOptionId,
      bookingType: booking.bookingType,
      deliveryType: booking.deliveryType,
      excludeBookingId: booking.id,
      transaction: input.transaction,
    });
    if (!slots.some((slot) => slot.startTime.getTime() === newScheduledAt.getTime())) {
      throw new BadRequestException('Selected booking time is not available');
    }

    const payload: PreparedReschedulePayload = {
      bookingId: booking.id,
      branchId: booking.branchId,
      employeeId: booking.employeeId,
      serviceId: booking.serviceId,
      oldScheduledAt: booking.scheduledAt.toISOString(),
      newScheduledAt: newScheduledAt.toISOString(),
      newEndsAt: newEndsAt.toISOString(),
      durationMins: booking.durationMins,
      durationOptionId: booking.durationOptionId,
      bookingType: booking.bookingType,
      deliveryType: booking.deliveryType,
      price: Number(booking.price),
      currency: booking.currency,
    };
    return {
      payload,
      summary: {
        action: 'RESCHEDULE_BOOKING' as const,
        bookingId: booking.id,
        oldScheduledAt: payload.oldScheduledAt,
        newScheduledAt: payload.newScheduledAt,
        endsAt: payload.newEndsAt,
        durationMins: payload.durationMins,
        serviceName: booking.serviceNameSnapshot ?? '',
        employeeName: booking.employeeNameSnapshot ?? '',
        branchName: booking.branchNameSnapshot ?? '',
        deliveryType: booking.deliveryType,
      },
    };
  }

  async quoteCancellation(input: QuoteCancellationInput) {
    const db = (input.transaction ?? this.prisma) as unknown as BookingDb;
    const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.clientId !== input.clientId) throw new ForbiddenException('You do not own this booking');
    assertBookingIsMutable(booking);
    if (booking.scheduledAt <= new Date()) {
      throw new BadRequestException('Only future appointments can be cancelled in chat');
    }
    if (booking.bookingType === BookingType.GROUP) {
      throw new ForbiddenException('Program enrollments can only be cancelled by staff');
    }
    assertTransition(booking.status, 'CLIENT_REQUEST_CANCEL');

    const payload: PreparedCancellationPayload = {
      bookingId: booking.id,
      scheduledAt: booking.scheduledAt.toISOString(),
      durationMins: booking.durationMins,
      status: booking.status,
      deliveryType: booking.deliveryType,
    };
    return {
      payload,
      summary: {
        action: 'CANCEL_BOOKING' as const,
        bookingId: booking.id,
        scheduledAt: payload.scheduledAt,
        durationMins: payload.durationMins,
        serviceName: booking.serviceNameSnapshot ?? '',
        employeeName: booking.employeeNameSnapshot ?? '',
        branchName: booking.branchNameSnapshot ?? '',
        deliveryType: booking.deliveryType,
      },
    };
  }

  private futureDate(value: string, message: string): Date {
    const result = new Date(value);
    if (!Number.isFinite(result.getTime()) || result <= new Date()) {
      throw new BadRequestException(message);
    }
    return result;
  }
}
