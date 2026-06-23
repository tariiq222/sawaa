import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

/**
 * AUTHZ-004 / COMMS-004 — dashboard chat ownership scoping.
 *
 * The dashboard staff chat handlers historically loaded any conversation by id
 * with no per-staff scoping, so any authenticated staff member could read or
 * write into any client conversation (IDOR).
 *
 * Scoping model (confirmed with owner): only the EMPLOYEE (counselor) role is
 * restricted to conversations assigned to them. Privileged dashboard roles
 * (OWNER / ADMIN / RECEPTIONIST / ACCOUNTANT / SUPER_ADMIN) legitimately
 * supervise all conversations and are NOT scoped — they call without a role.
 *
 * `ChatConversation.employeeId` stores an Employee.id, whereas the JWT carries
 * the User.id (`user.sub`). We therefore resolve the caller's Employee.id from
 * their user id before comparing — comparing the two id namespaces directly
 * would always (incorrectly) deny access.
 *
 * @throws ForbiddenException if an EMPLOYEE is not the assigned counselor.
 */
export async function assertConversationAccess(
  prisma: PrismaService,
  conversation: { employeeId: string | null },
  requester: { requesterRole?: string | null; requesterUserId?: string },
): Promise<void> {
  if (requester.requesterRole !== 'EMPLOYEE' || !requester.requesterUserId) {
    return;
  }

  const employee = await prisma.employee.findFirst({
    where: { userId: requester.requesterUserId },
    select: { id: true },
  });

  if (!employee || conversation.employeeId !== employee.id) {
    throw new ForbiddenException('Conversation is not assigned to you');
  }
}
