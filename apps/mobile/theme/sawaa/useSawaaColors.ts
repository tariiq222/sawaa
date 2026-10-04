import { useTheme } from '../useTheme';
import { getSawaaColors, type SawaaColors } from './tokens';

/** React appearance subscription; pure token modules never import this hook. */
export function useSawaaColors(): SawaaColors {
  const { scheme } = useTheme();
  return getSawaaColors(scheme);
}
