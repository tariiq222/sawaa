import { useMutation } from '@tanstack/react-query';
import * as auth from '@/services/auth';

export const useRegister = () => useMutation({ mutationFn: auth.registerUser });
export const useRequestLoginOtp = () => useMutation({ mutationFn: auth.requestLoginOtp });
export const useVerifyOtp = () => useMutation({ mutationFn: auth.verifyMobileOtp });
export const useRequestEmailVerification = () => useMutation({ mutationFn: auth.requestEmailVerification });
