import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RefundType } from '@prisma/client';
import { UpsertBookingSettingsDto } from './upsert-booking-settings.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertBookingSettingsDto, plain);
  return validate(dto);
}

describe('UpsertBookingSettingsDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully-populated valid payload', async () => {
    const errors = await validateDto({
      bufferMinutes: 15,
      freeCancelBeforeHours: 24,
      freeCancelRefundType: RefundType.PARTIAL,
      lateCancelRefundPercent: 50,
      maxReschedulesPerBooking: 2,
      clientRescheduleMinHoursBefore: 24,
      autoCompleteAfterHours: 1,
      autoNoShowAfterMinutes: 30,
      minBookingLeadMinutes: 60,
      maxAdvanceBookingDays: 90,
      payAtClinicEnabled: true,
      requireCancelApproval: false,
      autoRefundOnCancel: true,
    });
    expect(errors).toHaveLength(0);
  });

  describe('bufferMinutes (Min(0), Max(120))', () => {
    it('accepts 0 (lower bound)', async () => {
      const errors = await validateDto({ bufferMinutes: 0 });
      expect(errors).toHaveLength(0);
    });
    it('accepts 120 (upper bound)', async () => {
      const errors = await validateDto({ bufferMinutes: 120 });
      expect(errors).toHaveLength(0);
    });
    it('rejects -1', async () => {
      const errors = await validateDto({ bufferMinutes: -1 });
      expect(errors.some((e) => e.property === 'bufferMinutes')).toBe(true);
    });
    it('rejects 121', async () => {
      const errors = await validateDto({ bufferMinutes: 121 });
      expect(errors.some((e) => e.property === 'bufferMinutes')).toBe(true);
    });
    it('rejects a non-integer', async () => {
      const errors = await validateDto({ bufferMinutes: 15.5 });
      expect(errors.some((e) => e.property === 'bufferMinutes')).toBe(true);
    });
  });

  describe('lateCancelRefundPercent (Min(0), Max(100))', () => {
    it('accepts 0 and 100', async () => {
      expect((await validateDto({ lateCancelRefundPercent: 0 }))).toHaveLength(0);
      expect((await validateDto({ lateCancelRefundPercent: 100 }))).toHaveLength(0);
    });
    it('rejects 101', async () => {
      const errors = await validateDto({ lateCancelRefundPercent: 101 });
      expect(errors.some((e) => e.property === 'lateCancelRefundPercent')).toBe(true);
    });
  });

  describe('maxAdvanceBookingDays (Min(1))', () => {
    it('accepts 1 (lower bound)', async () => {
      const errors = await validateDto({ maxAdvanceBookingDays: 1 });
      expect(errors).toHaveLength(0);
    });
    it('rejects 0', async () => {
      const errors = await validateDto({ maxAdvanceBookingDays: 0 });
      expect(errors.some((e) => e.property === 'maxAdvanceBookingDays')).toBe(true);
    });
  });

  describe('freeCancelRefundType (IsEnum(RefundType))', () => {
    it('accepts every RefundType value', async () => {
      for (const value of Object.values(RefundType)) {
        const errors = await validateDto({ freeCancelRefundType: value });
        expect(errors).toHaveLength(0);
      }
    });
    it('rejects an unknown value', async () => {
      const errors = await validateDto({ freeCancelRefundType: 'MAYBE' });
      expect(errors.some((e) => e.property === 'freeCancelRefundType')).toBe(true);
    });
  });

  describe('boolean fields', () => {
    it('accepts true / false for payAtClinicEnabled', async () => {
      expect((await validateDto({ payAtClinicEnabled: true }))).toHaveLength(0);
      expect((await validateDto({ payAtClinicEnabled: false }))).toHaveLength(0);
    });
    it('rejects a non-boolean (object — enableImplicitConversion cannot coerce)', async () => {
      const errors = await validateDto({ requireCancelApproval: { value: true } });
      expect(errors.some((e) => e.property === 'requireCancelApproval')).toBe(true);
    });
  });
});
