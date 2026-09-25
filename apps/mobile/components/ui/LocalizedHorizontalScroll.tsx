import React, { useRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import type { DirState } from '@/hooks/useDir';

interface Props extends ScrollViewProps {
  dir: DirState;
}

/** Keep both short and overflowing carousels anchored at the locale's start. */
export function LocalizedHorizontalScroll({ dir, contentContainerStyle, onContentSizeChange, ...props }: Props) {
  const scroll = useRef<ScrollView>(null);
  return (
    <ScrollView
      {...props}
      key={dir.locale}
      ref={scroll}
      horizontal
      contentContainerStyle={[
        { flexGrow: 1, minWidth: '100%', flexDirection: dir.row },
        contentContainerStyle,
      ]}
      onContentSizeChange={(width, height) => {
        scroll.current?.scrollTo({ x: dir.isRTL ? width : 0, animated: false });
        onContentSizeChange?.(width, height);
      }}
    />
  );
}
