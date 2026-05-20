import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { RecurringFrequency } from '@prisma/client';
import type { Booking, BookingType, DeliveryType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

import { randomUUID } from 'crypto';
import { CreateRecurringBookingDto } from './create-recurring-booking.dto';
import { normalizeBookingTypes } from '../shared/delivery-type.helper';

export type CreateRecurringBookingCommand = Omit<
  CreateRecurringBookingDto,
  'scheduledAt' | 'expiresAt' | 'until' | 'customDates' | 'bookingType' | 'deliveryType'
> & {
  scheduledAt: Date;
  expiresAt?: Date;
  until?: Date;
  customDates?: Date[];
  bookingType?: string;
  deliveryType?: string;
};

@Injectable()
export class CreateRecurringBookingHandler {
  private readonly logger = new Logger(CreateRecurringBookingHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(dto: CreateRecurringBookingCommand) {
    this.validate(dto);

    const { bookingType, deliveryType } = normalizeBookingTypes({
      bookingType: dto.bookingType,
      deliveryType: dto.deliveryType,
    });

    const dates = this.resolveDates(dto);
    const recurringGroupId = randomUUID();

    // Resolve snapshot data once for the series
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId },
      select: { nameAr: true, categoryId: true, currency: true },
    });
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId },
      select: { name: true },
    });
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
      select: { nameAr: true },
    });
    let categoryName: string | null = null;
    let departmentName: string | null = null;
    if (service?.categoryId) {
      const cat = await this.prisma.serviceCategory.findFirst({
        where: { id: service.categoryId },
        select: { nameAr: true, departmentId: true },
      });
      if (cat) {
        categoryName = cat.nameAr;
        if (cat.departmentId) {
          const dept = await this.prisma.department.findFirst({
            where: { id: cat.departmentId },
            select: { nameAr: true },
          });
          if (dept) departmentName = dept.nameAr;
        }
      }
    }

    const snapshots = {
      priceSnapshot: dto.price,
      durationMinutesSnapshot: dto.durationMins,
      branchNameSnapshot: branch?.nameAr ?? null,
      employeeNameSnapshot: employee?.name ?? null,
      serviceNameSnapshot: service?.nameAr ?? null,
      categoryNameSnapshot: categoryName,
      departmentNameSnapshot: departmentName,
    };

    // skipConflicts=true: best-effort — no transaction needed, partial series is intentional.
    // skipConflicts=false (default): all-or-nothing — wrap in transaction so a mid-series
    // conflict rolls back already-created bookings.
    if (dto.skipConflicts) {
      return this.createBookings(this.prisma, dto, dates, recurringGroupId, bookingType, deliveryType, snapshots);
    }
    return this.rlsTransaction.withTransaction((tx) =>
      this.createBookings(tx as unknown as PrismaService, dto, dates, recurringGroupId, bookingType, deliveryType, snapshots),
    );
  }

  private async createBookings(
    db: PrismaService,
    dto: CreateRecurringBookingCommand,
    dates: Date[],
    recurringGroupId: string,
    bookingType: BookingType,
    deliveryType: DeliveryType,
    snapshots: Record<string, unknown>,
  ): Promise<Booking[]> {
    const created: Booking[] = [];

    const lastBooking = await db.booking.findFirst({
      where: {},
      orderBy: { bookingNumber: 'desc' },
      select: { bookingNumber: true },
    });
    let currentBookingNumber = lastBooking?.bookingNumber ?? 0;

    for (const scheduledAt of dates) {
      const endsAt = new Date(scheduledAt.getTime() + dto.durationMins * 60_000);

      const conflict = await db.booking.findFirst({
        where: {
          employeeId: dto.employeeId,
          status: { in: ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] },
          scheduledAt: { lt: endsAt },
          endsAt: { gt: scheduledAt },
        },
      });

      if (conflict) {
        if (dto.skipConflicts) continue;
        throw new ConflictException(
          `Employee already has a booking at ${scheduledAt.toISOString()}`,
        );
      }

      currentBookingNumber += 1;

      const booking = await db.booking.create({
        data: {
          branchId: dto.branchId,
          clientId: dto.clientId,
          employeeId: dto.employeeId,
          serviceId: dto.serviceId,
          scheduledAt,
          endsAt,
          durationMins: dto.durationMins,
          price: dto.price,
          currency: dto.currency ?? 'SAR',
          bookingType,
          deliveryType,
          notes: dto.notes,
          expiresAt: dto.expiresAt,
          recurringGroupId,
          recurringPattern: dto.frequency,
          status: 'PENDING',
          bookingNumber: currentBookingNumber,
          ...snapshots,
        },
      });

      created.push(booking);
    }

    return created;
  }

  private validate(dto: CreateRecurringBookingCommand): void {
    if (dto.frequency === RecurringFrequency.CUSTOM) {
      if (!dto.customDates?.length) {
        throw new BadRequestException(
          'customDates is required for CUSTOM frequency',
        );
      }
      return;
    }

    const hasOccurrences = dto.occurrences !== undefined;
    const hasUntil = dto.until !== undefined;

    if (!hasOccurrences && !hasUntil) {
      throw new BadRequestException(
        'Either occurrences or until must be provided',
      );
    }
    if (hasOccurrences && hasUntil) {
      throw new BadRequestException(
        'occurrences and until are mutually exclusive',
      );
    }
    if (hasOccurrences && dto.occurrences! < 1) {
      throw new BadRequestException('occurrences must be at least 1');
    }
    if (dto.intervalDays !== undefined && dto.intervalDays < 1) {
      throw new BadRequestException('intervalDays must be at least 1');
    }
  }

  private resolveDates(dto: CreateRecurringBookingCommand): Date[] {
    if (dto.frequency === RecurringFrequency.CUSTOM) {
      return dto.customDates!.slice().sort((a, b) => a.getTime() - b.getTime());
    }

    const intervalMs = this.intervalMs(dto);
    const dates: Date[] = [];
    let current = new Date(dto.scheduledAt);

    if (dto.occurrences !== undefined) {
      for (let i = 0; i < dto.occurrences; i++) {
        dates.push(new Date(current));
        current = new Date(current.getTime() + intervalMs);
      }
    } else {
      const until = dto.until!.getTime();
      while (current.getTime() <= until) {
        dates.push(new Date(current));
        current = new Date(current.getTime() + intervalMs);
      }
    }

    return dates;
  }

  private intervalMs(dto: CreateRecurringBookingCommand): number {
    if (dto.intervalDays !== undefined) {
      return dto.intervalDays * 86400_000;
    }
    switch (dto.frequency) {
      case RecurringFrequency.WEEKLY: return 7 * 86400_000;
      case RecurringFrequency.DAILY:  return 86400_000;
      default: throw new BadRequestException(`Unsupported frequency: ${dto.frequency as string}`);
    }
  }
}
