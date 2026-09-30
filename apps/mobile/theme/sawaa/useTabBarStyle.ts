import { useSawaaColors } from './useSawaaColors';

/** Shared NativeTabs colours: muted ink for idle icons, brand teal when selected. */
export function useTabBarStyle() {
  const colors = useSawaaColors();
  return {
    tintColor: colors.teal[600],
    iconColor: { default: colors.ink[700], selected: colors.teal[600] },
  } as const;
}
