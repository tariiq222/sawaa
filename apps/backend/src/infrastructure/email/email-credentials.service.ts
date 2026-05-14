// email-credentials — Per-tenant key derivation via HKDF + AES-256-GCM.
//
// Security model:
//   master key (ENV)  +  organizationId  →  HKDF-SHA256  →  per-tenant key
//
// This means every tenant gets a cryptographically distinct encryption key
// derived from the same master secret. A DB dump alone cannot decrypt any
// tenant's credentials — the attacker needs both the master key AND the
// correct organizationId for each row.
//
// Upgrade path: swap deriveKey() to call AWS KMS.GenerateDataKey per org
// when SOC-2 / HIPAA compliance is required — no changes needed elsewhere.

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'crypto';

const HKDF_SALT = 'deqah-email-creds-v1';
const HKDF_KEY_LEN = 32; // 256 bits

@Injectable()
export class EmailCredentialsService {
  private readonly masterKey: Buffer;

  constructor(private readonly cfg: ConfigService) {
    const raw = cfg.get<string>('EMAIL_PROVIDER_ENCRYPTION_KEY');
    if (!raw) {
      throw new InternalServerErrorException(
        'EMAIL_PROVIDER_ENCRYPTION_KEY missing',
      );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'EMAIL_PROVIDER_ENCRYPTION_KEY must decode to 32 bytes',
      );
    }
    this.masterKey = key;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  encrypt(payload: Record<string, unknown>, organizationId: string): string {
    const key = this.deriveKey(organizationId);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plain = Buffer.from(JSON.stringify(payload), 'utf8');
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    // layout: iv(12) || tag(16) || ciphertext
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  decrypt<T extends Record<string, unknown>>(
    ciphertext: string,
    organizationId: string,
  ): T {
    const key = this.deriveKey(organizationId);
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  }

  // ── Key derivation ────────────────────────────────────────────────────────

  /**
   * Derives a unique 256-bit AES key for this tenant using HKDF-SHA256.
   *
   *   key = HKDF(hash=SHA256, ikm=masterKey, salt=HKDF_SALT, info=organizationId, len=32)
   *
   * Properties:
   *  - Deterministic: same org always gets same key → no key storage needed
   *  - Isolated: different org → completely different key (one-way)
   *  - Forward-safe: compromising one derived key does NOT reveal masterKey
   *    or any other tenant's key
   */
  private deriveKey(organizationId: string): Buffer {
    return Buffer.from(
      hkdfSync(
        'sha256',
        this.masterKey,
        HKDF_SALT,
        organizationId,
        HKDF_KEY_LEN,
      ),
    );
  }
}
