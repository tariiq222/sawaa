import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "crypto";
import { MoyasarCredentialsService } from "./moyasar-credentials.service";

describe("MoyasarCredentialsService", () => {
	let service: MoyasarCredentialsService;
	let masterKey: Buffer;

	beforeEach(async () => {
		masterKey = Buffer.alloc(32);
		// Fill with deterministic non-zero bytes so the test never accidentally
		// matches an all-zero key (which would also be a 32-byte buffer).
		for (let i = 0; i < 32; i++) masterKey[i] = (i + 1) & 0xff;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MoyasarCredentialsService,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn().mockReturnValue(masterKey.toString("base64")),
					},
				},
			],
		}).compile();

		service = module.get<MoyasarCredentialsService>(MoyasarCredentialsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("should encrypt and decrypt payload", () => {
		const payload = { secretKey: "sk_test" };
		const encrypted = service.encrypt(payload, "org-1");
		expect(typeof encrypted).toBe("string");
		const decrypted = service.decrypt(encrypted, "org-1");
		expect(decrypted).toEqual(payload);
	});

	it("should throw when key is missing", () => {
		expect(() => {
			new MoyasarCredentialsService({ get: () => undefined } as any);
		}).toThrow();
	});

	it("should throw when key is wrong length", () => {
		expect(() => {
			new MoyasarCredentialsService({
				get: () => Buffer.alloc(16).toString("base64"),
			} as any);
		}).toThrow();
	});

	// ── P2.B dual-scheme reader (added 2026-06-09) ────────────────────────────

	/**
	 * Replicates the legacy `masterKey`-direct scheme used before 2026-05-09.
	 * Decrypting this column with the current HKDF scheme MUST fail; the
	 * fallback in decrypt() must then succeed.
	 */
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
		const payload = { secretKey: "sk_legacy", webhookSecret: "whsec_legacy" };
		const legacy = legacyEncrypt(payload, masterKey);
		const decrypted = service.decrypt(legacy, "org-1");
		expect(decrypted).toEqual(payload);
		// Fallback was used, not the HKDF path.
		expect(loggerWarn).toHaveBeenCalledWith(
			expect.stringContaining("LEGACY master-key scheme"),
		);
	});

	it("prefers the HKDF scheme when both could decode (no fallback used)", () => {
		const loggerWarn = jest
			.spyOn((service as any).logger, "warn")
			.mockImplementation(() => undefined);
		const payload = { secretKey: "sk_new" };
		const encrypted = service.encrypt(payload, "org-1");
		const decrypted = service.decrypt(encrypted, "org-1");
		expect(decrypted).toEqual(payload);
		expect(loggerWarn).not.toHaveBeenCalled();
	});

	it("re-throws the original (HKDF) error when both schemes fail", () => {
		// A ciphertext that is well-formed base64 + correct length, but
		// encrypts garbage — neither HKDF nor masterKey will validate the tag.
		const garbage = Buffer.concat([
			randomBytes(12),
			randomBytes(16),
			randomBytes(8),
		]).toString("base64");
		expect(() => service.decrypt(garbage, "org-1")).toThrow();
	});

	it("propagates structural errors without invoking the legacy fallback", () => {
		const loggerWarn = jest
			.spyOn((service as any).logger, "warn")
			.mockImplementation(() => undefined);
		expect(() => service.decrypt("not-base64-!@#$%^&*()", "org-1")).toThrow();
		expect(loggerWarn).not.toHaveBeenCalled();
	});

	// ── M1.4 post-decrypt payload shape validation ────────────────────────────

	it("throws a descriptive shape error when the decrypted payload is missing required fields", () => {
		// Decryption succeeds (valid ciphertext) but the payload is malformed:
		// neither a { secretKey } nor a { webhookSecret } payload.
		const malformed = service.encrypt({ publishableKey: "pk_test" }, "org-1");
		expect(() => service.decrypt(malformed, "org-1")).toThrow(
			/MoyasarCredentialsService.*secretKey \(missing\).*webhookSecret \(missing\)/,
		);
	});

	it("accepts a payload where the required field is present alongside extras", () => {
		const payload = { secretKey: "sk_test", note: "extra" };
		const encrypted = service.encrypt(payload, "org-1");
		expect(service.decrypt(encrypted, "org-1")).toEqual(payload);
	});
});
