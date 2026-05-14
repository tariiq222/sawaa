import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { VideoCallScreen } from '@/components/features/VideoCallScreen';
import { FEATURE_FLAGS } from '@/constants/feature-flags';

/**
 * Client Video Call Screen
 * Route: /(client)/video-call?bookingId=xxx
 */
export default function ClientVideoCallScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!FEATURE_FLAGS.videoCalls) {
      router.replace('/(client)/(tabs)/home');
    }
  }, [router]);

  if (!FEATURE_FLAGS.videoCalls) return null;
  return <VideoCallScreen role="client" />;
}
