import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useSawaaColors } from './useSawaaColors';

/** Shared NativeTabs colours: muted ink for idle icons, brand teal when selected. */
export function useTabBarStyle() {
  const dir = useDir();
  const colors = useSawaaColors();
  return {
    labelStyle: { fontFamily: getFontName(dir.locale, '500') },
    tintColor: colors.teal[600],
    iconColor: { default: colors.ink[700], selected: colors.teal[600] },
  } as const;
}
