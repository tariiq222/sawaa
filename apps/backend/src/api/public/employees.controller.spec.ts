import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicEmployeesController } from './employees.controller';
import { ListPublicEmployeesHandler } from '../../modules/people/employees/public/list-public-employees.handler';
import { GetPublicEmployeeHandler } from '../../modules/people/employees/public/get-public-employee.handler';

describe('PublicEmployeesController (e2e)', () => {
  let app: INestApplication;

  const mockList = { execute: jest.fn() };
  const mockGet = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicEmployeesController],
      providers: [
        { provide: ListPublicEmployeesHandler, useValue: mockList },
        { provide: GetPublicEmployeeHandler, useValue: mockGet },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/employees', () => {
    it('returns 200 with public employee list', async () => {
      mockList.execute.mockResolvedValue([{ id: 'emp-1', name: 'Dr. Ahmed', slug: 'dr-ahmed' }]);

      const res = await request(app.getHttpServer())
        .get('/public/employees')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Dr. Ahmed');
    });
  });

  describe('GET /public/employees/:key', () => {
    it('returns 200 with employee details by slug', async () => {
      mockGet.execute.mockResolvedValue({ id: 'emp-1', name: 'Dr. Ahmed', slug: 'dr-ahmed' });

      const res = await request(app.getHttpServer())
        .get('/public/employees/dr-ahmed')
        .expect(200);

      expect(res.body.name).toBe('Dr. Ahmed');
      expect(mockGet.execute).toHaveBeenCalledWith('dr-ahmed');
    });

    it('returns 200 with employee details by UUID', async () => {
      mockGet.execute.mockResolvedValue({ id: '00000000-0000-4000-a000-000000000001', name: 'Dr. Ahmed' });

      const res = await request(app.getHttpServer())
        .get('/public/employees/00000000-0000-4000-a000-000000000001')
        .expect(200);

      expect(res.body.name).toBe('Dr. Ahmed');
    });
  });
});
