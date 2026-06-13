import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { sawaaColors, sawaaSpacing, sawaaType, withAlpha } from "@/theme/sawaa/tokens";
import { Glass } from "@/theme";
import { useDir } from "@/hooks/useDir";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EASE = "cubic-bezier(0.32, 0.72, 0.15, 1)";
const DURATION = 360;

type HeaderProps = {
  avatarUrl?: string;
  greeting: string;
  subtitle: string;
  onNotificationPress?: () => void;
  hasUnreadNotifications?: boolean;
};

export const Header = ({
  avatarUrl,
  greeting,
  subtitle,
  onNotificationPress,
  hasUnreadNotifications,
}: HeaderProps) => {
  const dir = useDir();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(DURATION, "easeInEaseOut", "opacity")
      );
    }
    if (open) {
      const timeout = setTimeout(() => inputRef.current?.focus(), DURATION);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  const webTransition: Record<string, string> | null =
    Platform.OS === "web"
      ? { transition: `all ${DURATION}ms ${EASE}` }
      : null;

  const placeholder = dir.isRTL ? "ابحث عن معالج أو عيادة..." : "Search therapist or clinic…";

  return (
    <View style={s.wrap}>
      <View style={[s.topRow, { flexDirection: dir.row }]}>
        <Glass variant="strong" radius={24} style={s.avatarBubble}>
          <View style={s.avatarImageWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, { backgroundColor: sawaaColors.teal[100], alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: sawaaType.subheading.fontSize, fontWeight: '700', color: sawaaColors.teal[700] }}>
                  {greeting.charAt(0)}
                </Text>
              </View>
            )}
            <View style={s.avatarShine} pointerEvents="none" />
          </View>
        </Glass>

        <View style={[s.actions, { flexDirection: dir.row }]}>
          <View
            style={[
              s.bellWrap,
              {
                width: open ? 0 : 44,
                opacity: open ? 0 : 1,
                overflow: "hidden",
              },
              webTransition,
            ]}
          >
            <Pressable onPress={onNotificationPress}>
              <Glass variant="regular" radius={22} interactive style={s.iconBtn}>
                <Ionicons name="notifications-outline" size={20} color={sawaaColors.teal[700]} />
                {hasUnreadNotifications && <View style={s.bellDot} />}
              </Glass>
            </Pressable>
          </View>

          <Pressable
            onPress={() => !open && setOpen(true)}
            style={[
              s.pillWrap,
              open ? { flex: 1 } : { width: 44 },
              webTransition,
            ]}
          >
            {({ pressed }) => (
            <Glass
              variant="regular"
              radius={22}
              interactive={!open}
              pressed={!open && pressed}
              style={s.pill}
            >
              <View
                style={[
                  s.pillRow,
                  StyleSheet.absoluteFillObject,
                  {
                    flexDirection: dir.row,
                    justifyContent: open ? "flex-start" : "center",
                  },
                ]}
              >
                <View style={s.iconAnchor}>
                  <Ionicons name="search" size={20} color={sawaaColors.teal[700]} />
                </View>

                <TextInput
                  ref={inputRef}
                  value={q}
                  onChangeText={setQ}
                  placeholder={placeholder}
                  placeholderTextColor={sawaaColors.ink[500]}
                  editable={open}
                  style={[
                    s.input,
                    open ? { flex: 1, opacity: 1 } : { flex: 0, width: 0, minWidth: 0, opacity: 0 },
                    {
                      textAlign: dir.textAlign,
                      writingDirection: dir.writingDirection,
                    },
                    Platform.OS === "web"
                      ? ({
                          transition: `opacity 180ms ease-out ${open ? 180 : 0}ms`,
                        } as Record<string, string>)
                      : null,
                  ]}
                  pointerEvents={open ? "auto" : "none"}
                />

                <Pressable
                  onPress={() => {
                    if (!open) return;
                    setOpen(false);
                    setQ("");
                  }}
                  style={[
                    s.closeBtn,
                    open
                      ? { width: 30, opacity: 1, marginHorizontal: 4 }
                      : { width: 0, opacity: 0, marginHorizontal: 0 },
                    Platform.OS === "web"
                      ? ({
                          transition: `opacity 180ms ease-out ${open ? 220 : 0}ms, width 200ms ease-out, margin 200ms ease-out`,
                        } as Record<string, string>)
                      : null,
                  ]}
                  pointerEvents={open ? "auto" : "none"}
                >
                  <Ionicons name="close" size={16} color={sawaaColors.teal[700]} />
                </Pressable>
              </View>
            </Glass>
            )}
          </Pressable>
        </View>
      </View>

      <View style={[s.greetingBlock, { alignItems: dir.alignStart }]}>
        <View style={[s.greetingRow, { flexDirection: dir.row }]}>
          <Ionicons name="leaf" size={22} color={sawaaColors.teal[700]} />
          <Text
            style={[
              s.greeting,
              { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {greeting}
          </Text>
        </View>
        <Text
          style={[
            s.greetingSub,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: sawaaSpacing.xl,
    paddingTop: sawaaSpacing.xs,
    paddingBottom: sawaaSpacing.lg,
  },
  topRow: { alignItems: "center", gap: sawaaSpacing.md },

  avatarBubble: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: sawaaColors.teal[700],
    shadowOpacity: 0.20,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  avatarImageWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
  },
  avatar: { width: 38, height: 38 },
  avatarShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: sawaaColors.glass.bg,
  },

  actions: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: sawaaSpacing.md,
    minWidth: 0,
  },

  pillWrap: { height: 44, justifyContent: "center" },
  pill: { flex: 1, height: 44 },
  pillRow: {
    alignItems: "center",
    paddingHorizontal: sawaaSpacing.xs,
  },
  iconAnchor: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: sawaaType.body.fontSize,
    color: sawaaColors.teal[700],
    height: 40,
    paddingHorizontal: sawaaSpacing.xs,
  },
  closeBtn: {
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(sawaaColors.teal[700], 0.08),
    overflow: "hidden",
  },

  bellWrap: { height: 44, justifyContent: "center" },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: sawaaColors.accent.coral,
    borderWidth: 1.5,
    borderColor: sawaaColors.teal[50],
  },

  greetingBlock: {
    marginTop: sawaaSpacing.xl,
    paddingHorizontal: sawaaSpacing.xs,
    gap: sawaaSpacing.xs,
  },
  greetingRow: { alignItems: "center", gap: sawaaSpacing.sm },
  greeting: {
    fontSize: sawaaType.display.fontSize,
    fontWeight: sawaaType.display.weight,
    color: sawaaColors.teal[700],
    lineHeight: sawaaType.display.lineHeight,
  },
  greetingSub: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[500],
    fontWeight: sawaaType.body.weight,
  },
});
