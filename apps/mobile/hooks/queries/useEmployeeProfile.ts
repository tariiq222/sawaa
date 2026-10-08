import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { setUser } from '@/stores/slices/auth-slice';
import { getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';
import { employeeProfileService, type AvatarUpload, type ContactRequest, type ContactVerification, type EmployeeProfileUpdate, type EmployeeSelfProfile } from '@/services/employee/profile';

export const employeeProfileKeys = { all: ['employee-profile'] as const, detail: (id?: string, epoch?: number) => ['employee-profile', id, epoch] as const };
export function useEmployeeProfile() {
  const id = useAppSelector(s => s.auth.user?.id);
  const epoch = getSessionEpoch();
  return useQuery({ queryKey: employeeProfileKeys.detail(id, epoch), queryFn: async () => {
    const profile = await employeeProfileService.get();
    if (!isSessionCurrent(epoch)) throw new Error('Session changed');
    return profile;
  }, enabled: Boolean(id), retry: false, meta: { silentError: true } });
}
function useProfileWrite<T>(write: (input: T) => Promise<EmployeeSelfProfile>) {
  const client = useQueryClient();
  const dispatch = useAppDispatch();
  const user = useAppSelector(s => s.auth.user);
  const ownerId = user?.id;
  const ownerEpoch = getSessionEpoch();
  const currentUser = useRef(user);
  currentUser.current = user;
  const mutation = useMutation({ mutationFn: async ({ input, epoch, userId }: { input: T; epoch: number; userId: string }) => {
    if (!isSessionCurrent(epoch) || currentUser.current?.id !== userId) throw new Error('Session changed');
    const profile = await write(input);
    if (!isSessionCurrent(epoch) || currentUser.current?.id !== userId) throw new Error('Session changed');
    return profile;
  }, retry: false, gcTime: 0, onError: () => undefined,
  onSuccess: async (profile, { epoch, userId }) => {
    const account = currentUser.current;
    if (!isSessionCurrent(epoch) || account?.id !== userId) return;
    client.setQueryData(employeeProfileKeys.detail(userId, epoch), profile);
    dispatch(setUser({ ...account, email: profile.email, phone: profile.phone, avatarUrl: profile.avatarUrl }));
    await Promise.all([
      client.invalidateQueries({ queryKey: ['me'] }),
      client.invalidateQueries({ queryKey: ['therapists'] }),
    ]);
  } });
  const run = mutation.mutateAsync;
  const mutateAsync = useCallback(async (input: T) => {
    if (!ownerId || !isSessionCurrent(ownerEpoch) || currentUser.current?.id !== ownerId) throw new Error('Session changed');
    const profile = await run({ input, epoch: ownerEpoch, userId: ownerId });
    if (!isSessionCurrent(ownerEpoch) || currentUser.current?.id !== ownerId) throw new Error('Session changed');
    return profile;
  }, [run, ownerId, ownerEpoch]);
  return { ...mutation, mutateAsync };
}
export const useUpdateEmployeeProfile = () => useProfileWrite<EmployeeProfileUpdate>(employeeProfileService.update);
export const useUploadEmployeeAvatar = () => useProfileWrite<AvatarUpload>(employeeProfileService.uploadAvatar);
export const useRemoveEmployeeAvatar = () => useProfileWrite<void>(employeeProfileService.removeAvatar);
export const useVerifyEmployeeContact = () => useProfileWrite<ContactVerification>(employeeProfileService.verifyContact);
export function useRequestEmployeeContact() {
  const ownerId = useAppSelector(s => s.auth.user?.id);
  const ownerEpoch = getSessionEpoch();
  const currentId = useRef(ownerId);
  currentId.current = ownerId;
  const mutation = useMutation({ mutationFn: async ({ input, epoch, userId }: { input: ContactRequest; epoch: number; userId: string }) => {
    if (!isSessionCurrent(epoch) || currentId.current !== userId) throw new Error('Session changed');
    const result = await employeeProfileService.requestContact(input);
    if (!isSessionCurrent(epoch) || currentId.current !== userId) throw new Error('Session changed');
    return result;
  }, retry: false, gcTime: 0, onError: () => undefined });
  const run = mutation.mutateAsync;
  const mutateAsync = useCallback(async (input: ContactRequest) => {
    if (!ownerId || !isSessionCurrent(ownerEpoch) || currentId.current !== ownerId) throw new Error('Session changed');
    const result = await run({ input, epoch: ownerEpoch, userId: ownerId });
    if (!isSessionCurrent(ownerEpoch) || currentId.current !== ownerId) throw new Error('Session changed');
    return result;
  }, [run, ownerId, ownerEpoch]);
  return { ...mutation, mutateAsync };
}
