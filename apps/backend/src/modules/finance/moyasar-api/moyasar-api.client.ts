import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { fetchWithTimeout } from "../../../infrastructure/http";
import { MoyasarCredentialsService } from "../../../infrastructure/payments/moyasar-credentials.service";
import { PAYMENT_CONFIG_SINGLETON_KEY } from "../../../common/constants";

export interface MoyasarCreateCheckoutInvoiceParams {
	amountHalalas: number;
	currency: string;
	description: string;
	successUrl: string;
	backUrl: string;
	metadata: Record<string, string>;
}

export type MoyasarCheckoutInvoiceStatus =
	| "initiated"
	| "paid"
	| "expired"
	| "failed"
	| "canceled"
	| "refunded"
	| "voided"
	| "on_hold";

export interface MoyasarCheckoutInvoicePayment {
	id: string;
	status: MoyasarPaymentStatus;
}

export interface MoyasarCheckoutInvoice {
	id: string;
	status: MoyasarCheckoutInvoiceStatus;
	amount: number;
	currency: string;
	url: string;
	metadata: Record<string, string>;
	payments: MoyasarCheckoutInvoicePayment[];
}

export type MoyasarRefundStatus = "paid" | "failed" | "pending";

/**
 * Moyasar payment lifecycle statuses as reported by `GET /v1/payments/:id`.
 * `initiated` covers pending-like states; the terminal states are
 * `paid`/`captured` (success), `failed`/`voided` (failure) and `refunded`.
 */
export type MoyasarPaymentStatus =
	| "initiated"
	| "paid"
	| "failed"
	| "authorized"
	| "captured"
	| "voided"
	| "refunded";

export interface MoyasarPaymentStatusResult {
	id: string;
	status: MoyasarPaymentStatus;
	amount: number;
	/** Cumulative amount already refunded by Moyasar, in halalas. */
	refunded: number;
	currency: string;
	/** Hosted invoice that originated this payment, when Moyasar supplies it. */
	invoiceId?: string;
}

export interface MoyasarRefund {
	id: string;
	/** Amount requested by this call, in halalas. */
	amount: number;
	/** Authoritative cumulative refunded amount returned by Moyasar. */
	refunded: number;
	currency: string;
	status: "refunded";
	paymentId: string;
	createdAt: string;
}

export interface MoyasarRefundStatusResult {
	id: string;
	status: MoyasarRefundStatus;
}

interface MoyasarCheckoutInvoiceApiResponse {
	id: string;
	status: MoyasarCheckoutInvoiceStatus;
	amount: number;
	currency: string;
	url: string;
	metadata: Record<string, string>;
	payments?: Array<{
		id: string;
		status: MoyasarPaymentStatus;
	}>;
}

interface MoyasarErrorResponse {
	type: string;
	message: string;
	status: number;
}

const KEY_CACHE_TTL_MS = 300_000; // 5 minutes

interface KeyCacheEntry {
	key: string;
	expiresAt: number;
}

