import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { IntakeFormType } from '@prisma/client';
import { PublicIntakeFormsController } from './intake-forms.controller';
import { ResolveApplicableIntakeFormsHandler } from '../../modules/org-experience/resolve-applicable-intake-forms/resolve-applicable-intake-forms.handler';
import { SubmitIntakeResponseHandler } from '../../modules/org-experience/submit-intake-response/submit-intake-response.handler';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicIntakeFormsController (e2e)', () => {
  let app: INestApplication;

  const mockResolve = { execute: jest.fn() };
  const mockSubmit = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicIntakeFormsController],
      providers: [
        { provide: ResolveApplicableIntakeFormsHandler, useValue: mockResolve },
        { provide: SubmitIntakeResponseHandler, useValue: mockSubmit },
      ],
    })
      // The controller's POST method uses ClientSessionGuard, so the guard
      // must be overridable for the TestingModule to resolve it. The GET
      // under test is @Public() and never exercises the guard.
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', email: 'client@example.com', phone: '+966501234567' };
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

  const serviceId = '00000000-0000-4000-a000-000000000010';

  describe('GET /public/intake-forms/applicable', () => {
    it('returns 200 with the handler result when no query is supplied', async () => {
      const mocked = [{ id: 'form-1', fields: [] }];
      mockResolve.execute.mockResolvedValue(mocked);

      const res = await request(app.getHttpServer())
        .get('/public/intake-forms/applicable')
        .expect(200);

      expect(res.body).toEqual(mocked);
      expect(mockResolve.execute).toHaveBeenCalledTimes(1);
      // DTO has all-optional fields, so the pipe builds an instance with
      // every property undefined. Use objectContaining({}) to match either
      // an empty object or one with undefined-valued properties.
      expect(mockResolve.execute).toHaveBeenCalledWith(expect.objectContaining({}));
    });

    it('forwards a valid serviceId query to the handler', async () => {
      mockResolve.execute.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get(`/public/intake-forms/applicable?serviceId=${serviceId}`)
        .expect(200);

      expect(mockResolve.execute).toHaveBeenCalledTimes(1);
      expect(mockResolve.execute).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId }),
      );
    });

    it('forwards a valid IntakeFormType enum query to the handler', async () => {
      mockResolve.execute.mockResolvedValue([]);

      // Use the real enum value from @prisma/client — verified against
      // prisma/schema/organization.prisma (PRE_BOOKING is a valid member).
      const typeValue = IntakeFormType.PRE_BOOKING;

      await request(app.getHttpServer())
        .get(`/public/intake-forms/applicable?type=${typeValue}`)
        .expect(200);

      expect(mockResolve.execute).toHaveBeenCalledTimes(1);
      expect(mockResolve.execute).toHaveBeenCalledWith(
        expect.objectContaining({ type: typeValue }),
      );
    });

    it('returns 400 for a non-UUID serviceId and never invokes the handler', async () => {
      await request(app.getHttpServer())
        .get('/public/intake-forms/applicable?serviceId=nope')
        .expect(400);

      expect(mockResolve.execute).not.toHaveBeenCalled();
    });

    it('returns 400 for a type value that is not in the IntakeFormType enum', async () => {
      await request(app.getHttpServer())
        .get('/public/intake-forms/applicable?type=BOGUS')
        .expect(400);

      expect(mockResolve.execute).not.toHaveBeenCalled();
    });

    it('returns 400 for an unknown query field (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .get('/public/intake-forms/applicable?bogusField=1')
        .expect(400);

      expect(mockResolve.execute).not.toHaveBeenCalled();
    });
  });
});
