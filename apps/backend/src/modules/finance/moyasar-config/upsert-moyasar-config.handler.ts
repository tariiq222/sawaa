import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { MoyasarCredentialsService } from "../../../infrastructure/payments/moyasar-credentials.service";
import { MoyasarApiClient } from "../moyasar-api/moyasar-api.client";
import {
	DEFAULT_ORG_ID,
	PAYMENT_CONFIG_SINGLETON_KEY,
} from "../../../common/constants";

export interface UpsertMoyasarConfigCommand {
	publishableKey: string;
	secretKey?: string;
	webhookSecret?: string;
	isLive?: boolean;
}

export interface UpsertMoyasarConfigResult {
	organizationId: string;
	publishableKey: string;
	isLive: boolean;
	updatedAt: Date;
}

@Injectable()
export class UpsertMoyasarConfigHandler {
	constructor(
		private readonly prisma: PrismaService,
		private readonly creds: MoyasarCredentialsService,
		private readonly moyasarClient: MoyasarApiClient,
	) {}

	async execute(
		cmd: UpsertMoyasarConfigCommand,
	): Promise<UpsertMoyasarConfigResult> {
		const organizationId = DEFAULT_ORG_ID;

		// OrgPaymentConfig is a DB-enforced singleton (UNIQUE singletonKey). Read
		// the current row only to decide create-vs-update semantics; the write
		// below is an atomic upsert keyed on singletonKey, so two concurrent
		// callers can never create divergent duplicate rows.
		const existing = await this.prisma.organizationPaymentConfig.findUnique({
			where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
		});

		if (!existing && (!cmd.secretKey || !cmd.webhookSecret)) {
			throw new Error(
				"secretKey and webhookSecret are required when creating a new Moyasar config",
			);
		}

		// On update with a secret omitted, keep the existing encrypted value.
		const secretKeyEnc =
			cmd.secretKey !== undefined
				? this.creds.encrypt({ secretKey: cmd.secretKey }, organizationId)
				: existing?.secretKeyEnc;
		const webhookSecretEnc =
			cmd.webhookSecret !== undefined
				? this.creds.encrypt({ webhookSecret: cmd.webhookSecret }, organizationId)
				: existing?.webhookSecretEnc;

		const row = await this.prisma.organizationPaymentConfig.upsert({
			where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
			create: {
				singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
				publishableKey: cmd.publishableKey,
				secretKeyEnc: secretKeyEnc!,
				webhookSecretEnc: webhookSecretEnc!,
				isLive: cmd.isLive ?? false,
			},
			update: {
				publishableKey: cmd.publishableKey,
				...(secretKeyEnc !== undefined && { secretKeyEnc }),
				...(webhookSecretEnc !== undefined && { webhookSecretEnc }),
				isLive: cmd.isLive ?? existing?.isLive ?? false,
				// updating credentials invalidates the prior verification
				lastVerifiedAt: null,
				lastVerifiedStatus: null,
			},
		});

		// Invalidate the in-process key cache so the next payment request
		// picks up the newly written credentials instead of the stale copy.
		this.moyasarClient.invalidate(organizationId);

		return {
			organizationId: DEFAULT_ORG_ID,
			publishableKey: row.publishableKey,
			isLive: row.isLive,
			updatedAt: row.updatedAt,
		};
	}
}
