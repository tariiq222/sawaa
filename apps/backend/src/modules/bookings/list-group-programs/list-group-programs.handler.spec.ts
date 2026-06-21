import { Test } from '@nestjs/testing';
import { ListGroupProgramsHandler } from './list-group-programs.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockPrisma = {
  groupProgram: { findMany: jest.fn() },
};

describe('ListGroupProgramsHandler', () => {
  let handler: ListGroupProgramsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListGroupProgramsHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(ListGroupProgramsHandler);
    jest.clearAllMocks();
  });

  it('filters by isActive when activeOnly is true', async () => {
    mockPrisma.groupProgram.findMany.mockResolvedValue([]);

    await handler.execute({ activeOnly: true });

    expect(mockPrisma.groupProgram.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.groupProgram.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
  });

  it('uses an empty where clause when activeOnly is false', async () => {
    mockPrisma.groupProgram.findMany.mockResolvedValue([]);

    await handler.execute({ activeOnly: false });

    expect(mockPrisma.groupProgram.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.groupProgram.findMany.mock.calls[0][0].where).toEqual({});
  });
});
