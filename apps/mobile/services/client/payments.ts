import api from '../api';
import type { Payment } from '@/types/models';

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
    imageUri: string,
  ): Promise<ClientBankTransferUploadResponse> {
    const formData = new FormData();
    formData.append('invoiceId', invoiceId);
    formData.append('amount', String(amount));
    formData.append('receipt', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'receipt.jpg',
    } as unknown as Blob);

    const response = await api.post<ClientBankTransferUploadResponse>(
      '/mobile/client/payments/bank-transfer',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
