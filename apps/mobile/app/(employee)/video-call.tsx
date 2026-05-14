import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { VideoCallScreen } from '@/components/features/VideoCallScreen';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

/**
 * Employee Video Call Screen
 * Route: /(employee)/video-call?bookingId=xxx
 */
export default function EmployeeVideoCallScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!FEATURE_FLAGS.videoCalls) {
      router.replace('/(employee)/(tabs)/today');
    }
  }, [router]);

  if (!FEATURE_FLAGS.videoCalls) return null;
  return <VideoCallScreen role="employee" />;
}
