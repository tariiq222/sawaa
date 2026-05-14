import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardIdentityController } from './identity.controller';
import { ListUsersHandler } from '../../modules/identity/users/list-users.handler';
import { GetUserHandler } from '../../modules/identity/users/get-user.handler';
import { CreateUserHandler } from '../../modules/identity/users/create-user.handler';
import { UpdateUserHandler } from '../../modules/identity/users/update-user.handler';
import { DeactivateUserHandler } from '../../modules/identity/users/deactivate-user.handler';
import { DeleteUserHandler } from '../../modules/identity/users/delete-user.handler';
import { AssignRoleHandler } from '../../modules/identity/users/assign-role.handler';
import { RemoveRoleHandler } from '../../modules/identity/users/remove-role.handler';
import { ListRolesHandler } from '../../modules/identity/roles/list-roles.handler';
import { CreateRoleHandler } from '../../modules/identity/roles/create-role.handler';
import { DeleteRoleHandler } from '../../modules/identity/roles/delete-role.handler';
import { AssignPermissionsHandler } from '../../modules/identity/roles/assign-permissions.handler';
import { ListPermissionsHandler } from '../../modules/identity/roles/list-permissions.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardIdentityController (e2e)', () => {
  let app: INestApplication;

  const mockListUsers = { execute: jest.fn() };
  const mockGetUser = { execute: jest.fn() };
  const mockCreateUser = { execute: jest.fn() };
  const mockUpdateUser = { execute: jest.fn() };
  const mockDeactivateUser = { execute: jest.fn() };
  const mockDeleteUser = { execute: jest.fn() };
  const mockAssignRole = { execute: jest.fn() };
  const mockRemoveRole = { execute: jest.fn() };
  const mockListRoles = { execute: jest.fn() };
  const mockCreateRole = { execute: jest.fn() };
  const mockDeleteRole = { execute: jest.fn() };
  const mockAssignPermissions = { execute: jest.fn() };
  const mockListPermissions = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardIdentityController],
      providers: [
        { provide: ListUsersHandler, useValue: mockListUsers },
        { provide: GetUserHandler, useValue: mockGetUser },
        { provide: CreateUserHandler, useValue: mockCreateUser },
        { provide: UpdateUserHandler, useValue: mockUpdateUser },
        { provide: DeactivateUserHandler, useValue: mockDeactivateUser },
        { provide: DeleteUserHandler, useValue: mockDeleteUser },
        { provide: AssignRoleHandler, useValue: mockAssignRole },
        { provide: RemoveRoleHandler, useValue: mockRemoveRole },
        { provide: ListRolesHandler, useValue: mockListRoles },
        { provide: CreateRoleHandler, useValue: mockCreateRole },
        { provide: DeleteRoleHandler, useValue: mockDeleteRole },
        { provide: AssignPermissionsHandler, useValue: mockAssignPermissions },
        { provide: ListPermissionsHandler, useValue: mockListPermissions },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
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

  describe('GET /dashboard/identity/users', () => {
    it('returns 200 with paginated users', async () => {
      mockListUsers.execute.mockResolvedValue({
        data: [{ id: 'user-1', name: 'Ali', email: 'ali@example.com', role: 'ADMIN', isActive: true }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/identity/users')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(mockListUsers.execute).toHaveBeenCalledWith({ page: 1, limit: 20, search: undefined, isActive: undefined });
    });

    it('passes query filters to handler', async () => {
      mockListUsers.execute.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/identity/users?search=ali&isActive=true&page=2&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListUsers.execute).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: 'ali',
        isActive: true,
      });
    });

    it('returns 400 for invalid page type', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/identity/users?page=not-a-number')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('GET /dashboard/identity/users/:id', () => {
    it('returns 200 with user details', async () => {
      mockGetUser.execute.mockResolvedValue({
        id: 'user-1',
        name: 'Ali',
        email: 'ali@example.com',
        role: 'ADMIN',
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/identity/users/00000000-0000-0000-0000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.name).toBe('Ali');
      expect(mockGetUser.execute).toHaveBeenCalledWith({ userId: '00000000-0000-0000-0000-000000000001' });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/identity/users/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('POST /dashboard/identity/users', () => {
    const validUser = {
      email: 'new@example.com',
      password: 'SecurePass123',
      name: 'New User',
      role: 'RECEPTIONIST',
    };

    it('returns 201 on valid user creation', async () => {
      mockCreateUser.execute.mockResolvedValue({
        id: 'user-new',
        email: 'new@example.com',
        name: 'New User',
        role: 'RECEPTIONIST',
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .post('/dashboard/identity/users')
        .set('Authorization', 'Bearer fake-jwt')
        .send(validUser)
        .expect(201);

      expect(res.body.id).toBe('user-new');
    });

    it('returns 400 for invalid email', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/identity/users')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validUser, email: 'not-an-email' })
        .expect(400);
    });

    it('returns 400 for short password', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/identity/users')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validUser, password: 'short' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/identity/users')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ ...validUser, extra: 'bad' })
        .expect(400);
    });
  });

  describe('PATCH /dashboard/identity/users/:id', () => {
    it('returns 200 on valid update', async () => {
      mockUpdateUser.execute.mockResolvedValue({ id: 'user-1', name: 'Updated', email: 'updated@example.com' });

      const res = await request(app.getHttpServer())
        .patch('/dashboard/identity/users/00000000-0000-0000-0000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'Updated' })
        .expect(200);

      expect(res.body.name).toBe('Updated');
    });

    it('returns 400 for invalid email in update', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/identity/users/00000000-0000-0000-0000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ email: 'invalid' })
        .expect(400);
    });
  });

  describe('DELETE /dashboard/identity/users/:id', () => {
    it('returns 204 on delete', async () => {
      mockDeleteUser.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete('/dashboard/identity/users/00000000-0000-0000-0000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .delete('/dashboard/identity/users/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/identity/users/:id/deactivate', () => {
    it('returns 204 on deactivate', async () => {
      mockDeactivateUser.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .patch('/dashboard/identity/users/00000000-0000-0000-0000-000000000001/deactivate')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });
  });

  describe('PATCH /dashboard/identity/users/:id/activate', () => {
    it('returns 204 on activate', async () => {
      mockUpdateUser.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .patch('/dashboard/identity/users/00000000-0000-0000-0000-000000000001/activate')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });
  });

  describe('GET /dashboard/identity/roles', () => {
    it('returns 200 with roles list', async () => {
      mockListRoles.execute.mockResolvedValue([{ id: 'role-1', name: 'Manager', permissions: [] }]);

      const res = await request(app.getHttpServer())
        .get('/dashboard/identity/roles')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Manager');
    });
  });

  describe('POST /dashboard/identity/roles', () => {
    it('returns 201 on valid role creation', async () => {
      mockCreateRole.execute.mockResolvedValue({ id: 'role-new', name: 'Supervisor', organizationId: 'org-1' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/identity/roles')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'Supervisor' })
        .expect(201);

      expect(res.body.name).toBe('Supervisor');
    });

    it('returns 400 for short name', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/identity/roles')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ name: 'A' })
        .expect(400);
    });
  });

  describe('DELETE /dashboard/identity/roles/:id', () => {
    it('returns 204 on delete', async () => {
      mockDeleteRole.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete('/dashboard/identity/roles/00000000-0000-0000-0000-000000000001')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .delete('/dashboard/identity/roles/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('GET /dashboard/identity/permissions', () => {
    it('returns 200 with permissions list', async () => {
      mockListPermissions.execute.mockResolvedValue([{ action: 'manage', subject: 'Booking' }]);

      const res = await request(app.getHttpServer())
        .get('/dashboard/identity/permissions')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].action).toBe('manage');
    });
  });
});
