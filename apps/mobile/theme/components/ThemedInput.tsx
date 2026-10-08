import React from 'react';
import { TextInputProps, View, ViewStyle } from 'react-native';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
interface ThemedInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  labelAr?: string;
  placeholderAr?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  style?: ViewStyle;
  suffixIcon?: React.ReactNode;
  onSuffixPress?: () => void;
}
/** Unconsumed legacy adapter retained for API compatibility; LabeledInput owns fields. */
export function ThemedInput({ label, labelAr, placeholder, placeholderAr, style, ...props }: ThemedInputProps) {
  const dir = useDir();
  return <View style={style}><LabeledInput {...props} dir={dir}
    label={(dir.isRTL ? labelAr ?? label : label) ?? ''}
    placeholder={dir.isRTL ? placeholderAr ?? placeholder : placeholder} /></View>;
}
