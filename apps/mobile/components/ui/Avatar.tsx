import React from 'react';
import { View, Text, Image } from 'react-native';

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
  color = '#1D4ED8',
}: AvatarProps) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#F2F4F6',
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
        backgroundColor: `${color}18`,
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
