import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { parseEntityRef } from '../../../common/parse-entity-ref';
import { serializeClient, serializeEmployeeClient, employeeDashboardClientSelect } from './client.serializer';
import { resolveClientReadEmployee, type ClientReadRequester } from './client-read-access.helper';

export interface GetClientQuery extends ClientReadRequester {
  clientId: string;
}

@Injectable()
export class GetClientHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetClientQuery) {
    const employeeId = await resolveClientReadEmployee(this.prisma, query);
    const idf = parseEntityRef(query.clientId, 'CL');
    const client = await this.prisma.client.findFirst({
      where: { ...(idf.kind === 'uuid' ? { id: idf.id } : { ref: idf.ref }), deletedAt: null },
      ...(employeeId ? { select: employeeDashboardClientSelect } : {}),
    });
    if (!client) throw new NotFoundException('Client not found');
    if (employeeId) {
      const relationship = await this.prisma.booking.findFirst({
        where: { employeeId, clientId: client.id },
        select: { id: true },
      });
      if (!relationship) throw new NotFoundException('Client not found');
      return serializeEmployeeClient(client);
    }
    return serializeClient(client);
  }
}
