// integration-credentials — AES-256-GCM encryption for generic platform
// integration configs.
//
// Security model (P0-10):
//   master key (ENV INTEGRATION_ENCRYPTION_KEY) + DEFAULT_ORG_ID → HKDF-SHA256 → key
//
// Mirrors moyasar / sms / zoom / email credential services. A DB dump alone
// cannot decrypt any row — the attacker needs the master key.

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'crypto';
import { DEFAULT_ORG_ID } from '../../common/constants';

const HKDF_SALT = 'sawaa-integration-creds-v1';
const HKDF_KEY_LEN = 32; // 256 bits

@Injectable()
export class IntegrationCredentialsService {
  private readonly masterKey: Buffer;

  constructor(cfg: ConfigService) {
    // Reuse MOYASAR_ENCRYPTION_KEY as the platform-integration master key by
    // default; allow INTEGRATION_ENCRYPTION_KEY to override if operators want
    // a separately rotated key. Both must decode to 32 raw bytes.
    const raw =
      cfg.get<string>('INTEGRATION_ENCRYPTION_KEY') ??
      cfg.get<string>('MOYASAR_ENCRYPTION_KEY');
    if (!raw) {
      throw new InternalServerErrorException(
        'INTEGRATION_ENCRYPTION_KEY (or MOYASAR_ENCRYPTION_KEY fallback) missing',
      );
    }
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      throw new InternalServerErrorException(
        'Integration encryption key must decode to 32 bytes',
      );
    }
    this.masterKey = buf;
  }

  encrypt(payload: Record<string, unknown>): string {
    const key = this.deriveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plain = Buffer.from(JSON.stringify(payload), 'utf8');
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  decrypt<T extends Record<string, unknown>>(ciphertext: string): T {
    const key = this.deriveKey();
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  }

  private deriveKey(): Buffer {
    const ikm = this.masterKey;
    const salt = Buffer.from(HKDF_SALT, 'utf8');
    const info = Buffer.from(DEFAULT_ORG_ID, 'utf8');
    return Buffer.from(hkdfSync('sha256', ikm, salt, info, HKDF_KEY_LEN));
  }
}
