import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileClientProfileController } from './profile.controller';
import { GetClientHandler } from '../../../modules/people/clients/get-client.handler';
import { UpdateClientHandler } from '../../../modules/people/clients/update-client.handler';
import { UpdateClientProfileHandler } from '../../../modules/identity/client-auth/update-client-profile.handler';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';

describe('MobileClientProfileController (e2e)', () => {
  let app: INestApplication;

  const mockGetClient = { execute: jest.fn() };
  const mockUpdateClient = { execute: jest.fn() };
  const mockUpdateClientProfile = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientProfileController],
      providers: [
        { provide: GetClientHandler, useValue: mockGetClient },
        { provide: UpdateClientHandler, useValue: mockUpdateClient },
        { provide: UpdateClientProfileHandler, useValue: mockUpdateClientProfile },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', organizationId: 'org-1' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /mobile/client/profile', () => {
    it('returns 200 with profile', async () => {
      mockGetClient.execute.mockResolvedValue({ id: 'client-1', name: 'Sara', phone: '+966501234567' });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/profile')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.name).toBe('Sara');
      expect(mockGetClient.execute).toHaveBeenCalledWith({ clientId: 'client-1' });
    });
  });

  describe('PATCH /mobile/client/profile', () => {
    it.each([
      ['notes', 'Internal note'],
      ['source', 'ONLINE'],
      ['isActive', false],
    ])('rejects the administrative-only %s field', async (field, value) => {
      await request(app.getHttpServer())
        .patch('/mobile/client/profile')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ [field]: value })
        .expect(400);

      expect(mockUpdateClient.execute).not.toHaveBeenCalled();
      expect(mockUpdateClientProfile.execute).not.toHaveBeenCalled();
    });

    it('returns 200 on update', async () => {
      mockUpdateClientProfile.execute.mockResolvedValue({ id: 'client-1', name: 'Sara Updated' });

      const res = await request(app.getHttpServer())
        .patch('/mobile/client/profile')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'Sara Updated' })
        .expect(200);

      expect(res.body.name).toBe('Sara Updated');
      expect(mockUpdateClientProfile.execute).toHaveBeenCalledWith('client-1', { name: 'Sara Updated' });
      expect(mockUpdateClient.execute).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid gender', async () => {
      return request(app.getHttpServer())
        .patch('/mobile/client/profile')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ gender: 'INVALID' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .patch('/mobile/client/profile')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'Test', extra: 'bad' })
        .expect(400);
    });
  });
});
