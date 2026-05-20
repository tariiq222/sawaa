import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database';

export type MockPrisma = {
  [model: string]: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    createMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    count: jest.Mock;
    groupBy: jest.Mock;
    aggregate: jest.Mock;
  };
};

export function createAuthToken(jwtService: JwtService, payload: object = {}): string {
  return jwtService.sign({ sub: 'user-1', email: 'owner@sawaa.app', role: 'OWNER', isSuperAdmin: true, ...payload });
}

export async function createTestApp(): Promise<{ app: INestApplication; prisma: MockPrisma }> {
  const prismaMock: MockPrisma = {};

  const addModel = (...names: string[]) => {
    for (const name of names) {
      prismaMock[name] = {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findFirstOrThrow: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: {} }),
      };
    }
  };

  addModel(
    'user', 'client', 'employee', 'branch', 'service', 'booking', 'invoice',
    'payment', 'refundRequest', 'groupSession', 'groupEnrollment', 'notification',
    'notificationDeliveryLog', 'smsDelivery', 'organizationEmailConfig',
    'organizationSmsConfig', 'organizationPaymentConfig', 'brandingConfig',
    'employeeBranch', 'employeeService', 'employeeServiceType', 'employeeAvailability',
    'serviceBookingConfig', 'serviceDurationOption', 'employeeServiceOption',
    'employeeAvailabilityException', 'employeeBreak', 'businessHour', 'holiday',
    'bookingSettings', 'bookingStatusLog', 'bookingClient', 'serviceBundle', 'serviceBundleItem',
    'intakeForm', 'intakeField', 'intakeResponse', 'organizationSettings',
    'contactMessage', 'file', 'platformSetting', 'emailTemplate', 'rating',
    'waitlistEntry', 'clientRefreshToken', 'customRole', 'permission', 'coupon',
    'department', 'category', 'serviceCategory', 'conversation', 'chatMessage', 'fcmToken',
    'outboxEvent', 'activityLog',
  );

  (prismaMock as unknown as { $transaction: jest.Mock }).$transaction = jest.fn(
    (arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prismaMock)
          : Promise.resolve(undefined),
  );
  (prismaMock as unknown as { $executeRaw: jest.Mock }).$executeRaw = jest.fn().mockResolvedValue(0);
  (prismaMock as unknown as { $executeRawUnsafe: jest.Mock }).$executeRawUnsafe = jest.fn().mockResolvedValue(0);
  (prismaMock as unknown as { $queryRaw: jest.Mock }).$queryRaw = jest.fn().mockResolvedValue([]);
  (prismaMock as unknown as { $queryRawUnsafe: jest.Mock }).$queryRawUnsafe = jest.fn().mockResolvedValue([]);

  prismaMock.user.findUnique = jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'owner@sawaa.app',
    role: 'OWNER',
    isActive: true,
    isSuperAdmin: true,
    tokenVersion: 0,
    customRoleId: null,
    customRole: null,
  });

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaMock as unknown as PrismaService)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix('api/v1');

  await app.init();

  return { app, prisma: prismaMock };
}

export { request };
