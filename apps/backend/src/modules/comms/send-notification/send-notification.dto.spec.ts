import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendNotificationDto } from './send-notification.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SendNotificationDto, plain);
  return validate(dto);
}

describe('SendNotificationDto', () => {
  const valid: Record<string, unknown> = {
    recipientId: '00000000-0000-0000-0000-000000000000',
    recipientType: 'CLIENT',
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Confirmed',
    body: 'Your appointment is confirmed for tomorrow at 10 AM.',
    channels: ['push', 'in-app'],
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with all optional channel-specific fields', async () => {
    const errors = await validateDto({
      ...valid,
      metadata: { bookingId: '00000000-0000-0000-0000-000000000000' },
      fcmToken: 'fcm-tok',
      fcmTokens: ['fcm-1', 'fcm-2'],
      recipientEmail: 'user@example.com',
      emailTemplateSlug: 'booking-confirmed',
      emailVars: { name: 'Fatima' },
      recipientPhone: '+966501234567',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing recipientId', async () => {
    const errors = await validateDto({ ...valid, recipientId: undefined });
    expect(errors.some((e) => e.property === 'recipientId')).toBe(true);
  });

  it('rejects a non-UUID recipientId', async () => {
    const errors = await validateDto({ ...valid, recipientId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'recipientId')).toBe(true);
  });

  it('rejects an unknown recipientType', async () => {
    const errors = await validateDto({ ...valid, recipientType: 'GUEST' });
    expect(errors.some((e) => e.property === 'recipientType')).toBe(true);
  });

  it('rejects an unknown notification type', async () => {
    const errors = await validateDto({ ...valid, type: 'SPAM' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects an empty channels array (ArrayNotEmpty)', async () => {
    const errors = await validateDto({ ...valid, channels: [] });
    expect(errors.some((e) => e.property === 'channels')).toBe(true);
  });

  it('rejects a channels entry outside the enum', async () => {
    const errors = await validateDto({ ...valid, channels: ['push', 'fax'] });
    expect(errors.some((e) => e.property === 'channels')).toBe(true);
  });

  it('rejects a non-array channels value', async () => {
    const errors = await validateDto({ ...valid, channels: 'push' });
    expect(errors.some((e) => e.property === 'channels')).toBe(true);
  });

  it('rejects an empty title', async () => {
    const errors = await validateDto({ ...valid, title: '' });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects an empty body', async () => {
    const errors = await validateDto({ ...valid, body: '' });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects a non-email recipientEmail', async () => {
    const errors = await validateDto({ ...valid, recipientEmail: 'not-an-email' });
    expect(errors.some((e) => e.property === 'recipientEmail')).toBe(true);
  });

  it('rejects fcmTokens with a non-string entry', async () => {
    const errors = await validateDto({ ...valid, fcmTokens: ['ok', 123] });
    expect(errors.some((e) => e.property === 'fcmTokens')).toBe(true);
  });

  it('rejects metadata that is not a plain object', async () => {
    const errors = await validateDto({ ...valid, metadata: 'string-not-object' });
    expect(errors.some((e) => e.property === 'metadata')).toBe(true);
  });
});
