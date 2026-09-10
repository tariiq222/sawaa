import { BadRequestException, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { CreateBookingDto } from '../../modules/bookings/create-booking/create-booking.dto';
import { CollectBookingPaymentDto } from '../../modules/finance/collect-booking-payment/collect-booking-payment.dto';
import { configureHttpContract } from './configure-http-contract';

type AppRecorder = {
  setGlobalPrefix: jest.Mock;
  enableVersioning: jest.Mock;
  useGlobalPipes: jest.Mock;
};

function createAppRecorder(): AppRecorder {
  return {
    setGlobalPrefix: jest.fn(),
    enableVersioning: jest.fn(),
    useGlobalPipes: jest.fn(),
  };
}

function getPipe(app: AppRecorder): ValidationPipe {
  return app.useGlobalPipes.mock.calls[0][0] as ValidationPipe;
}

describe('configureHttpContract', () => {
  it('registers the api prefix, URI v1 default, and strict production validation', () => {
    const app = createAppRecorder();

    configureHttpContract(app as unknown as INestApplication, 'production');

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.enableVersioning).toHaveBeenCalledWith({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
  });

  it('accepts a numeric amount and rejects a numeric string for the real collection DTO in production', async () => {
    const app = createAppRecorder();
    configureHttpContract(app as unknown as INestApplication, 'production');
    const pipe = getPipe(app);

    await expect(pipe.transform(
      { method: PaymentMethod.CASH, amount: 1000 },
      { type: 'body', metatype: CollectBookingPaymentDto, data: undefined },
    )).resolves.toMatchObject({ method: PaymentMethod.CASH, amount: 1000 });

    await expect(pipe.transform(
      { method: PaymentMethod.CASH, amount: '1000' },
      { type: 'body', metatype: CollectBookingPaymentDto, data: undefined },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retains implicit conversion for the development profile', async () => {
    const app = createAppRecorder();
    configureHttpContract(app as unknown as INestApplication, 'development');
    const pipe = getPipe(app);

    await expect(pipe.transform(
      { method: PaymentMethod.CASH, amount: '1000' },
      { type: 'body', metatype: CollectBookingPaymentDto, data: undefined },
    )).resolves.toMatchObject({ method: PaymentMethod.CASH, amount: 1000 });
  });

  it('rejects unknown collection fields instead of silently stripping them', async () => {
    const app = createAppRecorder();
    configureHttpContract(app as unknown as INestApplication, 'production');
    const pipe = getPipe(app);

    await expect(pipe.transform(
      { method: PaymentMethod.CASH, unexpected: 'should fail' },
      { type: 'body', metatype: CollectBookingPaymentDto, data: undefined },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserves boolean false and rejects the string "false" for the real booking DTO in production', async () => {
    const app = createAppRecorder();
    configureHttpContract(app as unknown as INestApplication, 'production');
    const pipe = getPipe(app);
    const validBooking = {
      branchId: '00000000-0000-4000-a000-000000000001',
      clientId: '00000000-0000-4000-a000-000000000002',
      employeeId: '00000000-0000-4000-a000-000000000003',
      serviceId: '00000000-0000-4000-a000-000000000004',
      scheduledAt: '2026-09-05T12:00:00.000Z',
    };

    await expect(pipe.transform(
      { ...validBooking, payAtClinic: false },
      { type: 'body', metatype: CreateBookingDto, data: undefined },
    )).resolves.toMatchObject({ payAtClinic: false });

    await expect(pipe.transform(
      { ...validBooking, payAtClinic: 'false' },
      { type: 'body', metatype: CreateBookingDto, data: undefined },
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
