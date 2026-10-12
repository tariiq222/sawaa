import { useMutation } from '@tanstack/react-query';
import * as auth from '@/services/auth';

export const useRequestEmailVerification = () => useMutation({ mutationFn: auth.requestEmailVerification });
