import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth';

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getProfile(),
    staleTime: 5 * 60 * 1000,
  });
