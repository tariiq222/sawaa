import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, randomBytes } from "crypto";
import { EmailCredentialsService } from "./email-credentials.service";

describe("EmailCredentialsService", () => {
	let service: EmailCredentialsService;
	let masterKey: Buffer;

	beforeEach(async () => {
		masterKey = Buffer.alloc(32);
		for (let i = 0; i < 32; i++) masterKey[i] = (i + 1) & 0xff;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EmailCredentialsService,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn().mockReturnValue(masterKey.toString("base64")),
					},
				},
			],
		}).compile();

		service = module.get<EmailCredentialsService>(EmailCredentialsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("should encrypt and decrypt payload", () => {
		const payload = { host: "smtp.example.com", port: 587, user: "u", pass: "p" };
		const encrypted = service.encrypt(payload, "org-1");
		expect(typeof encrypted).toBe("string");
		const decrypted = service.decrypt(encrypted, "org-1");
		expect(decrypted).toEqual(payload);
	});

	it("should throw when key is missing", () => {
		expect(() => {
			new EmailCredentialsService({ get: () => undefined } as any);
		}).toThrow();
	});

	it("should throw when key is wrong length", () => {
		expect(() => {
			new EmailCredentialsService({
				get: () => Buffer.alloc(16).toString("base64"),
			} as any);
		}).toThrow();
	});

	// ── P2.B dual-scheme reader (added 2026-06-09) ────────────────────────────

	function legacyEncrypt(payload: Record<string, unknown>, mk: Buffer): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", mk, iv);
		const plain = Buffer.from(JSON.stringify(payload), "utf8");
		const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
		const tag = cipher.getAuthTag();
		return Buffer.concat([iv, tag, ct]).toString("base64");
	}

	it("decrypts a legacy (masterKey-only) ciphertext via the fallback", () => {
		const loggerWarn = jest
			.spyOn((service as any).logger, "warn")
			.mockImplementation(() => undefined);
		const payload = { host: "smtp.legacy", port: 465, user: "u", pass: "p" };
		const legacy = legacyEncrypt(payload, masterKey);
		const decrypted = service.decrypt(legacy, "org-1");
		expect(decrypted).toEqual(payload);
		expect(loggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("LEGACY master-key scheme"),
		);
	});

	it("prefers the HKDF scheme when both could decode (no fallback used)", () => {
		const loggerWarn = jest
			.spyOn((service as any).logger, "warn")
			.mockImplementation(() => undefined);
		const payload = { apiKey: "k1" };
		const encrypted = service.encrypt(payload, "org-1");
		const decrypted = service.decrypt(encrypted, "org-1");
		expect(decrypted).toEqual(payload);
		expect(loggerWarn).not.toHaveBeenCalled();
	});

	it("re-throws when both schemes fail (well-formed garbage)", () => {
		const garbage = Buffer.concat([
			randomBytes(12),
			randomBytes(16),
			randomBytes(8),
		]).toString("base64");
		expect(() => service.decrypt(garbage, "org-1")).toThrow();
	});

	// ── M1.4 post-decrypt payload shape validation ────────────────────────────

	it("throws a descriptive shape error when the decrypted payload is missing required fields", () => {
		// Decryption succeeds (valid ciphertext) but the payload is malformed:
		// not a full SMTP shape (port/user/pass missing) and not an API-key shape.
		const malformed = service.encrypt({ host: "smtp.example.com" }, "org-1");
		expect(() => service.decrypt(malformed, "org-1")).toThrow(
			/EmailCredentialsService.*port \(missing\).*apiKey \(missing\)/,
		);
	});
});
