import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isEmail } from 'class-validator';
import { RlsTransactionService } from '../../../infrastructure/database';
import { normalizePhone } from '../shared/identifier-detector';

@Injectable()
export class EmployeeContactStore {
  constructor(private readonly transactions: RlsTransactionService) {}
  transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) { return this.transactions.withTransaction(run, { timeout: 15000 }); }
  normalize(channel: 'EMAIL' | 'SMS', value: string) {
    if (channel === 'SMS') return normalizePhone(value);
    const email = value.trim().toLowerCase();
    if (!isEmail(email)) throw new BadRequestException('invalid_email');
    return email;
  }
  async owner(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`);
    const user = await tx.user.findUnique({ where: { id: userId } });
    const employee = await tx.employee.findFirst({ where: { userId, isActive: true } });
    if (!user?.isActive || user.role === 'CLIENT' || !employee) throw new ForbiddenException('employee_profile_not_found');
    return { user, employee };
  }
  async available(tx: Prisma.TransactionClient, userId: string, employeeId: string, channel: 'EMAIL' | 'SMS', identifier: string) {
    const contact = channel === 'EMAIL' ? { email: { equals: identifier, mode: 'insensitive' as const } } : { phone: identifier };
    const [user, employee, client] = await Promise.all([
      tx.user.findFirst({ where: { ...contact, id: { not: userId } }, select: { id: true } }),
      tx.employee.findFirst({ where: { ...contact, id: { not: employeeId } }, select: { id: true } }),
      tx.client.findFirst({ where: contact, select: { id: true } }),
    ]);
    if (user || employee || client) throw new ConflictException({ code: 'CONTACT_ALREADY_IN_USE' });
  }
}
export function contactConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ code: 'CONTACT_ALREADY_IN_USE' });
  throw error;
}
