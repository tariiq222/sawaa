import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import { assertCanAssignRole } from '../shared/role-rank';
import { CreateEmployeeAccountDto } from './create-employee-account.dto';

// actorUserId is injected from the authenticated principal (req.user.id), never the body.
export type CreateEmployeeAccountCommand = CreateEmployeeAccountDto & {
  employeeId: string;
  actorUserId: string;
};

@Injectable()
export class CreateEmployeeAccountHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly password: PasswordService,
  ) {}

  async execute(cmd: CreateEmployeeAccountCommand) {
    // Rank gate: an actor may not grant a system role at or above their own rank
    // (and only a super admin may grant SUPER_ADMIN) when creating/linking an
    // employee login account.
    const actor = await this.prisma.user.findUnique({
      where: { id: cmd.actorUserId },
      select: { role: true, isSuperAdmin: true },
    });
    if (!actor) throw new ForbiddenException('Actor not found');
    assertCanAssignRole(actor, cmd.role);

    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (employee.userId) {
      throw new ConflictException('Employee already has a linked account');
    }

    if (!employee.email) {
      throw new BadRequestException(
        'Employee has no email — add an email to the employee first',
      );
    }

    // Capture narrowed email (TypeScript loses narrowing across async closure boundary)
    const employeeEmail: string = employee.email;

    const existingUser = await this.prisma.user.findUnique({
      where: { email: employeeEmail },
    });

    return this.rlsTransaction.withTransaction(async (tx) => {
      let userId: string;
      let userRecord: { id: string; email: string; role: string; isActive: boolean };

      if (existingUser) {
        // Link existing user — update role, keep password untouched
        const updated = await tx.user.update({
          where: { id: existingUser.id },
          data: { role: cmd.role },
          select: { id: true, email: true, role: true, isActive: true },
        });
        userId = updated.id;
        userRecord = updated as typeof userRecord;
      } else {
        // No existing user — password required
        if (!cmd.password) {
          throw new BadRequestException('Password is required to create a new account');
        }
        const passwordHash = await this.password.hash(cmd.password);
        const created = await tx.user.create({
          data: {
            email: employeeEmail,
            name: employee.name,
            role: cmd.role,
            passwordHash,
          },
          select: { id: true, email: true, role: true, isActive: true },
        });
        userId = created.id;
        userRecord = created as typeof userRecord;
      }

      await tx.employee.update({
        where: { id: cmd.employeeId },
        data: { userId },
      });

      return userRecord;
    });
  }
}
