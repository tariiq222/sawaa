import { StyleSheet } from 'react-native';
import { sawaaSpacing } from '@/theme/sawaa';

export const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  loaderTitle: { marginBottom: sawaaSpacing.sm },
  loaderAction: { marginTop: sawaaSpacing.sm },
});
