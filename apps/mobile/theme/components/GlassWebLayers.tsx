import { View, type ViewStyle } from 'react-native';

import { getGlassEffects, type GlassCfg } from '../sawaa/tokens';

export function GlassWebLayers({
  cfg,
  radius,
  tint,
  pressed,
  isDark,
  reduceMotion,
}: {
  cfg: GlassCfg;
  radius: number;
  tint?: string;
  pressed: boolean;
  isDark: boolean;
  reduceMotion: boolean;
}) {
  const abs = (extra: Record<string, unknown>): ViewStyle => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
    ...extra,
  } as ViewStyle);

  const baseAlpha = pressed ? cfg.baseTintAlpha + 0.05 : cfg.baseTintAlpha;
  const effects = getGlassEffects(isDark);
  const animatedPress = pressed && !reduceMotion;

  return (
    <View
      style={abs({
        borderRadius: radius,
        overflow: 'hidden',
        isolation: 'isolate',
      })}
    >
      <View style={abs({ backgroundColor: effects.tint(baseAlpha) })} />
      <View
        style={abs({
          backgroundColor: effects.tint(cfg.mainTintAlpha),
          backdropFilter: `blur(${cfg.mainBlur}px) saturate(180%)`,
          WebkitBackdropFilter: `blur(${cfg.mainBlur}px) saturate(180%)`,
        })}
      />
      {cfg.bloomAlpha > 0 ? (
        <View
          style={abs({
            left: 5,
            right: 5,
            top: 6,
            bottom: 6,
            backgroundColor: effects.tint(cfg.bloomAlpha),
            filter: 'blur(3px)',
            borderRadius: radius,
          })}
        />
      ) : null}
      <View
        style={abs({
          background: effects.pressGlow,
          opacity: animatedPress ? 1 : 0,
          transform: `scale(${animatedPress ? 1 : 0.6})`,
          transition: reduceMotion ? 'none' : 'opacity 240ms ease-out, transform 340ms cubic-bezier(0.2,0.9,0.25,1)',
          mixBlendMode: 'plus-lighter',
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          boxShadow: pressed ? effects.pressedShadow : effects.restingShadow,
          transition: reduceMotion ? 'none' : 'box-shadow 220ms ease-out',
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          top: 0,
          bottom: '60%',
          left: 0,
          right: 0,
          backgroundColor: effects.sheen,
          backgroundBlendMode: 'overlay',
          filter: 'blur(6px)',
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          boxShadow: effects.innerShadow,
          mixBlendMode: 'multiply',
          filter: 'blur(4px)',
        })}
      />
      <View
        style={abs({
          boxShadow: effects.edgeShadow,
          mixBlendMode: 'plus-lighter',
          filter: 'blur(1.5px)',
        })}
      />
      {tint ? <View style={abs({ backgroundColor: tint })} /> : null}
    </View>
  );
}
