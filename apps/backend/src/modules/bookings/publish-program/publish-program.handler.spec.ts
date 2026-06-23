import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProgramStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { PublishProgramHandler } from './publish-program.handler';

describe('PublishProgramHandler', () => {
  let handler: PublishProgramHandler;
  let prisma: { program: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      program: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishProgramHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<PublishProgramHandler>(PublishProgramHandler);
  });

  it('throws NotFoundException when the program does not exist', async () => {
    prisma.program.findUnique.mockResolvedValue(null);

    await expect(handler.execute('prog-missing')).rejects.toThrow(NotFoundException);
    expect(prisma.program.update).not.toHaveBeenCalled();
  });

  it('looks the program up by the requested id', async () => {
    prisma.program.findUnique.mockResolvedValue(null);
    await expect(handler.execute('prog-7')).rejects.toThrow(NotFoundException);
    expect(prisma.program.findUnique).toHaveBeenCalledWith({ where: { id: 'prog-7' } });
  });

  it('publishes a DRAFT program by transitioning it to OPEN', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.DRAFT,
    });
    prisma.program.update.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
    });

    const result = await handler.execute('prog-1');

    expect(prisma.program.update).toHaveBeenCalledWith({
      where: { id: 'prog-1' },
      data: { status: ProgramStatus.OPEN },
    });
    expect(result).toEqual({ id: 'prog-1', status: ProgramStatus.OPEN });
  });

  it('returns the post-update id+status from the updated row', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-2',
      status: ProgramStatus.DRAFT,
    });
    prisma.program.update.mockResolvedValue({
      id: 'prog-2',
      status: ProgramStatus.OPEN,
    });

    const result = await handler.execute('prog-2');
    expect(result.id).toBe('prog-2');
    expect(result.status).toBe(ProgramStatus.OPEN);
  });

  it('rejects a non-DRAFT source status (BadRequestException from state machine)', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-3',
      status: ProgramStatus.OPEN,
    });

    // Source status OPEN is not in OPEN_REGISTRATION.from (which only allows DRAFT).
    await expect(handler.execute('prog-3')).rejects.toThrow(/OPEN_REGISTRATION/);
    expect(prisma.program.update).not.toHaveBeenCalled();
  });

  it('propagates a Prisma error from findUnique', async () => {
    prisma.program.findUnique.mockRejectedValue(new Error('DB down'));
    await expect(handler.execute('prog-x')).rejects.toThrow('DB down');
  });
});
