import { Injectable } from '@nestjs/common';
import type { BookingSettings, RefundType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { BOOKING_SETTINGS_CACHE_KEY } from '../get-booking-settings/get-booking-settings.handler';

export interface UpsertBookingSettingsCommand {
  branchId: string | null;
  bufferMinutes?: number;
  freeCancelBeforeHours?: number;
  freeCancelRefundType?: RefundType;
  lateCancelRefundPercent?: number;
  maxReschedulesPerBooking?: number;
  clientRescheduleMinHoursBefore?: number;
  autoCompleteAfterHours?: number;
  autoNoShowAfterMinutes?: number;
  minBookingLeadMinutes?: number;
  maxAdvanceBookingDays?: number;
  payAtClinicEnabled?: boolean;
  requireCancelApproval?: boolean;
  autoRefundOnCancel?: boolean;
}

@Injectable()
export class UpsertBookingSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(cmd: UpsertBookingSettingsCommand): Promise<BookingSettings> {
    const { branchId, ...fields } = cmd;

    const updateData = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );

    const existing = branchId
      ? await this.prisma.bookingSettings.findFirst({ where: { branchId } })
      : await this.prisma.bookingSettings.findFirst({ where: { branchId: null } });

    const result = existing
      ? await this.prisma.bookingSettings.update({
          where: { id: existing.id },
          data: updateData,
        })
      : await this.prisma.bookingSettings.create({
          data: { branchId, ...updateData },
        });

    await this.cache.invalidatePrefix(BOOKING_SETTINGS_CACHE_KEY);
    return result;
  }
}
