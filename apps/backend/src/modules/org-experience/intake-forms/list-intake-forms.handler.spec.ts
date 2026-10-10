import { Test, TestingModule } from '@nestjs/testing';
import { ListIntakeFormsHandler } from './list-intake-forms.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListIntakeFormsHandler', () => {
  let handler: ListIntakeFormsHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      intakeForm: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListIntakeFormsHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<ListIntakeFormsHandler>(ListIntakeFormsHandler);
  });

  it('should list all forms without filter', async () => {
    prisma.intakeForm.findMany.mockResolvedValue([
      {
        id: 'f1',
        type: 'CONSULTATION',
        scope: 'SERVICE',
        fields: [{ id: 'fld1' }],
      _count: { responses: 3 },
      },
    ]);

    const result = await handler.execute({});
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('consultation');
    expect(result[0].scope).toBe('service');
    expect(result[0].fieldsCount).toBe(1);
    expect(result[0].submissionsCount).toBe(3);
    expect(prisma.intakeForm.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      include: expect.objectContaining({
        _count: {
          select: { responses: { where: { supersededAt: null } } },
        },
      }),
    }));
  });

  it('should filter by isActive', async () => {
    prisma.intakeForm.findMany.mockResolvedValue([]);
    await handler.execute({ isActive: true });
    expect(prisma.intakeForm.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true },
    }));
  });
});

describe('scope labels on intake forms', () => {
  it('resolves employee/service/branch names without a first-page lookup', async () => {
    const prisma: any = {
      intakeForm: {findMany: jest.fn().mockResolvedValue([{id:'f1',scope:'SERVICE',scopeId:'s200',type:'PRE_SESSION',fields:[],_count:{responses:0}}])},
      service: {findMany:jest.fn().mockResolvedValue([{id:'s200',nameAr:'خدمة بعيدة',nameEn:'Later service'}])},
      employee: {findMany:jest.fn().mockResolvedValue([])}, branch: {findMany:jest.fn().mockResolvedValue([])},
    };
    expect(await new ListIntakeFormsHandler(prisma).execute({})).toEqual([expect.objectContaining({scopeLabel:'خدمة بعيدة'})]);
  });
});
