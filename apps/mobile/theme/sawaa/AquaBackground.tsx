import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from '../useTheme';
import { getSawaaRoles } from './tokens';

interface Props extends ViewProps {
  variant?: 'aqua' | 'dark';
  children?: React.ReactNode;
}

/** A quiet canvas keeps content readable; only the navigation dock uses glass. */
export function AquaBackground({ variant = 'aqua', style, children, ...rest }: Props) {
  const { scheme } = useTheme();
  const appearance = variant === 'dark' ? 'dark' : scheme;
  const roles = getSawaaRoles(appearance);
  return (
    <View style={[styles.root, { backgroundColor: roles.background }, style]} {...rest}>
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
