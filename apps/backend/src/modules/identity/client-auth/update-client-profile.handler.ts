import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateClientProfileDto } from './update-client-profile.dto';
import type { ClientProfile } from './get-me.handler';

/**
 * Splits a full name into firstName/lastName the same way other identity
 * surfaces do (first token → firstName, remainder → lastName). middleName is
 * cleared so the legacy `name` column stays consistent with its components.
 */
function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

@Injectable()
export class UpdateClientProfileHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(clientId: string, dto: UpdateClientProfileDto): Promise<ClientProfile> {
    if (dto.name === undefined && dto.phone === undefined && dto.email === undefined) {
      throw new BadRequestException('لا توجد بيانات لتحديثها');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('الحساب غير موجود');
    }

    const data: Prisma.ClientUpdateInput = {};

    if (dto.phone !== undefined && dto.phone !== client.phone) {
      const duplicate = await this.prisma.client.findFirst({
        where: {
          phone: dto.phone,
          deletedAt: null,
          NOT: { id: clientId },
        },
      });
      if (duplicate) {
        throw new ConflictException('رقم الجوال مستخدم في حساب آخر');
      }
      data.phone = dto.phone;
      // The new number has not been verified via OTP yet.
      data.phoneVerified = null;
    }

    if (dto.email !== undefined && dto.email !== client.email) {
      // Policy: email can only be ADDED while the account has none (clients
      // who registered by phone). Changing an existing email requires a
      // verification flow that does not exist yet — reject instead of
      // silently swapping the login identifier.
      if (client.email !== null) {
        throw new BadRequestException('لا يمكن تغيير البريد الإلكتروني بعد تعيينه');
      }
      const emailDuplicate = await this.prisma.client.findFirst({
        where: {
          email: dto.email,
          deletedAt: null,
          NOT: { id: clientId },
        },
      });
      if (emailDuplicate) {
        throw new ConflictException('البريد الإلكتروني مستخدم في حساب آخر');
      }
      data.email = dto.email;
      // The new email has not been verified yet.
      data.emailVerified = null;
    }

    if (dto.name !== undefined) {
      const { firstName, lastName } = splitName(dto.name);
      data.name = dto.name.trim();
      data.firstName = firstName;
      data.middleName = null;
      data.lastName = lastName;
    }

    try {
      const updated = await this.prisma.client.update({
        where: { id: clientId },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          emailVerified: true,
          phoneVerified: true,
          accountType: true,
          claimedAt: true,
          createdAt: true,
        },
      });

      return updated as ClientProfile;
    } catch (error) {
      // TOCTOU guard: another request may have claimed the phone/email between
      // the pre-check above and this update — map the unique-constraint
      // violation to the same conflict error as the pre-check.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : [];
        if (target.includes('email')) {
          throw new ConflictException('البريد الإلكتروني مستخدم في حساب آخر');
        }
        throw new ConflictException('رقم الجوال مستخدم في حساب آخر');
      }
      throw error;
    }
  }
}
