import { Injectable } from '@nestjs/common';
import type { BookingSettings, RefundType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

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
  ) {}

  async execute(cmd: UpsertBookingSettingsCommand): Promise<BookingSettings> {
    const { branchId, ...fields } = cmd;

    const updateData = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );

    const existing = branchId
      ? await this.prisma.bookingSettings.findFirst({ where: { branchId } })
      : await this.prisma.bookingSettings.findFirst({ where: { branchId: null } });

    if (existing) {
      return this.prisma.bookingSettings.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    return this.prisma.bookingSettings.create({
      data: { branchId, ...updateData },
    });
  }
}
