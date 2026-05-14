import api from './api';
import type { ApiResponse } from '@/types/api';
import type { Payment, BankTransferReceipt } from '@/types/models';

interface CreateMoyasarPaymentData {
  bookingId: string;
  source: Record<string, unknown>;
}

interface MoyasarPaymentResponse {
  payment: Payment;
  redirectUrl: string | null;
}

interface BankTransferResponse {
  payment: Payment;
  receipt: BankTransferReceipt;
}

interface GetPaymentsParams {
  page?: number;
  limit?: number;
  status?: string;
  method?: string;
}

export const paymentsService = {
  async createMoyasarPayment(data: CreateMoyasarPaymentData) {
    const response = await api.post<ApiResponse<MoyasarPaymentResponse>>(
      '/payments/moyasar',
      data,
    );
    return response.data;
  },

  async uploadBankTransferReceipt(bookingId: string, imageUri: string) {
    const formData = new FormData();
    formData.append('bookingId', bookingId);
    formData.append('receipt', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'receipt.jpg',
    } as unknown as Blob);

    const response = await api.post<ApiResponse<BankTransferResponse>>(
      '/payments/bank-transfer',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  async getMyPayments(params?: GetPaymentsParams) {
    const response = await api.get<ApiResponse<Payment[]>>(
      '/payments/my',
      { params },
    );
    return response.data;
  },

  async getPaymentByBooking(bookingId: string) {
    const response = await api.get<ApiResponse<Payment>>(
      `/payments/booking/${bookingId}`,
    );
    return response.data;
  },
};
