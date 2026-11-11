import type { PublicEmployee } from '@sawaa/api-client';
import { safeImageSrc } from '@/lib/image-url';

export function therapistPortraitSrc(therapist: Pick<PublicEmployee, 'publicImageUrl' | 'gender'>): string | null {
  return safeImageSrc(therapist.publicImageUrl)
    ?? (therapist.gender === 'FEMALE' ? '/images/team/default-female.png' : null);
}
