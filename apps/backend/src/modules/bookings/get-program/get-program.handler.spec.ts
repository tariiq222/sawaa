import { GetProgramHandler } from './get-program.handler';

describe('GetProgramHandler display identities', () => {
  it('includes client and supervisor names without exposing full profiles', async () => {
    const prisma: any = {
      program: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', price: 0, maxParticipants: 10, enrolledCount: 1, supervisors: [{employeeId:'staff1'}], enrollments: [{id:'e1', clientId:'client1', booking: {price:100}}] }) },
      client: { findMany: jest.fn().mockResolvedValue([{id:'client1', name:'سارة'}]) },
      employee: { findMany: jest.fn().mockResolvedValue([{id:'staff1', name:'أحمد', nameEn:'Ahmed'}]) },
    };
    const result = await new GetProgramHandler(prisma).execute('p1');
    expect(result.enrollments[0]).toMatchObject({clientName: 'سارة'});
    expect(result).toMatchObject({supervisors: [{id:'staff1', name:'أحمد', nameEn:'Ahmed'}]});
  });
});
