import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Leaves the current screen when it may have been opened with no history entry:
 * a deep link, a notification tap, or a guard redirect that replaced the route.
 * `router.back()` alone is a no-op there, which strands the user on the screen.
 * Falling back to the public home always leaves a reachable next step, for
 * guests and signed-in clients alike (it is outside the role guards).
 */
export function goBackOrHome(router: Router): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/home');
}
