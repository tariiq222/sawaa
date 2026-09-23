import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';
import { clientProfileService } from '@/services/client/profile';
import { updatePushPreference } from '@/services/push-preference';

export function usePushPreference() {
  const { token, user } = useAppSelector((state) => state.auth);
  const clientId = token && user && getPrimaryRole(user) === 'client' ? user.id : null;
  const queryClient = useQueryClient();
  const queryKey = ['push-preference', clientId];
  const query = useQuery({
    queryKey,
    enabled: !!clientId,
    queryFn: async () => {
      const profile = await clientProfileService.getProfile();
      const permission = await Notifications.getPermissionsAsync();
      return { enabled: profile.pushEnabled, permitted: permission.granted };
    },
  });
  const mutation = useMutation({
    mutationFn: updatePushPreference,
    onSuccess: (_, enabled) => {
      queryClient.setQueryData(queryKey, { enabled, permitted: enabled });
    },
  });
  return { clientId, query, mutation };
}
