/**
 * P2.B credential rekey — migrates every encrypted-credentials row in the DB
 * from the legacy `masterKey`-only scheme to the current HKDF-SHA256 +
 * AES-256-GCM scheme.
 *
 * Why this script exists
 * ───────────────────────
 * Before 2026-05-09 the four credential services (Moyasar, SMS, Email, Zoom)
 * encrypted with the master key directly, with no per-context key derivation.
 * On 2026-05-09 we shipped the HKDF context-bound scheme for forward safety.
 * The runtime now reads BOTH schemes (try HKDF, fall back to masterKey on
 * GCM auth-tag mismatch), so legacy rows keep working without operator
 * intervention — but every legacy row leaves the codepath permanently once
 * it is re-saved by an upsert call.
 *
 * This script forces a one-shot full-table re-encryption so operators do not
 * have to wait for natural upserts. It is safe to re-run; rows that already
 * match the new scheme are detected and skipped.
 *
 * What it touches
 * ───────────────
 *  - OrganizationPaymentConfig  (Moyasar: secretKeyEnc, webhookSecretEnc)
 *  - OrganizationSmsConfig      (credentialsCiphertext)
 *  - OrganizationEmailConfig    (credentialsCiphertext)
 *  - Integration                (Zoom: config.ciphertext)
 *
 * For each row, the script:
 *   1. Tries to decrypt the column with the new HKDF scheme. If it succeeds,
 *      the row is already migrated — skip.
 *   2. If it fails with an auth-tag error, retries with the legacy masterKey
 *      scheme. If THAT succeeds, re-encrypts with the new scheme and writes
 *      the row back. Logs the change.
 *   3. If both schemes fail, logs a hard error and continues with the next
 *      row. The script never aborts on a single bad row.
 *
 * Usage
 * ─────
 *   pnpm run rekey:credentials
 *   pnpm run rekey:credentials -- --dry-run      # report only, no writes
 *
 * Required env: DATABASE_URL, MOYASAR_ENCRYPTION_KEY, SMS_PROVIDER_ENCRYPTION_KEY,
 *               ZOOM_PROVIDER_ENCRYPTION_KEY, EMAIL_PROVIDER_ENCRYPTION_KEY
 *
 * Safety
 * ──────
 *  - Idempotent: rows already on the new scheme are detected via the
 *    successful HKDF decrypt and skipped.
 *  - Single transaction per row (so a partial write does not corrupt a row).
 *  - Exits 0 when at least one pass completes; prints a summary.
 *  - In --dry-run mode, performs all decrypts but never updates the DB.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import {
	createCipheriv,
	createDecipheriv,
	hkdfSync,
	randomBytes,
} from "crypto";
import {
	DEFAULT_ORG_ID,
	SINGLE_TENANT_CONTEXT_ID,
} from "../src/common/constants";

const HKDF_SALT = {
	moyasar: "deqah-moyasar-creds-v1",
	sms: "deqah-sms-creds-v1",
	email: "deqah-email-creds-v1",
	zoom: "deqah-zoom-creds-v1",
} as const;
const HKDF_KEY_LEN = 32;

const DRY_RUN = process.argv.includes("--dry-run");
const CTX = DEFAULT_ORG_ID;

const cfg = new ConfigService({
	MOYASAR_ENCRYPTION_KEY: process.env.MOYASAR_ENCRYPTION_KEY,
	SMS_PROVIDER_ENCRYPTION_KEY: process.env.SMS_PROVIDER_ENCRYPTION_KEY,
	EMAIL_PROVIDER_ENCRYPTION_KEY: process.env.EMAIL_PROVIDER_ENCRYPTION_KEY,
	ZOOM_PROVIDER_ENCRYPTION_KEY: process.env.ZOOM_PROVIDER_ENCRYPTION_KEY,
} as Record<string, string>);

function loadMasterKey(envName: string): Buffer {
	const raw = cfg.get<string>(envName);
	if (!raw) throw new Error(`${envName} missing from env`);
	const buf = Buffer.from(raw, "base64");
	if (buf.length !== 32) {
		throw new Error(`${envName} must decode to 32 bytes (got ${buf.length})`);
	}
	return buf;
}

const keys = {
	moyasar: loadMasterKey("MOYASAR_ENCRYPTION_KEY"),
	sms: loadMasterKey("SMS_PROVIDER_ENCRYPTION_KEY"),
	email: loadMasterKey("EMAIL_PROVIDER_ENCRYPTION_KEY"),
	zoom: loadMasterKey("ZOOM_PROVIDER_ENCRYPTION_KEY"),
};

function deriveHkey(salt: string, masterKey: Buffer): Buffer {
	return Buffer.from(hkdfSync("sha256", masterKey, salt, CTX, HKDF_KEY_LEN));
}

function tryDecrypt(
	key: Buffer,
	ciphertext: string,
): Record<string, unknown> | null {
	try {
		const buf = Buffer.from(ciphertext, "base64");
		if (buf.length < 28) return null;
		const iv = buf.subarray(0, 12);
		const tag = buf.subarray(12, 28);
		const ct = buf.subarray(28);
		const decipher = createDecipheriv("aes-256-gcm", key, iv);
		decipher.setAuthTag(tag);
		const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
		return JSON.parse(plain.toString("utf8"));
	} catch {
		return null;
	}
}

function encryptWith(key: Buffer, payload: Record<string, unknown>): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const plain = Buffer.from(JSON.stringify(payload), "utf8");
	const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, ct]).toString("base64");
}

/**
 * For a given ciphertext + (masterKey, hkdfKey, salt) tuple, returns either:
 *   { alreadyNew: true }                                   — HKDF decrypt worked
 *   { alreadyNew: false, payload, reencrypted }            — legacy → re-encrypted
 *   { error: string }                                      — both schemes failed
 *
 * `reencrypted` uses HKDF (the new scheme).
 */
