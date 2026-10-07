import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '@/hooks/use-redux';
import { clientProfileService, type ClientProfile, type ClientProfileUpdate } from '@/services/client';
import { getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';

export const clientProfileKeys = {
  all: ['client-profile'] as const,
  detail: (clientId?: string) => [...clientProfileKeys.all, clientId] as const,
};

export function useClientProfile() {
  const clientId = useAppSelector((state) => state.auth.user?.id);
  return useQuery({
    queryKey: clientProfileKeys.detail(clientId),
    queryFn: () => clientProfileService.getProfile(),
    enabled: Boolean(clientId),
  });
}

/** Client responses are not auth Users; screens retain their Redux mapping. */
export function useUpdateClientProfile() {
  const queryClient = useQueryClient();
  const clientId = useAppSelector((state) => state.auth.user?.id);
  const mutation = useMutation<ClientProfile, Error, { body: ClientProfileUpdate; epoch: number }>({
    mutationFn: async ({ body, epoch }) => {
      if (!isSessionCurrent(epoch)) throw new Error('Session changed during profile update');
      const profile = await clientProfileService.updateProfile(body);
      if (!isSessionCurrent(epoch)) throw new Error('Session changed during profile update');
      return profile;
    },
    retry: false,
    // The profile form localizes errors; locale synchronization remains quiet.
    onError: () => undefined,
    onSuccess: async (profile, { epoch }) => {
      if (!isSessionCurrent(epoch)) return;
      queryClient.setQueryData(clientProfileKeys.detail(clientId), profile);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me'] }),
        queryClient.invalidateQueries({ queryKey: ['portal'] }),
      ]);
    },
  });
  const { mutateAsync: runAsync, mutate: run } = mutation;
  const mutateAsync = useCallback(async (body: ClientProfileUpdate) => {
    const epoch = getSessionEpoch();
    const profile = await runAsync({ body, epoch });
    if (!isSessionCurrent(epoch)) throw new Error('Session changed during profile update');
    return profile;
  }, [runAsync]);
  const mutate = useCallback((body: ClientProfileUpdate) => run({ body, epoch: getSessionEpoch() }), [run]);
  return { ...mutation, mutateAsync, mutate };
}
