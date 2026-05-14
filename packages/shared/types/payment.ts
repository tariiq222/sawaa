import type { PaymentMethod, PaymentStatus, TransferVerificationStatus } from '../enums/payment';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  moyasarPaymentId: string | null;
  transactionRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransferReceipt {
  id: string;
  paymentId: string;
  receiptUrl: string;
  aiVerificationStatus: TransferVerificationStatus;
  aiConfidence: number | null;
  aiNotes: string | null;
  extractedAmount: number | null;
  extractedDate: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  paymentId: string;
  invoiceNumber: string;
  pdfUrl: string | null;
  sentAt: string | null;
  vatAmount: number;
  vatRate: number;
  invoiceHash: string | null;
  qrCodeData: string | null;
  xmlContent: string | null;
  createdAt: string;
}
