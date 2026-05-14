import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ThemedButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function ThemedButton({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  full,
  icon,
  style,
}: ThemedButtonProps) {
  const { theme, language } = useTheme();

  const fontFamily =
    language === 'ar'
      ? theme.typography.fontFamily.arabic
      : theme.typography.fontFamily.english;

  const paddingY: Record<ButtonSize, number> = {
    sm: 8,
    md: 12,
    lg: 14,
  };
  const paddingX: Record<ButtonSize, number> = {
    sm: 16,
    md: 22,
    lg: 28,
  };
  const fontSize: Record<ButtonSize, number> = {
    sm: 13,
    md: 14,
    lg: 16,
  };

  const isGradient = variant === 'primary' || variant === 'secondary';

  const gradientColors: Record<string, [string, string]> = {
    primary: ['#0037B0', '#1D4ED8'],
    secondary: ['#65A30D', '#84CC16'],
  };

  const flatBgColor: Record<ButtonVariant, string> = {
    primary: '#1D4ED8',
    secondary: '#84CC16',
    outline: 'transparent',
    ghost: 'transparent',
    danger: 'transparent',
  };

  const textColor: Record<ButtonVariant, string> = {
    primary: '#FFFFFF',
    secondary: '#FFFFFF',
    outline: '#1D4ED8',
    ghost: '#1D4ED8',
    danger: '#DC2626',
  };

  const content = (
    <>
      {loading && (
        <ActivityIndicator
          color={textColor[variant]}
          size="small"
          style={{ marginEnd: 8 }}
        />
      )}
      {icon && !loading && (
        <>{icon}</>
      )}
      <Text
        style={{
          color: textColor[variant],
          fontSize: fontSize[size],
          fontWeight: '600',
          fontFamily,
        }}
      >
        {children}
      </Text>
    </>
  );

  const containerStyle: ViewStyle = {
    borderRadius: size === 'sm' ? 8 : 10,
    paddingVertical: paddingY[size],
    paddingHorizontal: paddingX[size],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    opacity: disabled ? 0.5 : 1,
    width: full ? '100%' : undefined,
    ...(variant === 'outline'
      ? { borderWidth: 1.5, borderColor: '#1D4ED833' }
      : {}),
  };

  if (isGradient) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          { transform: [{ scale: pressed && !disabled ? 0.97 : 1 }] },
          full ? { width: '100%' } : {},
          style,
        ]}
      >
        <LinearGradient
          colors={gradientColors[variant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={containerStyle}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        containerStyle,
        { backgroundColor: flatBgColor[variant] },
        { transform: [{ scale: pressed && !disabled ? 0.97 : 1 }] },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}
