import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicBranchesController } from './branches.controller';
import { GetPublicBranchesHandler } from '../../modules/org-config/branches/public/get-public-branches.handler';
import { GetPublicBranchHandler } from '../../modules/org-config/branches/public/get-public-branch.handler';
import { ListPublicBranchEmployeesHandler } from '../../modules/org-config/branches/public/list-public-branch-employees.handler';

describe('PublicBranchesController (e2e)', () => {
  let app: INestApplication;

  const mockList = { execute: jest.fn() };
  const mockGet = { execute: jest.fn() };
  const mockEmployees = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicBranchesController],
      providers: [
        { provide: GetPublicBranchesHandler, useValue: mockList },
        { provide: GetPublicBranchHandler, useValue: mockGet },
        { provide: ListPublicBranchEmployeesHandler, useValue: mockEmployees },
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

  describe('GET /public/branches', () => {
    it('returns 200 with branch list', async () => {
      mockList.execute.mockResolvedValue([{ id: 'branch-1', name: 'Main Branch' }]);

      const res = await request(app.getHttpServer())
        .get('/public/branches')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Main Branch');
    });
  });

  describe('GET /public/branches/:id', () => {
    it('returns 200 with branch details', async () => {
      mockGet.execute.mockResolvedValue({ id: 'branch-1', name: 'Main Branch' });

      const res = await request(app.getHttpServer())
        .get('/public/branches/branch-1')
        .expect(200);

      expect(res.body.name).toBe('Main Branch');
      expect(mockGet.execute).toHaveBeenCalledWith('branch-1');
    });
  });

  describe('GET /public/branches/:id/employees', () => {
    it('returns 200 with employees list', async () => {
      mockEmployees.execute.mockResolvedValue([{ id: 'emp-1', name: 'Khalid' }]);

      const res = await request(app.getHttpServer())
        .get('/public/branches/branch-1/employees')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(mockEmployees.execute).toHaveBeenCalledWith('branch-1');
    });
  });
});
