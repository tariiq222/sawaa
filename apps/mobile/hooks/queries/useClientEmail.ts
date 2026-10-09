import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';
import { clientEmailService } from '@/services/client-email';
import { clientProfileKeys } from './useClientProfile';

export const clientEmailKeys = {
  status: ['client', 'email-status'] as const,
};

/** The email endpoints are client-only; guests and staff never fetch them. */
function useIsClientSession(): boolean {
  const { token, user } = useAppSelector((state) => state.auth);
  return Boolean(token && user && getPrimaryRole(user) === 'client');
}

export function useClientEmailStatus() {
  const enabled = useIsClientSession();
  return useQuery({
    queryKey: clientEmailKeys.status,
    queryFn: () => clientEmailService.getStatus(),
    enabled,
  });
}

function useInvalidateClientEmail() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: clientEmailKeys.status }),
    queryClient.invalidateQueries({ queryKey: clientProfileKeys.all }),
  ]);
}

/** Challenge responses stay in screen memory; only the status is cached. */
export function useRequestClientEmail() {
  const invalidate = useInvalidateClientEmail();
  return useMutation({
    mutationFn: (body: { email: string }) => clientEmailService.request(body),
    onSuccess: async () => { await invalidate(); },
  });
}

export function useVerifyClientEmail() {
  const invalidate = useInvalidateClientEmail();
  return useMutation({
    mutationFn: (body: { challengeId: string; code: string }) => clientEmailService.verify(body),
    onSuccess: async () => { await invalidate(); },
  });
}

export function useDeclineClientEmail() {
  const invalidate = useInvalidateClientEmail();
  return useMutation({
    mutationFn: () => clientEmailService.decline(),
    onSuccess: async () => { await invalidate(); },
  });
}
