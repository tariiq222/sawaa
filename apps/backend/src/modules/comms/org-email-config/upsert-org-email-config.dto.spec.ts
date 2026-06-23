import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SmtpCredentialsDto,
  UpsertOrgEmailConfigDto,
} from './upsert-org-email-config.dto';

async function validateSmtp(plain: Record<string, unknown>) {
  const dto = plainToInstance(SmtpCredentialsDto, plain);
  return validate(dto);
}

async function validateUpsert(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertOrgEmailConfigDto, plain);
  return validate(dto);
}

const validSmtp: Record<string, unknown> = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'clinic@example.com',
  pass: 'app-password-123',
};

describe('SmtpCredentialsDto', () => {
  it('accepts a valid payload without secure', async () => {
    const errors = await validateSmtp(validSmtp);
    expect(errors).toHaveLength(0);
  });

  it('accepts secure as a boolean', async () => {
    const errors = await validateSmtp({ ...validSmtp, secure: true });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing host', async () => {
    const errors = await validateSmtp({
      port: validSmtp.port,
      user: validSmtp.user,
      pass: validSmtp.pass,
    });
    expect(errors.some((e) => e.property === 'host')).toBe(true);
  });

  it('rejects a non-string host', async () => {
    const errors = await validateSmtp({ ...validSmtp, host: 12345 });
    expect(errors.some((e) => e.property === 'host')).toBe(true);
  });

  it('rejects a host longer than 253 chars', async () => {
    const errors = await validateSmtp({ ...validSmtp, host: 'a'.repeat(254) });
    expect(errors.some((e) => e.property === 'host')).toBe(true);
  });

  it('rejects a non-integer port', async () => {
    const errors = await validateSmtp({ ...validSmtp, port: '587' });
    expect(errors.some((e) => e.property === 'port')).toBe(true);
  });

  it('rejects a port < 1', async () => {
    const errors = await validateSmtp({ ...validSmtp, port: 0 });
    expect(errors.some((e) => e.property === 'port')).toBe(true);
  });

  it('rejects a port > 65535', async () => {
    const errors = await validateSmtp({ ...validSmtp, port: 65536 });
    expect(errors.some((e) => e.property === 'port')).toBe(true);
  });

  it('accepts port at the Max(65535) boundary', async () => {
    const errors = await validateSmtp({ ...validSmtp, port: 65535 });
    expect(errors.some((e) => e.property === 'port')).toBe(false);
  });

  it('rejects a missing pass', async () => {
    const errors = await validateSmtp({
      host: validSmtp.host,
      port: validSmtp.port,
      user: validSmtp.user,
    });
    expect(errors.some((e) => e.property === 'pass')).toBe(true);
  });

  it('rejects a pass longer than 500 chars', async () => {
    const errors = await validateSmtp({ ...validSmtp, pass: 'a'.repeat(501) });
    expect(errors.some((e) => e.property === 'pass')).toBe(true);
  });
});

describe('UpsertOrgEmailConfigDto', () => {
  it('accepts a provider of NONE without credentials', async () => {
    const errors = await validateUpsert({ provider: 'NONE' });
    expect(errors).toHaveLength(0);
  });

  it('accepts SMTP with nested smtp credentials', async () => {
    const errors = await validateUpsert({ provider: 'SMTP', smtp: validSmtp });
    expect(errors).toHaveLength(0);
  });

  it('accepts a senderName without CR/LF', async () => {
    const errors = await validateUpsert({
      provider: 'NONE',
      senderName: 'عيادة الأمل',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects senderName containing CR/LF', async () => {
    const errors = await validateUpsert({
      provider: 'NONE',
      senderName: 'عيادة\r\nBcc: attacker',
    });
    expect(errors.some((e) => e.property === 'senderName')).toBe(true);
  });

  it('rejects a non-email senderEmail', async () => {
    const errors = await validateUpsert({
      provider: 'NONE',
      senderEmail: 'not-an-email',
    });
    expect(errors.some((e) => e.property === 'senderEmail')).toBe(true);
  });

  it('rejects senderEmail containing CR/LF (belt-and-braces)', async () => {
    const errors = await validateUpsert({
      provider: 'NONE',
      senderEmail: 'ok@example.com\r\nBcc: attacker',
    });
    expect(errors.some((e) => e.property === 'senderEmail')).toBe(true);
  });

  it('rejects a provider outside the enum', async () => {
    const errors = await validateUpsert({ provider: 'POSTMARK' });
    expect(errors.some((e) => e.property === 'provider')).toBe(true);
  });

  it('rejects a missing provider', async () => {
    const errors = await validateUpsert({});
    expect(errors.some((e) => e.property === 'provider')).toBe(true);
  });

  it('rejects smtp credentials that fail nested validation', async () => {
    const errors = await validateUpsert({
      provider: 'SMTP',
      smtp: { ...validSmtp, port: 0 },
    });
    expect(errors.some((e) => e.property === 'smtp')).toBe(true);
  });
});
