import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { DEFAULT_ORG_ID } from '../../common/constants';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_CIPHERTEXT_BYTES = 16_384;

/** AES-256-GCM for the AI provider key only. The key is never persisted or logged. */
@Injectable()
export class AiProviderCredentialsService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const encoded = config.get<string>('ai.providerEncryptionKey') || config.get<string>('AI_PROVIDER_ENCRYPTION_KEY') || process.env.AI_PROVIDER_ENCRYPTION_KEY;
    if (!encoded) throw new InternalServerErrorException('AI_PROVIDER_ENCRYPTION_KEY missing');
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new InternalServerErrorException('AI provider encryption key must decode to 32 bytes');
    this.key = key;
  }

  encrypt(apiKey: string): string {
    if (!apiKey) throw new Error('API key must not be empty');
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(DEFAULT_ORG_ID, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
    return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`;
  }

  decrypt(envelope: string): string {
    const segments = typeof envelope === 'string' ? envelope.split('.') : [];
    if (segments.length !== 2) throw new Error('Invalid AI credential envelope');
    const [version, encoded] = segments;
    if (version !== VERSION || !encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Invalid AI credential envelope');
    const payload = Buffer.from(encoded, 'base64');
    if (payload.toString('base64') !== encoded || payload.length <= IV_BYTES + TAG_BYTES || payload.length > IV_BYTES + TAG_BYTES + MAX_CIPHERTEXT_BYTES) throw new Error('Invalid AI credential envelope');
    const decipher = createDecipheriv('aes-256-gcm', this.key, payload.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(DEFAULT_ORG_ID, 'utf8'));
    decipher.setAuthTag(payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const plaintext = Buffer.concat([decipher.update(payload.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
    if (!plaintext) throw new Error('Invalid AI credential');
    return plaintext;
  }

  fingerprint(apiKey: string, provider: string, model: string): string {
    return createHmac('sha256', this.key).update(`sawaa-ai-provider-test\0${provider}\0${model}\0${apiKey}`, 'utf8').digest('hex');
  }
}
