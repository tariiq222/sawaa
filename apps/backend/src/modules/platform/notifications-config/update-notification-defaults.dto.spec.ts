import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  FcmCredentialsDto,
  NotificationChannel,
  QuietHoursDto,
  UpdateNotificationDefaultsDto,
} from './update-notification-defaults.dto';

async function validateDto(cls: new () => object, plain: Record<string, unknown>) {
  const dto = plainToInstance(cls, plain);
  return validate(dto as object);
}

describe('QuietHoursDto', () => {
  const valid = { startHour: 22, endHour: 7, timezone: 'Asia/Riyadh' };

  it('accepts a valid quiet-hours payload', async () => {
    const errors = await validateDto(QuietHoursDto, valid);
    expect(errors).toHaveLength(0);
  });

  describe('startHour (IsInt + Min(0) + Max(23))', () => {
    it('accepts 0 and 23 (bounds)', async () => {
      expect((await validateDto(QuietHoursDto, { ...valid, startHour: 0 }))).toHaveLength(0);
      expect((await validateDto(QuietHoursDto, { ...valid, startHour: 23 }))).toHaveLength(0);
    });
    it('rejects -1', async () => {
      const errors = await validateDto(QuietHoursDto, { ...valid, startHour: -1 });
      expect(errors.some((e) => e.property === 'startHour')).toBe(true);
    });
    it('rejects 24', async () => {
      const errors = await validateDto(QuietHoursDto, { ...valid, startHour: 24 });
      expect(errors.some((e) => e.property === 'startHour')).toBe(true);
    });
    it('rejects a non-integer', async () => {
      const errors = await validateDto(QuietHoursDto, { ...valid, startHour: 12.5 });
      expect(errors.some((e) => e.property === 'startHour')).toBe(true);
    });
  });

  describe('endHour (IsInt + Min(0) + Max(23))', () => {
    it('accepts 0 and 23 (bounds)', async () => {
      expect((await validateDto(QuietHoursDto, { ...valid, endHour: 0 }))).toHaveLength(0);
      expect((await validateDto(QuietHoursDto, { ...valid, endHour: 23 }))).toHaveLength(0);
    });
    it('rejects 24', async () => {
      const errors = await validateDto(QuietHoursDto, { ...valid, endHour: 24 });
      expect(errors.some((e) => e.property === 'endHour')).toBe(true);
    });
  });

  describe('timezone (IsString)', () => {
    it('rejects a non-string', async () => {
      const errors = await validateDto(QuietHoursDto, { ...valid, timezone: { tz: 'x' } });
      expect(errors.some((e) => e.property === 'timezone')).toBe(true);
    });
    it('rejects a missing timezone', async () => {
      const errors = await validateDto(QuietHoursDto, { startHour: 22, endHour: 7 });
      expect(errors.some((e) => e.property === 'timezone')).toBe(true);
    });
  });

  it('rejects a missing startHour', async () => {
    const errors = await validateDto(QuietHoursDto, { endHour: 7, timezone: 'Asia/Riyadh' });
    expect(errors.some((e) => e.property === 'startHour')).toBe(true);
  });

  it('rejects a missing endHour', async () => {
    const errors = await validateDto(QuietHoursDto, { startHour: 22, timezone: 'Asia/Riyadh' });
    expect(errors.some((e) => e.property === 'endHour')).toBe(true);
  });
});

describe('FcmCredentialsDto', () => {
  it('accepts an empty payload (every field is optional)', async () => {
    const errors = await validateDto(FcmCredentialsDto, {});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully-populated valid payload', async () => {
    const errors = await validateDto(FcmCredentialsDto, {
      serverKey: 'AAAA...',
      projectId: 'my-fcm-project',
      clientEmail: 'fcm@my-project.iam.gserviceaccount.com',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string serverKey', async () => {
    const errors = await validateDto(FcmCredentialsDto, { serverKey: 12345 });
    expect(errors.some((e) => e.property === 'serverKey')).toBe(true);
  });

  it('rejects a non-string projectId', async () => {
    const errors = await validateDto(FcmCredentialsDto, { projectId: { id: 'x' } });
    expect(errors.some((e) => e.property === 'projectId')).toBe(true);
  });

  it('rejects a non-string clientEmail', async () => {
    const errors = await validateDto(FcmCredentialsDto, { clientEmail: ['a@b.c'] });
    expect(errors.some((e) => e.property === 'clientEmail')).toBe(true);
  });
});

describe('UpdateNotificationDefaultsDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto(UpdateNotificationDefaultsDto, {});
    expect(errors).toHaveLength(0);
  });

  describe('defaultChannels (IsArray + IsEnum each)', () => {
    it('accepts every allowed channel value', async () => {
      const errors = await validateDto(UpdateNotificationDefaultsDto, {
        defaultChannels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH, NotificationChannel.IN_APP],
      });
      expect(errors).toHaveLength(0);
    });
    it('rejects an unknown channel value', async () => {
      const errors = await validateDto(UpdateNotificationDefaultsDto, {
        defaultChannels: ['FAX'],
      });
      expect(errors.some((e) => e.property === 'defaultChannels')).toBe(true);
    });
    it('rejects a non-array', async () => {
      const errors = await validateDto(UpdateNotificationDefaultsDto, {
        defaultChannels: 'EMAIL',
      });
      expect(errors.some((e) => e.property === 'defaultChannels')).toBe(true);
    });
  });

  it('validates a nested quietHours object', async () => {
    const errors = await validateDto(UpdateNotificationDefaultsDto, {
      quietHours: { startHour: 22, endHour: 7, timezone: 'Asia/Riyadh' },
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a quietHours object with an out-of-range hour', async () => {
    const errors = await validateDto(UpdateNotificationDefaultsDto, {
      quietHours: { startHour: 25, endHour: 7, timezone: 'Asia/Riyadh' },
    });
    expect(errors.some((e) => e.property === 'quietHours')).toBe(true);
  });

  it('validates a nested fcm object', async () => {
    const errors = await validateDto(UpdateNotificationDefaultsDto, {
      fcm: { projectId: 'my-fcm-project' },
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a fcm object with a non-string serverKey', async () => {
    const errors = await validateDto(UpdateNotificationDefaultsDto, {
      fcm: { serverKey: 42 },
    });
    expect(errors.some((e) => e.property === 'fcm')).toBe(true);
  });
});
