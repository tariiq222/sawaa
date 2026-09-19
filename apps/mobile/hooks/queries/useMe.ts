import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth';
import { getSessionEpoch } from '@/services/native-session-state';

export const useMe = () => {
  const sessionEpoch = getSessionEpoch();
  return useQuery({
    queryKey: ['me', sessionEpoch],
    queryFn: () => authService.getProfile(),
    staleTime: 5 * 60 * 1000,
  });
};
