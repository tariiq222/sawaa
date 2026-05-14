import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, OtpChannel } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface OtpSessionPayload {
  organizationId: string | null;
  identifier: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  jti: string;
  exp?: number;
}

@Injectable()
export class OtpSessionService {
  private readonly logger = new Logger(OtpSessionService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private otpSecret(): string {
    const dedicated = this.config.get<string>('JWT_OTP_SECRET');
    if (dedicated) return dedicated;
    this.logger.warn(
      'JWT_OTP_SECRET not set — falling back to JWT_ACCESS_SECRET. Set a dedicated secret in production.',
    );
    return this.config.get<string>('JWT_ACCESS_SECRET') ?? '';
  }

  async signSession(payload: Omit<OtpSessionPayload, 'jti' | 'exp'>): Promise<string> {
    return this.jwt.sign(
      { ...payload, jti: uuidv4() },
      { secret: this.otpSecret(), expiresIn: '30m' },
    );
  }

  verifySession(token: string): OtpSessionPayload | null {
    try {
      return this.jwt.verify<OtpSessionPayload>(token, {
        secret: this.otpSecret(),
      });
    } catch {
      return null;
    }
  }
}
