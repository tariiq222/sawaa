import { PasswordService } from './password.service';

/**
 * Unit spec for the bcrypt-backed password service used by every
 * login/registration/password-reset flow.
 *
 * We exercise the REAL `bcryptjs` implementation (not a mock) so the
 * hash format, salt-round cost, and verify comparison are all under test.
 */
describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  describe('hash', () => {
    it('produces a bcrypt hash that verify() accepts', async () => {
      const hash = await service.hash('correct horse battery staple');
      expect(hash).toMatch(/^\$2[aby]\$12\$/); // bcryptjs with cost 12
      await expect(service.verify('correct horse battery staple', hash)).resolves.toBe(true);
    });

    it('uses exactly 12 salt rounds (matches SALT_ROUNDS constant)', async () => {
      const hash = await service.hash('hunter2');
      // bcrypt format: $2[aby]$<cost>$...
      const costMatch = hash.match(/^\$2[aby]\$(\d+)\$/);
      expect(costMatch).not.toBeNull();
      expect(Number(costMatch![1])).toBe(12);
    });

    it('produces a DIFFERENT hash for the same input (salted)', async () => {
      const a = await service.hash('samepassword');
      const b = await service.hash('samepassword');
      expect(a).not.toBe(b);
      // Both must still verify against the same plaintext
      await expect(service.verify('samepassword', a)).resolves.toBe(true);
      await expect(service.verify('samepassword', b)).resolves.toBe(true);
    });

    it('handles unicode / Arabic plaintext correctly', async () => {
      const hash = await service.hash('كلمة-سر-قوية-١٢٣');
      await expect(service.verify('كلمة-سر-قوية-١٢٣', hash)).resolves.toBe(true);
      await expect(service.verify('كلمة-سر-قوية-124', hash)).resolves.toBe(false);
    });

    it('produces a hash distinct from the plaintext (one-way)', async () => {
      const hash = await service.hash('plain');
      expect(hash).not.toContain('plain');
    });
  });

  describe('verify', () => {
    it('returns true when the plaintext matches the hash', async () => {
      const hash = await service.hash('mypassword');
      await expect(service.verify('mypassword', hash)).resolves.toBe(true);
    });

    it('returns false when the plaintext does not match', async () => {
      const hash = await service.hash('mypassword');
      await expect(service.verify('wrong', hash)).resolves.toBe(false);
    });

    it('returns false for an empty plaintext against a non-empty hash', async () => {
      const hash = await service.hash('mypassword');
      await expect(service.verify('', hash)).resolves.toBe(false);
    });

    it('returns false (does not throw) for an invalid hash shape', async () => {
      // bcrypt.compare returns false (does NOT throw) on malformed hashes;
      // our wrapper must not change that contract.
      await expect(service.verify('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
    });

    it('returns false for a hash that was truncated', async () => {
      const hash = await service.hash('mypassword');
      const truncated = hash.slice(0, hash.length - 4);
      await expect(service.verify('mypassword', truncated)).resolves.toBe(false);
    });
  });
});
