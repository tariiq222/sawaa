import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ClientReadRequester {
  requesterRole?: string | null;
  requesterUserId?: string;
}

/** Client self-service callers supply their guarded clientId instead of a staff actor. */
export async function resolveClientReadEmployee(
  prisma: Pick<PrismaService, 'employee'>,
  requester: ClientReadRequester,
): Promise<string | undefined> {
  if (requester.requesterRole !== 'EMPLOYEE') return undefined;
  if (!requester.requesterUserId) throw new ForbiddenException('Employee identity is required');
  const employee = await prisma.employee.findFirst({
    where: { userId: requester.requesterUserId },
    select: { id: true },
  });
  if (!employee) throw new ForbiddenException('Employee identity is required');
  return employee.id;
}
