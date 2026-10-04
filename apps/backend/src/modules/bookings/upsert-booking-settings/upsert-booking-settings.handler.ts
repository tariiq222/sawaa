import { BadRequestException, Injectable } from '@nestjs/common';
import type { BookingSettings, ClientCancelCutoffMode, RefundType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { BOOKING_SETTINGS_CACHE_KEY, DEFAULT_BOOKING_SETTINGS } from '../get-booking-settings/get-booking-settings.handler';

export interface UpsertBookingSettingsCommand {
  branchId: string | null;
  clientCancellationPolicyEnabled?: boolean;
  clientCancelCutoffMode?: ClientCancelCutoffMode | null;
  clientCancelBeforeHours?: number | null;
  earlyCancelRefundPercent?: number | null;
  bufferMinutes?: number;
  freeCancelBeforeHours?: number;
  freeCancelRefundType?: RefundType;
  lateCancelRefundPercent?: number;
  maxReschedulesPerBooking?: number;
  clientRescheduleMinHoursBefore?: number;
  autoCompleteAfterHours?: number;
  autoNoShowAfterMinutes?: number;
  autoNoShowAfterEnd?: boolean;
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

    const effective = { ...DEFAULT_BOOKING_SETTINGS, ...existing, ...updateData };
    if (typeof effective.clientCancellationPolicyEnabled !== 'boolean') {
      throw new BadRequestException('clientCancellationPolicyEnabled must be boolean');
    }
    if (effective.clientCancelCutoffMode != null &&
        !['BEFORE_START', 'BEFORE_CHECK_IN'].includes(effective.clientCancelCutoffMode)) {
      throw new BadRequestException('Invalid client cancellation cutoff mode');
    }
    for (const [field, max] of [['clientCancelBeforeHours', Infinity], ['earlyCancelRefundPercent', 100]] as const) {
      const value = effective[field];
      if (value != null && (!Number.isInteger(value) || value < 0 || value > max)) {
        throw new BadRequestException(`${field} must be a non-negative integer${max === 100 ? ' up to 100' : ''}`);
      }
    }
    if (effective.clientCancellationPolicyEnabled) {
      if (!effective.clientCancelCutoffMode ||
          (effective.clientCancelCutoffMode === 'BEFORE_START' && effective.clientCancelBeforeHours == null)) {
        throw new BadRequestException('Configure the client cancellation cutoff before enabling the policy');
      }
      if (effective.freeCancelRefundType === 'PARTIAL' && effective.earlyCancelRefundPercent == null) {
        throw new BadRequestException('Configure an early cancellation refund percentage for partial refunds');
      }
    }

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
