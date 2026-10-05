import { DashboardPeopleController } from './people.controller';

describe('Dashboard people trusted actor boundary', () => {
  const request = { user: { id: 'actor', sub: 'actor', role: 'EMPLOYEE' } };
  const forged = { requesterRole: 'ADMIN', requesterUserId: 'victim', actorUserId: 'victim' };
  let controller: DashboardPeopleController;
  let execute: jest.Mock;

  beforeEach(() => {
    execute = jest.fn().mockResolvedValue({});
    controller = Object.create(DashboardPeopleController.prototype);
    Object.assign(controller, {
      listClients: { execute }, getClient: { execute },
      createEmployee: { execute }, updateEmployee: { execute },
    });
  });

  it('overrides client query actor fields with the authenticated principal', async () => {
    await controller.listClientsEndpoint({ ...forged, page: 1, limit: 20 } as any, 'false', request);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      requesterRole: 'EMPLOYEE', requesterUserId: 'actor', isActive: false,
    }));
  });

  it('passes the authenticated employee to client detail authorization', async () => {
    await controller.getClientEndpoint('CL-123', request);
    expect(execute).toHaveBeenCalledWith({ clientId: 'CL-123', requesterRole: 'EMPLOYEE', requesterUserId: 'actor' });
  });

  it('overrides a body actor when linking a new employee to a user', async () => {
    await controller.createEmployeeEndpoint({ name: 'Employee', userId: 'target', ...forged } as any, request);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ userId: 'target', actorUserId: 'actor' }));
  });

  it('overrides a body actor when changing a linked employee email', async () => {
    await controller.updateEmployeeEndpoint('employee', { email: 'new@example.test', ...forged } as any, request);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'employee', actorUserId: 'actor' }));
  });
});
