import { DashboardPeopleClientsController } from './people-clients.controller';
import { DashboardPeopleEmployeesController } from './people-employees.controller';

describe('Dashboard people trusted actor boundary', () => {
  const request = { user: { id: 'actor', sub: 'actor', role: 'EMPLOYEE' } };
  const forged = { requesterRole: 'ADMIN', requesterUserId: 'victim', actorUserId: 'victim' };
  let clients: DashboardPeopleClientsController;
  let employees: DashboardPeopleEmployeesController;
  let execute: jest.Mock;

  beforeEach(() => {
    execute = jest.fn().mockResolvedValue({});
    clients = Object.create(DashboardPeopleClientsController.prototype);
    employees = Object.create(DashboardPeopleEmployeesController.prototype);
    Object.assign(clients, { listClients: { execute }, getClient: { execute } });
    Object.assign(employees, { createEmployee: { execute }, updateEmployee: { execute } });
  });

  it('overrides client query actor fields with the authenticated principal', async () => {
    await clients.listClientsEndpoint({ ...forged, page: 1, limit: 20 } as any, 'false', request);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      requesterRole: 'EMPLOYEE', requesterUserId: 'actor', isActive: false,
    }));
  });

  it('passes the authenticated employee to client detail authorization', async () => {
    await clients.getClientEndpoint('CL-123', request);
    expect(execute).toHaveBeenCalledWith({ clientId: 'CL-123', requesterRole: 'EMPLOYEE', requesterUserId: 'actor' });
  });

  it('overrides a body actor when linking a new employee to a user', async () => {
    await employees.createEmployeeEndpoint({ name: 'Employee', userId: 'target', ...forged } as any, request);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ userId: 'target', actorUserId: 'actor' }));
  });

  it('overrides a body actor when changing a linked employee email', async () => {
    await employees.updateEmployeeEndpoint('employee', { email: 'new@example.test', ...forged } as any, request);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'employee', actorUserId: 'actor' }));
  });
});
