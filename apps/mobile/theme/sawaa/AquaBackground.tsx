import React from 'react';
import { useTheme } from '../useTheme';
import { getSawaaRoles } from './tokens';
import { I18nManager, ImageBackground, StyleSheet, View, ViewProps } from 'react-native';

interface Props extends ViewProps {
  variant?: 'aqua' | 'dark';
  children?: React.ReactNode;
}

const bgSource = require('../../assets/bg-aqua.png');

/**
 * Full-screen background matching the `bg-aqua` / `bg-ocean-dark` surfaces from
 * sawaa-design/v2/styles.css. The dark variant overlays a deep teal wash for
 * the live-session screen.
 */
export function AquaBackground({ variant = 'aqua', style, children, ...rest }: Props) {
  const { scheme } = useTheme();
  const appearance = variant === 'dark' ? 'dark' : scheme;
  const roles = getSawaaRoles(appearance);
  return (
    <View style={[styles.root, { backgroundColor: roles.backdrop.base }, style]} {...rest}>
      <ImageBackground source={bgSource} resizeMode="cover" style={StyleSheet.absoluteFill} />
      {appearance === 'dark' && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: roles.backdrop.wash }]}
        />
      )}
      <View
        style={[
          styles.content,
          { direction: I18nManager.isRTL ? 'rtl' : 'ltr' },
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
