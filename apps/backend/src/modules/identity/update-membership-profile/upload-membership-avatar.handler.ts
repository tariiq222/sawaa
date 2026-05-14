import { BadRequestException, Injectable } from '@nestjs/common';

export interface UploadMembershipAvatarCommand {
  /** Caller user id (from JWT). */
  userId: string;
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface UploadMembershipAvatarResult {
  avatarUrl: string;
}

@Injectable()
export class UploadMembershipAvatarHandler {
  async execute(_cmd: UploadMembershipAvatarCommand): Promise<UploadMembershipAvatarResult> {
    throw new BadRequestException('Not available in single-tenant mode');
  }
}
