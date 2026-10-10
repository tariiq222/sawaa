import React, { useState } from 'react';
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
  /** Called after the remote image fails; the thumbnail handles its own placeholder. */
  onError?: () => void;
}

/** Image slot for therapists and clinics: photo when there is one, tinted glyph when not. */
export function Thumb(props: ThumbProps) {
  // Each URI owns its load state; late errors from an unmounted photo cannot
  // alter a newer photo, including when the same URI is visited again.
  return <ThumbContent key={props.uri} {...props} />;
}

function ThumbContent({ uri, width, height, radius = sawaaRadius.md, icon: Icon = User, accessibilityLabel, onError }: ThumbProps) {
  const colors = useSawaaColors();
  const [failed, setFailed] = useState(false);
  const box = { width, height, borderRadius: radius };
  if (uri && !failed) {
    return (
      <Image
        key={uri}
        source={{ uri }}
        resizeMode="cover"
        onError={() => { setFailed(true); onError?.(); }}
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
