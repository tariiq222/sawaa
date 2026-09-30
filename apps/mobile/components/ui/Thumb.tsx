import React from 'react';
import { DimensionValue, Image, StyleSheet, View } from 'react-native';
import { User, type LucideIcon } from 'lucide-react-native';

import { sawaaRadius } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface ThumbProps {
  /** Public image URL (practitioner photo, clinic image). Falls back to a tinted placeholder. */
  uri?: string | null;
  width: DimensionValue;
  height: DimensionValue;
  radius?: number;
  /** Placeholder glyph when there is no image. Defaults to a person. */
  icon?: LucideIcon;
  /** Describes the image for screen readers; omit for purely decorative thumbs. */
  accessibilityLabel?: string;
  /** Called when the remote image fails to load, so the caller can fall back to the placeholder. */
  onError?: () => void;
}

/** Image slot for therapists and clinics: photo when there is one, tinted glyph when not. */
export function Thumb({ uri, width, height, radius = sawaaRadius.md, icon: Icon = User, accessibilityLabel, onError }: ThumbProps) {
  const colors = useSawaaColors();
  const box = { width, height, borderRadius: radius };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        resizeMode="cover"
        onError={onError}
        accessibilityLabel={accessibilityLabel}
        accessible={Boolean(accessibilityLabel)}
        style={[styles.image, box, { backgroundColor: colors.teal[100] }]}
      />
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.placeholder, box, { backgroundColor: colors.teal[100] }]}
    >
      <Icon size={28} color={colors.teal[700]} strokeWidth={1.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { overflow: 'hidden', flexShrink: 0 },
  placeholder: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
