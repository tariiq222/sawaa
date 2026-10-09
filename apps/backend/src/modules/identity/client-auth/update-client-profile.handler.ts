import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateClientProfileDto } from './update-client-profile.dto';
import type { ClientProfile } from './get-me.handler';
import { normalizePhone } from '../shared/identifier-detector';

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
    if (
      dto.name === undefined &&
      dto.phone === undefined &&
      dto.email === undefined &&
      dto.avatarUrl === undefined &&
      dto.preferredLocale === undefined &&
      dto.pushEnabled === undefined
    ) {
      throw new BadRequestException('لا توجد بيانات لتحديثها');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('الحساب غير موجود');
    }

    const data: Prisma.ClientUpdateInput = {};

    if (dto.phone !== undefined) {
      // Older app builds send an empty/null phone for clients without one.
      let unchanged = !dto.phone && !client.phone;
      try {
        unchanged ||= normalizePhone(dto.phone ?? '') === normalizePhone(client.phone ?? '');
      } catch {
        // Malformed input is never a way to bypass the verified-change flow.
      }
      if (!unchanged) {
        throw new BadRequestException({
          code: 'phone_change_requires_verification',
          message: 'phone_change_requires_verification',
        });
      }
      // A normalized copy of the current number is ignored, preserving verification.
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

    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.preferredLocale !== undefined) data.preferredLocale = dto.preferredLocale;
    if (dto.pushEnabled !== undefined) data.pushEnabled = dto.pushEnabled;

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
          avatarUrl: true,
          preferredLocale: true,
          pushEnabled: true,
          accountType: true,
          claimedAt: true,
          createdAt: true,
        },
      });

      return updated as ClientProfile;
    } catch (error) {
      // Preserve the email TOCTOU conflict behavior; other unique conflicts
      // must not reveal whether a phone belongs to another account.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : [];
        if (target.includes('email')) {
          throw new ConflictException('البريد الإلكتروني مستخدم في حساب آخر');
        }
        throw new ConflictException({ code: 'details_unavailable' });
      }
      throw error;
    }
  }
}
