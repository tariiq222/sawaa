import { ForbiddenException } from '@nestjs/common';
import { CreateEmployeeAccountHandler } from './create-employee-account.handler';
import { UpdateEmployeeAccountHandler } from './update-employee-account.handler';
import { CreateEmployeeHandler } from '../../people/employees/create-employee.handler';
import { UpdateEmployeeHandler } from '../../people/employees/update-employee.handler';

const actor = { id: 'actor', role: 'ADMIN', isSuperAdmin: false };
const targets = [
  { id: 'actor', role: 'ADMIN', isSuperAdmin: false },
  { id: 'target', role: 'ADMIN', isSuperAdmin: false },
  { id: 'target', role: 'SUPER_ADMIN', isSuperAdmin: false },
  { id: 'target', role: 'EMPLOYEE', isSuperAdmin: true },
];
function fixture(target: { id: string; role: string; isSuperAdmin: boolean; email?: string } = { id: 'target', role: 'EMPLOYEE', isSuperAdmin: false }) {
  const db = {
    user: {
      findUnique: jest.fn(async ({ where }) => where.id === 'actor' ? actor : target),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(target), create: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(async ({ where }) => typeof where.id === 'string' ? { id: 'emp', userId: target.id as string | null, email: 'old@test.com', isActive: true } : null),
      create: jest.fn().mockResolvedValue({ id: 'emp' }),
      update: jest.fn().mockResolvedValue({ id: 'emp' }),
    },
  };
  const rls = { withTransaction: jest.fn(async (fn) => fn(db)) };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  return { db, rls, events };
}

describe('employee account authorization boundaries', () => {
  it.each(targets)('blocks linked account mutation of $role / $id / $isSuperAdmin', async (target) => {
    const { db } = fixture(target);
    const handler = new UpdateEmployeeAccountHandler(db as never);
    await expect(handler.execute({ employeeId: 'emp', actorUserId: 'actor', isActive: false })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it.each(targets)('blocks email-match relinking of $role / $id / $isSuperAdmin', async (target) => {
    const { db, rls } = fixture(target);
    db.employee.findFirst.mockResolvedValue({ id: 'emp', userId: null, email: 'old@test.com', isActive: true });
    const handler = new CreateEmployeeAccountHandler(db as never, rls as never, {} as never);
    await expect(handler.execute({ employeeId: 'emp', actorUserId: 'actor', role: 'EMPLOYEE' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.employee.update).not.toHaveBeenCalled();
  });
  it.each(targets)('blocks explicit employee link to $role / $id / $isSuperAdmin', async (target) => {
    const { db, rls, events } = fixture(target);
    const handler = new CreateEmployeeHandler(db as never, rls as never, events as never);
    await expect(handler.execute({ name: 'New', userId: target.id, actorUserId: 'actor' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.employee.create).not.toHaveBeenCalled();
  });
  it.each(targets)('blocks authentication email overwrite of $role / $id / $isSuperAdmin', async (target) => {
    const { db, rls, events } = fixture(target);
    const handler = new UpdateEmployeeHandler(db as never, rls as never, events as never);
    await expect(handler.execute({ employeeId: 'emp', email: 'attacker@test.com', actorUserId: 'actor' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.employee.update).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('allows lower-rank activation, linkage and email synchronization without persisting actor metadata', async () => {
    const { db, rls, events } = fixture();
    await new UpdateEmployeeAccountHandler(db as never).execute({ employeeId: 'emp', actorUserId: 'actor', isActive: true });
    await new CreateEmployeeHandler(db as never, rls as never, events as never).execute({ name: 'New', userId: 'target', actorUserId: 'actor' } as never);
    await new UpdateEmployeeHandler(db as never, rls as never, events as never).execute({ employeeId: 'emp', email: 'new@test.com', actorUserId: 'actor' } as never);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { email: 'new@test.com' } }));
    for (const write of [db.employee.create, db.employee.update, db.user.update]) {
      for (const [arg] of write.mock.calls as any[]) expect(arg.data).not.toHaveProperty('actorUserId');
    }
  });
  it('fails closed for missing actor on account mutations', async () => {
    const { db, rls, events } = fixture();
    await expect(new UpdateEmployeeAccountHandler(db as never).execute({ employeeId: 'emp', isActive: false } as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(new CreateEmployeeAccountHandler(db as never, rls as never, {} as never).execute({ employeeId: 'emp', role: 'EMPLOYEE' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(new CreateEmployeeHandler(db as never, rls as never, events as never).execute({ name: 'New', userId: 'target' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(new UpdateEmployeeHandler(db as never, rls as never, events as never).execute({ employeeId: 'emp', email: 'new@test.com' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows harmless profile edits that resubmit the unchanged privileged login email', async () => {
    const { db, rls, events } = fixture({ ...targets[2], email: 'same@test.com' });
    await new UpdateEmployeeHandler(db as never, rls as never, events as never).execute({ employeeId: 'emp', bio: 'Updated', email: 'same@test.com', actorUserId: 'actor' } as never);
    expect(db.employee.update).toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('preserves ordinary profile edits on a higher-rank linked employee', async () => {
    const { db, rls, events } = fixture(targets[2]);
    await new UpdateEmployeeHandler(db as never, rls as never, events as never).execute({ employeeId: 'emp', bio: 'Updated', actorUserId: 'actor' } as never);
    expect(db.employee.update).toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
