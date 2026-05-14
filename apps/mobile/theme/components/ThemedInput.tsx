import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { useTheme } from '../useTheme';

interface ThemedInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  labelAr?: string;
  placeholder?: string;
  placeholderAr?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  style?: ViewStyle;
  suffixIcon?: React.ReactNode;
  onSuffixPress?: () => void;
}

export function ThemedInput({
  label,
  labelAr,
  placeholder,
  placeholderAr,
  value,
  onChangeText,
  error,
  style,
  suffixIcon,
  onSuffixPress,
  secureTextEntry,
  ...rest
}: ThemedInputProps) {
  const { theme, isRTL, language } = useTheme();
  const [focused, setFocused] = useState(false);

  const fontFamily =
    language === 'ar'
      ? theme.typography.fontFamily.arabic
      : theme.typography.fontFamily.english;
  const displayLabel = isRTL ? (labelAr ?? label) : label;
  const displayPlaceholder = isRTL
    ? (placeholderAr ?? placeholder)
    : placeholder;

  return (
    <View style={[{ gap: 6 }, style]}>
      {displayLabel && (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '500',
            color: theme.colors.textSecondary,
            fontFamily,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {displayLabel}
        </Text>
      )}
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={displayPlaceholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={secureTextEntry}
          textAlign={isRTL ? 'right' : 'left'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            backgroundColor: theme.colors.surfaceHigh,
            borderWidth: 1.5,
            borderColor: error
              ? theme.colors.error
              : focused
                ? '#1D4ED866'
                : 'transparent',
            borderRadius: 10,
            paddingVertical: 13,
            paddingHorizontal: 16,
            paddingEnd: suffixIcon ? 48 : 16,
            fontSize: 14,
            fontFamily,
            color: theme.colors.textPrimary,
          }}
          {...rest}
        />
        {suffixIcon && (
          <Pressable
            onPress={onSuffixPress}
            style={{
              position: 'absolute',
              end: 14,
              padding: 4,
            }}
          >
            {suffixIcon}
          </Pressable>
        )}
      </View>
      {error && (
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.error,
            fontFamily,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
