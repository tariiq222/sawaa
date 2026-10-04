import { useDir } from '@/hooks/useDir';

/**
 * The native layout stays LTR (see app/_layout.tsx), so iOS would keep the
 * swipe-back edge on the left while Arabic screens draw the back button on the
 * right. Mirror the stack in Arabic: screens enter from the left and swipe-back
 * starts at the right edge, next to the button.
 */
export function useStackDirectionOptions() {
  const { isRTL } = useDir();
  return isRTL
    ? ({ animation: 'slide_from_left', animationMatchesGesture: true } as const)
    : ({ animation: 'slide_from_right' } as const);
}
