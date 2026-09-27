import React from 'react';
import { ImageBackground, StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from '../useTheme';
import { getSawaaColors, getSawaaRoles } from './tokens';

interface Props extends ViewProps {
  variant?: 'aqua' | 'dark';
  children?: React.ReactNode;
}

const lightBgSource = require('../../assets/bg-aqua.png');
const darkBgSource = require('../../assets/bg-aqua-dark.png');

/**
 * Full-screen background matching the Sawaa aqua surfaces. The dark image
 * supplies its own palette, so it is not covered by the semantic wash layer.
 */
export function AquaBackground({ variant = 'aqua', style, children, ...rest }: Props) {
  const { scheme } = useTheme();
  const appearance = variant === 'dark' ? 'dark' : scheme;
  const roles = getSawaaRoles(appearance);
  return (
    <View style={[styles.root, { backgroundColor: roles.backdrop.base }, style]} {...rest}>
      <ImageBackground
        source={appearance === 'dark' ? darkBgSource : lightBgSource}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
      {appearance === 'light' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: getSawaaColors('light').glass.bgSoft }]} />
      ) : null}
      <View
        style={[
          styles.content,
          // useDir owns mirroring; native RTL would reverse it a second time.
          { direction: 'ltr' },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
