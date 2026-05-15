import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database';

export type MockPrisma = {
  [model: string]: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    groupBy: jest.Mock;
    aggregate: jest.Mock;
  };
};

export async function createTestApp(): Promise<{ app: INestApplication; prisma: MockPrisma }> {
  const prismaMock: MockPrisma = {};

  const addModel = (...names: string[]) => {
    for (const name of names) {
      prismaMock[name] = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
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
    'employeeBranch', 'employeeService', 'serviceBookingConfig',
    'serviceDurationOption', 'employeeServiceOption', 'employeeAvailabilityException',
    'contactMessage', 'file', 'platformSetting', 'emailTemplate', 'rating',
    'waitlistEntry', 'clientRefreshToken', 'customRole', 'permission', 'coupon',
    'department', 'category', 'conversation', 'chatMessage', 'fcmToken',
    'outboxEvent', 'activityLog',
  );

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
