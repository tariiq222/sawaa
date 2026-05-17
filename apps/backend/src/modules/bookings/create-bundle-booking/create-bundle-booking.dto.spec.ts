import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBundleBookingDto } from './create-bundle-booking.dto';

const validPayload = {
  branchId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  clientId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  employeeId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  bundleId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  scheduledAt: '2027-01-01T09:00:00.000Z',
};

describe('CreateBundleBookingDto', () => {
  it('validates a valid payload successfully', async () => {
    const dto = plainToInstance(CreateBundleBookingDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts optional notes and payAtClinic', async () => {
    const dto = plainToInstance(CreateBundleBookingDto, {
      ...validPayload,
      notes: 'Client prefers quiet room',
      payAtClinic: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when bundleId is not a UUID', async () => {
    const dto = plainToInstance(CreateBundleBookingDto, {
      ...validPayload,
      bundleId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    const bundleIdError = errors.find((e) => e.property === 'bundleId');
    expect(bundleIdError).toBeDefined();
  });

  it('fails when scheduledAt is not an ISO date string', async () => {
    const dto = plainToInstance(CreateBundleBookingDto, {
      ...validPayload,
      scheduledAt: 'not-a-date',
    });
    const errors = await validate(dto);
    const scheduledAtError = errors.find((e) => e.property === 'scheduledAt');
    expect(scheduledAtError).toBeDefined();
  });

  it('fails when branchId is not a UUID', async () => {
    const dto = plainToInstance(CreateBundleBookingDto, {
      ...validPayload,
      branchId: 'bad-id',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'branchId');
    expect(err).toBeDefined();
  });

  it('fails when clientId is not a UUID', async () => {
    const dto = plainToInstance(CreateBundleBookingDto, {
      ...validPayload,
      clientId: 'bad-id',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'clientId');
    expect(err).toBeDefined();
  });

  it('fails when employeeId is not a UUID', async () => {
    const dto = plainToInstance(CreateBundleBookingDto, {
      ...validPayload,
      employeeId: 'bad-id',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'employeeId');
    expect(err).toBeDefined();
  });

  it('fails when required fields are missing', async () => {
    const dto = plainToInstance(CreateBundleBookingDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});
