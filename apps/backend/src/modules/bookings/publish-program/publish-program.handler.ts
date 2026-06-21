import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { assertProgramTransition } from '../program/program-state-machine';

@Injectable()
export class PublishProgramHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new NotFoundException('Program not found');

    const nextStatus = assertProgramTransition(program.status, 'OPEN_REGISTRATION');
    const updated = await this.prisma.program.update({
      where: { id: programId },
      data: { status: nextStatus },
    });
    return { id: updated.id, status: updated.status };
  }
}
