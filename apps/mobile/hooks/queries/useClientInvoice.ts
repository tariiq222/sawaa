import { useQuery } from '@tanstack/react-query';
import { clientPaymentsService } from '@/services/client/payments';

export const clientInvoiceKeys = {
  detail: (id: string | undefined) => ['client-payments', 'invoice', id ?? '__none__'] as const,
};

/** Always refetched: what is still owed changes as payments are reserved. */
export function useClientInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: clientInvoiceKeys.detail(invoiceId),
    queryFn: () => {
      if (!invoiceId) throw new Error('Invoice id is required');
      return clientPaymentsService.getInvoice(invoiceId);
    },
    enabled: Boolean(invoiceId),
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
}
