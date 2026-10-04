import React from 'react';
import { View, Text, Image } from 'react-native';
import { withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface AvatarProps {
  size?: number;
  name: string;
  imageUrl?: string | null;
  color?: string;
}

export function Avatar({
  size = 48,
  name,
  imageUrl,
  color: colorOverride,
}: AvatarProps) {
  const colors = useSawaaColors();
  const color = colorOverride ?? colors.teal[700];
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.glass.opaqueBg,
        }}
      />
    );
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: withAlpha(color, 0.094),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color,
          fontSize: size * 0.35,
          fontWeight: '700',
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
