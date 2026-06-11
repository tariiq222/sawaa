import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { useGroupSessions } from '@/hooks/queries';
import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { concentricRadius } from '@/theme/sawaa/tokens';
import { Glass } from '@/theme/components/Glass';
import type { DirState } from '@/hooks/useDir';

const ACCENTS = [sawaaColors.accent.violet, sawaaColors.accent.rose, sawaaColors.teal[500]];
const CARD_RADIUS = sawaaRadius.xl;
const CARD_PADDING = 12;

interface SupportSessionsProps {
  dir: DirState;
  f400: string;
  f700: string;
}

export function SupportSessions({ dir, f400, f700 }: SupportSessionsProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const groupsQuery = useGroupSessions();
  const sessions = useMemo(() => {
    const now = Date.now();
    return (groupsQuery.data ?? [])
      .filter((s) => new Date(s.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 3);
  }, [groupsQuery.data]);

  if (sessions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
    >
      {sessions.map((s, i) => {
        const color = ACCENTS[i % ACCENTS.length];
        return (
        <Glass key={s.id} variant="strong" radius={CARD_RADIUS} style={styles.supportCard}>
          <View style={[styles.supportInner, { flexDirection: dir.row }]}> 
            <View style={[styles.supportIcon, { backgroundColor: `${color}22` }]}> 
              <AppIcon sf="person.3.fill" fallback={Users} size={18} color={color} strokeWidth={1.75} />
            </View>
            <View style={styles.supportText}>
              <Text numberOfLines={1} style={[styles.supportTitle, { fontFamily: f700, textAlign: dir.textAlign }]}> 
                {s.title}
              </Text>
              <Text numberOfLines={1} style={[styles.supportMeta, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}> 
                {new Intl.DateTimeFormat(dir.isRTL ? 'ar-SA' : 'en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  ...(dir.isRTL ? { calendar: 'gregory' } : {}),
                }).format(new Date(s.scheduledAt))}
              </Text>
            </View>
            <Pressable onPress={() => router.push(`/(client)/groups/${s.id}`)} style={styles.supportCta} accessibilityRole="button">
              <Text style={[styles.supportCtaText, { fontFamily: f700 }]}> 
                {t('groups.join')}
              </Text>
            </Pressable>
          </View>
        </Glass>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  supportCard: { width: 280 },
  supportInner: { padding: 12, gap: 10, alignItems: 'center' },
  supportIcon: { width: 36, height: 36, borderRadius: concentricRadius(CARD_RADIUS, CARD_PADDING), alignItems: 'center', justifyContent: 'center' },
  supportText: { flex: 1, gap: 2 },
  supportTitle: { fontSize: 13, color: sawaaColors.ink[900], lineHeight: 18 },
  supportMeta: { fontSize: 11, color: sawaaColors.ink[500] },
  supportCta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: sawaaColors.teal[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCtaText: { color: sawaaColors.teal[50], fontSize: 12 },
});