function rekey(
	columnName: string,
	ciphertext: string | null | undefined,
	masterKey: Buffer,
	salt: string,
):
	| { alreadyNew: true }
	| { alreadyNew: false; payload: Record<string, unknown>; reencrypted: string }
	| { error: string } {
	if (!ciphertext) return { alreadyNew: true }; // empty cell — nothing to migrate
	const hkey = deriveHkey(salt, masterKey);

	const newScheme = tryDecrypt(hkey, ciphertext);
	if (newScheme !== null) return { alreadyNew: true };

	const legacyScheme = tryDecrypt(masterKey, ciphertext);
	if (legacyScheme !== null) {
		return {
			alreadyNew: false,
			payload: legacyScheme,
			reencrypted: encryptWith(hkey, legacyScheme),
		};
	}

	return { error: `${columnName}: both HKDF and legacy decrypt failed` };
}

interface Summary {
	scanned: number;
	migrated: number;
	alreadyNew: number;
	errors: string[];
}

function emptySummary(): Summary {
	return { scanned: 0, migrated: 0, alreadyNew: 0, errors: [] };
}

async function rekeyMoyasar(prisma: PrismaClient): Promise<Summary> {
	const s = emptySummary();
	const rows = await prisma.organizationPaymentConfig.findMany();
	for (const row of rows) {
		s.scanned += 1;
		try {
			const secretResult = rekey(
				"secretKeyEnc",
				row.secretKeyEnc,
				keys.moyasar,
				HKDF_SALT.moyasar,
			);
			const webhookResult = rekey(
				"webhookSecretEnc",
				row.webhookSecretEnc,
				keys.moyasar,
				HKDF_SALT.moyasar,
			);

			const updates: { secretKeyEnc?: string; webhookSecretEnc?: string } = {};

			if ("error" in secretResult)
				s.errors.push(`Moyasar ${row.id}: ${secretResult.error}`);
			else if (!secretResult.alreadyNew)
				updates.secretKeyEnc = secretResult.reencrypted;

			if ("error" in webhookResult)
				s.errors.push(`Moyasar ${row.id}: ${webhookResult.error}`);
			else if (!webhookResult.alreadyNew)
				updates.webhookSecretEnc = webhookResult.reencrypted;

			if (Object.keys(updates).length > 0) {
				if (!DRY_RUN) {
					await prisma.organizationPaymentConfig.update({
						where: { id: row.id },
						data: updates,
					});
				}
				s.migrated += 1;
				console.log(
					`  ✔ Moyasar ${row.id}: re-encrypted ${Object.keys(updates).join(", ")}`,
				);
			} else {
				s.alreadyNew += 1;
			}
		} catch (e) {
			s.errors.push(`Moyasar ${row.id}: ${(e as Error).message}`);
		}
	}
	return s;
}

