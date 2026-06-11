import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import type { DirState } from '@/hooks/useDir';

const SESSIONS = [
  {
    titleAr: 'جلسة جماعية: القلق الاجتماعي',
    titleEn: 'Group: Social anxiety',
    metaAr: 'اليوم · ٨:٠٠ مساءً · د. مي',
    metaEn: 'Today · 8:00 PM · Dr. May',
    color: sawaaColors.accent.violet,
  },
  {
    titleAr: 'مجموعة دعم الاكتئاب',
    titleEn: 'Depression support',
    metaAr: 'الثلاثاء · ٧:٣٠ مساءً',
    metaEn: 'Tue · 7:30 PM',
    color: sawaaColors.accent.rose,
  },
  {
    titleAr: 'التأمل الجماعي',
    titleEn: 'Group meditation',
    metaAr: 'السبت · ٦:٠٠ مساءً',
    metaEn: 'Sat · 6:00 PM',
    color: sawaaColors.teal[500],
  },
];

interface SupportSessionsProps {
  dir: DirState;
  f400: string;
  f700: string;
}

export function SupportSessions({ dir, f400, f700 }: SupportSessionsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
    >
      {SESSIONS.map((s, i) => (
        <Glass key={`session-${i}`} variant="strong" radius={sawaaRadius.xl} style={styles.supportCard}>
          <View style={[styles.supportInner, { flexDirection: dir.row }]}>
            <View style={[styles.supportIcon, { backgroundColor: `${s.color}22` }]}>
              <AppIcon sf="person.3.fill" fallback={Users} size={18} color={s.color} strokeWidth={1.75} />
            </View>
            <View style={styles.supportText}>
              <Text numberOfLines={1} style={[styles.supportTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
                {dir.isRTL ? s.titleAr : s.titleEn}
              </Text>
              <Text numberOfLines={1} style={[styles.supportMeta, { fontFamily: f400, textAlign: dir.textAlign }]}>
                {dir.isRTL ? s.metaAr : s.metaEn}
              </Text>
            </View>
            <Pressable style={styles.supportCta}>
              <Text style={[styles.supportCtaText, { fontFamily: f700 }]}>
                {dir.isRTL ? 'انضم' : 'Join'}
              </Text>
            </Pressable>
          </View>
        </Glass>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  supportCard: { width: 280 },
  supportInner: { padding: 12, gap: 10, alignItems: 'center' },
  supportIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
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
  supportCtaText: { color: '#fff', fontSize: 12 },
});
