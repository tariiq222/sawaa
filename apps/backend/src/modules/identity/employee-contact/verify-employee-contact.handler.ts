import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { EmployeeContactStore, contactConflict } from './employee-contact.store';
import { VerifyEmployeeContactDto } from './employee-contact.dto';

@Injectable()
export class VerifyEmployeeContactHandler {
  constructor(private readonly store: EmployeeContactStore) {}
  async execute(userId: string, input: VerifyEmployeeContactDto) {
    const result = await this.store.transaction(async tx => {
      const { user, employee } = await this.store.owner(tx, userId);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "EmployeeContactChallenge" WHERE "id" = ${input.challengeId} FOR UPDATE`);
      const challenge = await tx.employeeContactChallenge.findUnique({ where: { id: input.challengeId } });
      if (!challenge || challenge.userId !== userId || challenge.employeeId !== employee.id || !challenge.ready || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return null;
      if ((challenge.channel === 'EMAIL' ? user.email : user.phone) !== challenge.previousValue) return null;
      if (!await bcrypt.compare(input.code, challenge.codeHash)) {
        await tx.employeeContactChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
        return null; // Commit failed attempts before returning the HTTP error.
      }
      await this.store.available(tx, userId, employee.id, challenge.channel, challenge.identifier);
      const contact = challenge.channel === 'EMAIL' ? { email: challenge.identifier } : { phone: challenge.identifier };
      const verified = challenge.channel === 'EMAIL' ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() };
      await tx.user.update({ where: { id: userId }, data: { ...contact, ...verified } });
      await tx.employee.update({ where: { id: employee.id }, data: contact });
      // Proofs delivered to a former contact must not authenticate the updated identity.
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.employeeContactChallenge.updateMany({ where: { userId, channel: challenge.channel, consumedAt: null }, data: { consumedAt: new Date() } });
      return { success: true };
    }).catch(contactConflict);
    if (!result) throw new BadRequestException({ code: 'INVALID_CONTACT_CODE' });
    return result;
  }
}