async function rekeySms(prisma: PrismaClient): Promise<Summary> {
	const s = emptySummary();
	const rows = await prisma.organizationSmsConfig.findMany();
	for (const row of rows) {
		s.scanned += 1;
		const result = rekey(
			"credentialsCiphertext",
			row.credentialsCiphertext,
			keys.sms,
			HKDF_SALT.sms,
		);
		if ("error" in result) {
			s.errors.push(`SMS ${row.id}: ${result.error}`);
		} else if (result.alreadyNew) {
			s.alreadyNew += 1;
		} else {
			if (!DRY_RUN) {
				await prisma.organizationSmsConfig.update({
					where: { id: row.id },
					data: { credentialsCiphertext: result.reencrypted },
				});
			}
			s.migrated += 1;
			console.log(`  ✔ SMS ${row.id}: re-encrypted credentialsCiphertext`);
		}
	}
	return s;
}

async function rekeyEmail(prisma: PrismaClient): Promise<Summary> {
	const s = emptySummary();
	const rows = await prisma.organizationEmailConfig.findMany();
	for (const row of rows) {
		s.scanned += 1;
		const result = rekey(
			"credentialsCiphertext",
			row.credentialsCiphertext,
			keys.email,
			HKDF_SALT.email,
		);
		if ("error" in result) {
			s.errors.push(`Email ${row.id}: ${result.error}`);
		} else if (result.alreadyNew) {
			s.alreadyNew += 1;
		} else {
			if (!DRY_RUN) {
				await prisma.organizationEmailConfig.update({
					where: { id: row.id },
					data: { credentialsCiphertext: result.reencrypted },
				});
			}
			s.migrated += 1;
			console.log(`  ✔ Email ${row.id}: re-encrypted credentialsCiphertext`);
		}
	}
	return s;
}

async function rekeyZoom(prisma: PrismaClient): Promise<Summary> {
	const s = emptySummary();
	const rows = await prisma.integration.findMany({
		where: { provider: "zoom" },
	});
	for (const row of rows) {
		s.scanned += 1;
		const config = row.config as { ciphertext?: string } | null;
		const ciphertext = config?.ciphertext;
		const result = rekey(
			"config.ciphertext",
			ciphertext,
			keys.zoom,
			HKDF_SALT.zoom,
		);
		if ("error" in result) {
			s.errors.push(`Zoom ${row.id}: ${result.error}`);
		} else if (result.alreadyNew) {
			s.alreadyNew += 1;
		} else {
			if (!DRY_RUN) {
				await prisma.integration.update({
					where: { id: row.id },
					data: { config: { ciphertext: result.reencrypted } },
				});
			}
			s.migrated += 1;
			console.log(`  ✔ Zoom ${row.id}: re-encrypted config.ciphertext`);
		}
	}
	return s;
}

function printSummary(label: string, s: Summary): void {
	console.log(`\n${label}`);
	console.log(`  scanned:     ${s.scanned}`);
	console.log(`  migrated:    ${s.migrated}`);
	console.log(`  alreadyNew:  ${s.alreadyNew}`);
	if (s.errors.length > 0) {
		console.log(`  errors (${s.errors.length}):`);
		for (const e of s.errors) console.log(`    - ${e}`);
	}
}

async function main(): Promise<void> {
	if (DRY_RUN) console.log("▶ DRY-RUN: no writes will be performed.\n");

	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
	});
	await prisma.$connect();

	const total: Summary = { scanned: 0, migrated: 0, alreadyNew: 0, errors: [] };
	for (const [label, fn] of [
		["Moyasar", rekeyMoyasar],
		["SMS", rekeySms],
		["Email", rekeyEmail],
		["Zoom", rekeyZoom],
	] as const) {
		const s = await fn(prisma);
		printSummary(label, s);
		total.scanned += s.scanned;
		total.migrated += s.migrated;
		total.alreadyNew += s.alreadyNew;
		total.errors.push(...s.errors);
	}

	await prisma.$disconnect();

	console.log("\n── TOTAL ──");
	printSummary("all", total);
	// Reference SINGLE_TENANT_CONTEXT_ID so the import is preserved for consistency
	// with the rest of the codebase that uses the alias.
	void SINGLE_TENANT_CONTEXT_ID;

	process.exit(total.errors.length > 0 ? 2 : 0);
}

main().catch((e) => {
	console.error("rekey failed:", e);
	process.exit(1);
});
