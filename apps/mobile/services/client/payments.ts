import api from '../api';
import type { NativePaymentCapabilities, NativePaymentInitResponse, NativePaymentReconcileResponse, ClientBankTransferSettings } from '@sawaa/shared';
import type { Payment } from '@/types/models';
import { readListEnvelope, type ListMeta } from './list-envelope';

export interface ReceiptUploadAsset {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface ReceiptUploadMetadata {
  type: 'image/png' | 'image/jpeg';
  name: string;
}

const MIME_BY_EXTENSION: Record<string, ReceiptUploadMetadata['type']> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

function extensionOf(value: string): string | null {
  const path = value.split(/[?#]/, 1)[0];
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match?.[1].toLowerCase() ?? null;
}

export function getReceiptUploadMetadata(asset: ReceiptUploadAsset): ReceiptUploadMetadata {
  const suppliedMime = asset.mimeType?.trim().toLowerCase();
  const fileName = asset.fileName?.trim() || undefined;
  const fileExtension = extensionOf(fileName ?? '') ?? extensionOf(asset.uri);
  const extensionMime = fileExtension ? MIME_BY_EXTENSION[fileExtension] : undefined;
  const type = suppliedMime === 'image/jpg' ? 'image/jpeg' : suppliedMime;

  if (type && type !== 'image/png' && type !== 'image/jpeg') {
    throw new Error('Unsupported receipt file type');
  }
  if (type && extensionMime && type !== extensionMime) {
    throw new Error('Unsupported receipt file type');
  }

  const resolvedType = type === 'image/png' || type === 'image/jpeg' ? type : extensionMime;
  if (!resolvedType) {
    throw new Error('Unsupported receipt file type');
  }

  const fallbackName = asset.uri.split(/[?#]/, 1)[0].split('/').pop() || undefined;
  return {
    type: resolvedType,
    name: fileName ?? fallbackName ?? `receipt.${resolvedType === 'image/png' ? 'png' : 'jpg'}`,
  };
}

export type ClientPaymentInitMethod = 'ONLINE_CARD' | 'APPLE_PAY';

export interface ClientPaymentInitResponse {
  paymentId: string;
  redirectUrl: string;
}

export interface ClientInvoice {
  id: string;
  number?: number;
  status: string;
  total?: number | string;
  currency?: string;
  /** True when a receipt exists; fetch it with `getMyInvoicePdfUrl`. */
  hasReceipt?: boolean;
  payments?: ClientInvoicePayment[];
}

export interface ClientInvoicePayment {
  id: string;
  status: string;
  createdAt?: string;
  amount?: number | string;
  method?: string;
}

export interface ClientBankTransferUploadResponse {
  id: string;
}

export interface PaymentsListResponse {
  items: Payment[];
  meta: ListMeta;
}

export interface ClientInvoiceListItem {
  id: string;
  [key: string]: unknown;
}

export interface ClientInvoicesListResponse {
  items: ClientInvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Outstanding balance across all invoices, integer halalas. */
  outstandingBalance: number;
}

export interface ClientRefundRequestInput {
  invoiceId: string;
  reason?: string;
}

/** GET /client/invoices */
export async function listMyInvoices(params?: { page?: number; pageSize?: number }): Promise<ClientInvoicesListResponse> {
  const response = await api.get<ClientInvoicesListResponse>('/client/invoices', { params });
  return response.data;
}

/** GET /client/invoices/:id/pdf: short-lived presigned receipt URL. */
export async function getMyInvoicePdfUrl(id: string): Promise<{ url: string }> {
  const response = await api.get<{ url: string }>(`/client/invoices/${encodeURIComponent(id)}/pdf`);
  return response.data;
}

/** POST /client/refunds/request */
export async function requestRefund(input: ClientRefundRequestInput): Promise<unknown> {
  const response = await api.post<unknown>('/client/refunds/request', input);
  return response.data;
}

export const clientPaymentsService = {
  async getNativeConfig(): Promise<NativePaymentCapabilities> {
    const response = await api.get<NativePaymentCapabilities>('/client/payments/native/config');
    return response.data;
  },

  async initNativePayment(invoiceId: string, method: ClientPaymentInitMethod): Promise<NativePaymentInitResponse> {
    const response = await api.post<NativePaymentInitResponse>('/client/payments/native/init', { invoiceId, method });
    return response.data;
  },

  async reconcileNativePayment(paymentId: string): Promise<NativePaymentReconcileResponse> {
    const response = await api.post<NativePaymentReconcileResponse>(`/client/payments/native/${paymentId}/reconcile`);
    return response.data;
  },

  async getBankTransferSettings(): Promise<ClientBankTransferSettings> {
    const response = await api.get<ClientBankTransferSettings>(
      '/client/payments/bank-transfer/settings',
    );
    return response.data;
  },

  async list(params?: { page?: number; limit?: number }): Promise<PaymentsListResponse> {
    // Public contract uses `pageSize`; screens keep passing `limit`.
    const response = await api.get<unknown>(
      '/client/payments',
      { params: params ? { page: params.page, pageSize: params.limit } : undefined },
    );
    return readListEnvelope<Payment>(response.data, params?.limit);
  },

  async getInvoice(id: string) {
    const response = await api.get<ClientInvoice>(
      `/client/invoices/${id}`,
    );
    return response.data;
  },

  async initPayment(
    invoiceId: string,
    method: ClientPaymentInitMethod,
  ): Promise<ClientPaymentInitResponse> {
    const response = await api.post<ClientPaymentInitResponse>(
      '/client/payments/init',
      { invoiceId, method },
    );
    return response.data;
  },

  async uploadBankTransfer(
    invoiceId: string,
    amount: number,
    asset: ReceiptUploadAsset,
  ): Promise<ClientBankTransferUploadResponse> {
    const metadata = getReceiptUploadMetadata(asset);
    const formData = new FormData();
    formData.append('invoiceId', invoiceId);
    formData.append('amount', String(amount));
    formData.append('receipt', {
      uri: asset.uri,
      type: metadata.type,
      name: metadata.name,
    } as unknown as Blob);

    const response = await api.post<ClientBankTransferUploadResponse>(
      '/client/payments/bank-transfer',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