@Injectable()
export class MoyasarApiClient {
	private readonly baseUrl = "https://api.moyasar.com/v1";
	private readonly keyCache = new Map<string, KeyCacheEntry>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly creds: MoyasarCredentialsService,
	) {}

	/**
	 * Invalidates the cached decrypted API key for one organization.
	 * Call this after updating `OrganizationPaymentConfig.secretKeyEnc`.
	 */
	invalidate(organizationId: string): void {
		this.keyCache.delete(organizationId);
	}

	/**
	 * Resolves the tenant's Moyasar secret key from `OrganizationPaymentConfig`.
	 * Result is cached in-process for 5 minutes to avoid a DB + decrypt round-trip
	 * on every payment request.
	 * Throws BadRequest (not InternalServerError) — missing config is a tenant
	 * configuration problem, not a platform bug; the dashboard surfaces it.
	 */
	private async getApiKeyForOrg(organizationId: string): Promise<string> {
		const cached = this.keyCache.get(organizationId);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.key;
		}

		const cfg = await this.prisma.organizationPaymentConfig.findUnique({
			where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
		});
		if (!cfg) {
			throw new BadRequestException(
				`Moyasar is not configured for organization ${organizationId}. ` +
					`Configure tenant credentials in Dashboard → Settings → Payments.`,
			);
		}
		const decrypted = this.creds.decrypt<{ secretKey: string }>(
			cfg.secretKeyEnc,
			organizationId,
		);
		const key = decrypted.secretKey;
		this.keyCache.set(organizationId, {
			key,
			expiresAt: Date.now() + KEY_CACHE_TTL_MS,
		});
		return key;
	}

	private async request<T>(
		organizationId: string,
		path: string,
		options: RequestInit,
	): Promise<T> {
		const apiKey = await this.getApiKeyForOrg(organizationId);
		const basicAuth = Buffer.from(`${apiKey}:`, "utf8").toString("base64");
		const response = await fetchWithTimeout(
			`${this.baseUrl}${path}`,
			{
				...options,
				headers: {
					Authorization: `Basic ${basicAuth}`,
					"Content-Type": "application/json",
					...options.headers,
				},
			},
			15_000, // 15s for payment operations
		);

		if (!response.ok) {
			const error = (await response
				.json()
				.catch(() => ({
					message: response.statusText,
				}))) as MoyasarErrorResponse;
			// A 404 is a permanent "this resource does not exist" — distinguish it so
			// callers (e.g. the webhook handler) can drop-and-ack instead of retrying.
			if (response.status === 404) {
				throw new NotFoundException(
					`Moyasar API error: ${error.message} (status: 404)`,
				);
			}
			throw new InternalServerErrorException(
				`Moyasar API error: ${error.message} (status: ${response.status})`,
			);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * Creates a Moyasar-hosted checkout page. No card source is collected by
	 * Sawaa; the returned `url` is the page clients open.
	 */
	async createCheckoutInvoice(
		organizationId: string,
		params: MoyasarCreateCheckoutInvoiceParams,
	): Promise<MoyasarCheckoutInvoice> {
		const data = await this.request<MoyasarCheckoutInvoiceApiResponse>(
			organizationId,
			"/invoices",
			{
				method: "POST",
				body: JSON.stringify({
					amount: params.amountHalalas,
					currency: params.currency,
					description: params.description,
					success_url: params.successUrl,
					back_url: params.backUrl,
					metadata: params.metadata,
				}),
			},
		);

		return this.mapCheckoutInvoice(data);
	}

	async getCheckoutInvoice(
		organizationId: string,
		invoiceId: string,
	): Promise<MoyasarCheckoutInvoice> {
		const data = await this.request<MoyasarCheckoutInvoiceApiResponse>(
			organizationId,
			`/invoices/${encodeURIComponent(invoiceId)}`,
			{ method: "GET" },
		);
		return this.mapCheckoutInvoice(data);
	}

	/**
	 * Recovers a create call whose outcome was unknown by querying the immutable
	 * internal payment identity stored in Moyasar invoice metadata.
	 */
	async findCheckoutInvoiceByMetadata(
		organizationId: string,
		internalPaymentId: string,
	): Promise<MoyasarCheckoutInvoice | null> {
		const query = new URLSearchParams({
			"metadata[internalPaymentId]": internalPaymentId,
		});
		const data = await this.request<
			MoyasarCheckoutInvoiceApiResponse[] | { invoices: MoyasarCheckoutInvoiceApiResponse[] }
		>(organizationId, `/invoices?${query.toString()}`, { method: "GET" });
		const invoices = Array.isArray(data) ? data : data.invoices;
		return invoices[0] ? this.mapCheckoutInvoice(invoices[0]) : null;
	}

	async createRefund(
		organizationId: string,
		params: { paymentId: string; amount: number },
	): Promise<MoyasarRefund> {
		const body = { amount: params.amount };

		const data = await this.request<{
			id: string;
			amount: number;
			currency: string;
			status: string;
			refunded: number;
			updated_at: string;
		}>(organizationId, `/payments/${params.paymentId}/refund`, {
			method: "POST",
			body: JSON.stringify(body),
		});

		return {
			id: data.id,
			amount: params.amount,
			refunded: data.refunded,
			currency: data.currency,
			status: "refunded",
			paymentId: data.id,
			createdAt: data.updated_at,
		};
	}

	/**
	 * Fetches the status of a previously issued refund from Moyasar.
	 * Used by the reconcile-refunds cron to finalize PROCESSING rows that
	 * stalled after the gateway round-trip succeeded but our DB write failed.
	 *
	 * Because `createRefund` stores the Moyasar **payment** ID as the gateway
	 * reference (the refund endpoint returns the full payment object, not a
	 * separate refund resource), `moyasarRefundId` here is actually the payment
	 * ID. We re-fetch `GET /v1/payments/:id` and derive the refund status from
	 * the payment's `status` field.
	 *
	 * Derivation:
	 *   - payment.status === 'refunded'             → 'paid'
	 *   - payment.status === 'failed' | 'voided'    → 'failed'
	 *   - anything else                             → 'pending'
	 */
	async getRefundStatus(
		organizationId: string,
		moyasarRefundId: string,
	): Promise<MoyasarRefundStatusResult> {
		const payment = await this.getPaymentStatus(organizationId, moyasarRefundId);

		let status: MoyasarRefundStatus;
		if (payment.status === "refunded") {
			status = "paid";
		} else if (payment.status === "failed" || payment.status === "voided") {
			status = "failed";
		} else {
			status = "pending";
		}

		return { id: payment.id, status };
	}

	/**
	 * Fetches the authoritative state of a payment from Moyasar.
	 * Used by the webhook handler to re-verify a (signed but possibly stale or
	 * replayed) webhook body against the source of truth — never trust the body.
	 *
	 * GET /v1/payments/:id → { id, status, amount, currency }
	 *
	 * A transient/network failure or 5xx propagates as InternalServerErrorException
	 * (caller should let it bubble so Moyasar retries). A 404 surfaces as a
	 * BadRequestException — the payment does not exist, retrying will not help.
	 */
	async getPaymentStatus(
		organizationId: string,
		paymentId: string,
	): Promise<MoyasarPaymentStatusResult> {
		const data = await this.request<{
			id: string;
			status: string;
			amount: number;
			refunded: number;
			currency: string;
			invoice_id?: string;
		}>(organizationId, `/payments/${paymentId}`, { method: "GET" });

		return {
			id: data.id,
			status: data.status as MoyasarPaymentStatus,
			amount: data.amount,
			refunded: data.refunded ?? 0,
			currency: data.currency,
			...(data.invoice_id ? { invoiceId: data.invoice_id } : {}),
		};
	}

	private mapCheckoutInvoice(
		data: MoyasarCheckoutInvoiceApiResponse,
	): MoyasarCheckoutInvoice {
		return {
			id: data.id,
			status: data.status,
			amount: data.amount,
			currency: data.currency,
			url: data.url,
			metadata: data.metadata,
			payments: (data.payments ?? []).map((payment) => ({
				id: payment.id,
				status: payment.status,
			})),
		};
	}
}
