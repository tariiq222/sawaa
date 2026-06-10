import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, randomBytes } from "crypto";
import { ZoomCredentialsService } from "./zoom-credentials.service";

describe("ZoomCredentialsService", () => {
	let service: ZoomCredentialsService;
	let masterKey: Buffer;

	beforeEach(async () => {
		masterKey = Buffer.alloc(32);
		for (let i = 0; i < 32; i++) masterKey[i] = (i + 1) & 0xff;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ZoomCredentialsService,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn().mockReturnValue(masterKey.toString("base64")),
					},
				},
			],
		}).compile();

		service = module.get<ZoomCredentialsService>(ZoomCredentialsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("should encrypt and decrypt payload", () => {
		const payload = {
			zoomAccountId: "acc",
			zoomClientId: "cli",
			zoomClientSecret: "sec",
		};
		const encrypted = service.encrypt(payload, "org-1");
		expect(typeof encrypted).toBe("string");
		const decrypted = service.decrypt(encrypted, "org-1");
		expect(decrypted).toEqual(payload);
	});

	it("should throw when key is missing", () => {
		expect(() => {
			new ZoomCredentialsService({ get: () => undefined } as any);
		}).toThrow();
	});

	it("should throw when key is wrong length", () => {
		expect(() => {
			new ZoomCredentialsService({
				get: () => Buffer.alloc(16).toString("base64"),
			} as any);
		}).toThrow();
	});

	it("should throw on invalid ciphertext length", () => {
		expect(() => service.decrypt("short", "org-1")).toThrow(
			"Invalid ciphertext length",
		);
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
		const payload = {
			zoomClientId: "cli_legacy",
			zoomClientSecret: "sec_legacy",
			zoomAccountId: "acc_legacy",
		};
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
		const payload = {
			zoomAccountId: "a",
			zoomClientId: "b",
			zoomClientSecret: "c",
		};
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
		// zoomAccountId and zoomClientSecret are missing.
		const malformed = service.encrypt({ zoomClientId: "cli" }, "org-1");
		expect(() => service.decrypt(malformed, "org-1")).toThrow(
			/ZoomCredentialsService.*zoomAccountId \(missing\)/,
		);
	});
});
