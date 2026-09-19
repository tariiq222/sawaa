import api from '../api';
import type { Payment } from '@/types/models';

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
  status: string;
  payments?: ClientInvoicePayment[];
}

export interface ClientInvoicePayment {
  id: string;
  status: string;
}

export interface ClientBankTransferUploadResponse {
  id: string;
}

export interface PaymentsListResponse {
  items: Payment[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export const clientPaymentsService = {
  async list(params?: { page?: number; limit?: number }) {
    const response = await api.get<PaymentsListResponse>(
      '/mobile/client/payments',
      { params },
    );
    return response.data;
  },

  async getInvoice(id: string) {
    const response = await api.get<ClientInvoice>(
      `/mobile/client/payments/invoices/${id}`,
    );
    return response.data;
  },

  async initPayment(
    invoiceId: string,
    method: ClientPaymentInitMethod,
  ): Promise<ClientPaymentInitResponse> {
    const response = await api.post<ClientPaymentInitResponse>(
      '/mobile/client/payments/init',
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
      '/mobile/client/payments/bank-transfer',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
