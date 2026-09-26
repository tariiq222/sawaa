import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface ServiceThumbnailProps {
  name: string;
  imageUrl?: string | null;
}

export function ServiceThumbnail({ name, imageUrl }: ServiceThumbnailProps) {
  const colors = useSawaaColors();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (imageUrl && imageUrl !== failedUrl) {
    return (
      <Image
        testID="service-thumbnail-image"
        source={{ uri: imageUrl }}
        onError={() => setFailedUrl(imageUrl)}
        style={styles.thumbnail}
      />
    );
  }
  return (
    <View style={[styles.thumbnail, { backgroundColor: colors.glass.opaqueBg }]}>
      <Text style={[styles.initial, { color: colors.teal[700] }]}>{name.trim().charAt(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 22, fontWeight: '700' },
});
