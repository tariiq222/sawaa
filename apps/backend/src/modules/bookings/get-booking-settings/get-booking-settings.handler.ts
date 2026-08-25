import { Injectable } from '@nestjs/common';
import type { BookingSettings, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';

export const BOOKING_SETTINGS_CACHE_KEY = 'ref:booking-settings';

export interface GetBookingSettingsQuery {
  branchId: string | null;
  transaction?: Prisma.TransactionClient;
}

/** Hardcoded fallback used when no DB row exists at all. */
export const DEFAULT_BOOKING_SETTINGS = {
  bufferMinutes: 0,
  freeCancelBeforeHours: 24,
  freeCancelRefundType: 'FULL' as const,
  lateCancelRefundPercent: 0,
  maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2,
  autoNoShowAfterMinutes: 30,
  minBookingLeadMinutes: 60,
  maxAdvanceBookingDays: 90,
  payAtClinicEnabled: false,
  requireCancelApproval: false,
  autoRefundOnCancel: true,
  clientRescheduleMinHoursBefore: 24,
} as const;

export type ResolvedBookingSettings = typeof DEFAULT_BOOKING_SETTINGS;

@Injectable()
export class GetBookingSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(query: GetBookingSettingsQuery): Promise<BookingSettings | ResolvedBookingSettings> {
    if (query.transaction) {
      return this.readSettings(query.branchId, query.transaction);
    }
    const cacheKey = `${BOOKING_SETTINGS_CACHE_KEY}:${query.branchId ?? 'global'}`;
    return this.cache.getOrSet(
      cacheKey,
      () => this.readSettings(query.branchId, this.prisma),
      300,
    );
  }

  private async readSettings(
    branchId: string | null,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<BookingSettings | ResolvedBookingSettings> {
    if (branchId) {
      const branchRow = await db.bookingSettings.findFirst({ where: { branchId } });
      if (branchRow) return branchRow;
    }

    const globalRow = await db.bookingSettings.findFirst({ where: { branchId: null } });
    return globalRow ?? DEFAULT_BOOKING_SETTINGS;
  }
}
