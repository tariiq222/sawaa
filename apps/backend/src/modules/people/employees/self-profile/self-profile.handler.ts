import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { Prisma } from '@prisma/client';
import { UpdateSelfProfileDto } from './self-profile.dto';
import { OwnedImageResolver } from '../../../media/owned-image.resolver';

// The request never accepts an employee ID; ownership is resolved from the live account.
export async function ownEmployee(db: Pick<Prisma.TransactionClient, 'employee' | 'user'>, userId: string) {
  const [employee, user] = await Promise.all([
    db.employee.findFirst({ where: { userId, isActive: true } }),
    db.user.findUnique({ where: { id: userId } }),
  ]);
  if (!employee || !user?.isActive || user.role === 'CLIENT') throw new ForbiddenException('employee_profile_not_found');
  return { employee, user };
}
export function profileResult({ employee, user }: Awaited<ReturnType<typeof ownEmployee>>) {
  return { id: employee.id, name: employee.name, avatarUrl: employee.publicImageUrl ?? employee.avatarUrl ?? user.avatarUrl,
    bioAr: employee.publicBioAr ?? employee.bioAr, bioEn: employee.publicBioEn ?? employee.bio,
    experience: employee.experience, languages: employee.languages, email: user.email, phone: user.phone };
}
@Injectable()
export class GetSelfProfileHandler {
  constructor(private readonly prisma: PrismaService, private readonly images: OwnedImageResolver) {}
  async execute(userId: string) {
    const owner = await ownEmployee(this.prisma, userId);
    const result = profileResult(owner);
    // Dashboard uploads store a private storage key; sign it like every other employee image read.
    return { ...result, avatarUrl: await this.images.resolve('employee', owner.employee.id, result.avatarUrl) };
  }
}
@Injectable()
export class UpdateSelfProfileHandler {
  constructor(private readonly transactions: RlsTransactionService, private readonly read: GetSelfProfileHandler) {}
  async execute(userId: string, input: UpdateSelfProfileDto) {
    await this.transactions.withTransaction(async tx => {
      const { employee } = await ownEmployee(tx, userId);
      await tx.employee.update({ where: { id: employee.id }, data: {
        ...(typeof input.bioAr === 'string' ? { bioAr: input.bioAr.trim(), publicBioAr: input.bioAr.trim() } : {}),
        ...(typeof input.bioEn === 'string' ? { bio: input.bioEn.trim(), publicBioEn: input.bioEn.trim() } : {}),
        ...(input.experience !== undefined ? { experience: input.experience } : {}),
        ...(Array.isArray(input.languages) ? { languages: input.languages } : {}),
      } });
    });
    return this.read.execute(userId);
  }
}
