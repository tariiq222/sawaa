import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PasswordService } from '../shared/password.service';

export interface ProvisionOwnerInput {
  ownerUserId?: string;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  tx: Prisma.TransactionClient;
}

export interface ProvisionOwnerResult {
  userId: string;
  isNewUser: boolean;
  generatedPassword?: string;
}

@Injectable()
export class OwnerProvisioningService {
  constructor(private readonly password: PasswordService) {}

  async provision(input: ProvisionOwnerInput): Promise<ProvisionOwnerResult> {
    const { tx, ownerUserId, email } = input;

    if (ownerUserId) {
      const user = await tx.user.findUnique({
        where: { id: ownerUserId },
        select: { id: true, isActive: true },
      });
      if (!user || !user.isActive) {
        throw new NotFoundException('owner_user_not_found');
      }
      return { userId: user.id, isNewUser: false };
    }

    if (!email) {
      throw new ConflictException('owner_id_or_email_required');
    }

    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });
    if (existing) {
      if (!existing.isActive) {
        throw new ConflictException('owner_email_belongs_to_inactive_user');
      }
      return { userId: existing.id, isNewUser: false };
    }

    if (!input.name || !input.phone) {
      throw new ConflictException('owner_name_and_phone_required');
    }

    const plainPassword = input.password?.trim() || this.generateStrongPassword();
    const passwordHash = await this.password.hash(plainPassword);

    const created = await tx.user.create({
      data: {
        email,
        name: input.name,
        phone: input.phone,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
      select: { id: true },
    });

    return {
      userId: created.id,
      isNewUser: true,
      generatedPassword: input.password?.trim() ? undefined : plainPassword,
    };
  }

  private generateStrongPassword(): string {
    // 16+ chars from base64 of 12 bytes; enforce at least 1 uppercase + 1 digit
    let pwd = randomBytes(12).toString('base64').replace(/[/+=]/g, '');
    if (!/[A-Z]/.test(pwd)) pwd = 'A' + pwd;
    if (!/\d/.test(pwd)) pwd = pwd + '7';
    return pwd.slice(0, 20);
  }
}
