import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { parseEntityRef } from '../../../common/parse-entity-ref';

export interface GetUserQuery {
  userId: string;
}

@Injectable()
export class GetUserHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetUserQuery) {
    const idf = parseEntityRef(query.userId, 'USR');
    const user = await this.prisma.user.findUnique({
      where: idf.kind === 'uuid' ? { id: idf.id } : { ref: idf.ref },
      omit: { passwordHash: true },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
