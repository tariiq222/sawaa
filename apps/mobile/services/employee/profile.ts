import api from '../api';
export interface EmployeeSelfProfile {
  id: string; name: string; avatarUrl: string | null; bioAr: string | null; bioEn: string | null;
  experience: number | null; languages: string[]; email: string; phone: string | null;
}
export type EmployeeProfileUpdate = Pick<EmployeeSelfProfile, 'bioAr' | 'bioEn' | 'experience' | 'languages'>;
export interface ContactRequest { channel: 'EMAIL' | 'SMS'; identifier: string }
export interface ContactChallenge { challengeId: string; expiresIn: number; retryAfterSeconds: number }
export interface ContactVerification { challengeId: string; code: string }
export interface AvatarUpload { uri: string; type: string; name: string }
const path = '/mobile/employee/profile';
export const employeeProfileService = {
  get: async () => (await api.get<EmployeeSelfProfile>(path)).data,
  update: async (body: EmployeeProfileUpdate) => (await api.patch<EmployeeSelfProfile>(path, body)).data,
  removeAvatar: async () => (await api.delete<EmployeeSelfProfile>(`${path}/avatar`)).data,
  uploadAvatar: async (image: AvatarUpload) => {
    const body = new FormData();
    body.append('file', image as unknown as Blob);
    return (await api.post<EmployeeSelfProfile>(`${path}/avatar`, body, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
  requestContact: async (body: ContactRequest) => (await api.post<ContactChallenge>(`${path}/contact/request`, body)).data,
  verifyContact: async (body: ContactVerification) => (await api.post<EmployeeSelfProfile>(`${path}/contact/verify`, body)).data,
};
