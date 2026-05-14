import { BadRequestException, Injectable } from '@nestjs/common';
import type { UpdateMembershipProfileCommand } from './update-membership-profile.command';

export interface UpdateMembershipProfileResult {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  isActive: boolean;
  displayName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UpdateMembershipProfileHandler {
  async execute(_cmd: UpdateMembershipProfileCommand): Promise<UpdateMembershipProfileResult> {
    throw new BadRequestException('Not available in single-tenant mode');
  }
}
