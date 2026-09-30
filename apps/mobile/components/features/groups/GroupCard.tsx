import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Users, Wallet } from 'lucide-react-native';

import { DateBox } from '@/components/ui/DateBox';
import { Pill } from '@/components/ui/Pill';
import { useDir } from '@/hooks/useDir';
import { formatHalalasPrice, formatTimeOfDay } from '@/lib/session-format';
import type { GroupSession } from '@/services/client/group-sessions';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { PrimaryButton, sawaaRadius } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface GroupCardProps {
  group: GroupSession;
  onOpen: () => void;
  /** Center phone from branding; used by the «تواصل معنا» action when a session is full. */
  contactPhone?: string | null;
}

/** Group-session card: date box, name, time and duration, enrolment, price and the register / contact action. */
export function GroupCard({ group, onOpen, contactPhone }: GroupCardProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const { t } = useTranslation();
  const isFull = group.isFull;
  const time = formatTimeOfDay(group.scheduledAt, dir.isRTL);
  const duration = group.durationMins ? t('groups.duration', { count: group.durationMins }) : null;
  const when = [time, duration].filter(Boolean).join(' · ');

  // A full session keeps its detail screen reachable (existing enrolment recovery); the contact
  // action dials the center when a number is configured and otherwise opens the same detail.
  const onContact = () => {
    if (contactPhone) {
      void Linking.openURL(`tel:${contactPhone}`);
      return;
    }
    onOpen();
  };

  return (
    <Glass variant="strong" radius={sawaaRadius.lg} style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={group.title}
        style={styles.body}
      >
        <View style={[styles.top, { flexDirection: dir.row }]}>
          <DateBox iso={group.scheduledAt} fallback={t('groups.dateTba')} />
          <View style={styles.titleBlock}>
            <Text numberOfLines={2} style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>
              {group.title}
            </Text>
            {when ? (
              <Text numberOfLines={1} style={[styles.meta, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>
                {when}
              </Text>
            ) : null}
          </View>
          <Pill
            tone={isFull ? 'muted' : 'brand'}
            label={isFull ? t('groups.full') : t('groups.spotsLeft', { count: group.spotsLeft })}
          />
        </View>

        <View style={[styles.stats, { flexDirection: dir.row }]}>
          <View style={[styles.stat, { flexDirection: dir.row }]}>
            <Users size={18} color={colors.teal[700]} strokeWidth={1.75} />
            <Text style={[styles.statText, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>
              {t('groups.enrolled', { count: group.enrolledCount, max: group.maxCapacity ?? group.maxParticipants })}
            </Text>
          </View>
          <View style={[styles.stat, { flexDirection: dir.row }]}>
            <Wallet size={18} color={colors.teal[700]} strokeWidth={1.75} />
            <Text style={[styles.statText, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>
              {formatHalalasPrice(group.price, dir.isRTL, t('home.sar'))}
            </Text>
          </View>
        </View>
      </Pressable>

      {isFull ? (
        <Pressable
          onPress={onContact}
          accessibilityRole="button"
          style={[styles.outline, { borderColor: colors.teal[700] }]}
        >
          <Text style={[styles.outlineText, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '700') }]}>
            {t('groups.contactUs')}
          </Text>
        </Pressable>
      ) : (
        <PrimaryButton label={t('groups.register')} onPress={onOpen} fontFamily={getFontName(dir.locale, '700')} />
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  body: { gap: 12 },
  top: { alignItems: 'center', gap: 12 },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, lineHeight: 22 },
  meta: { fontSize: 14, lineHeight: 20 },
  stats: { alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  stat: { alignItems: 'center', gap: 6 },
  statText: { fontSize: 14, lineHeight: 20 },
  outline: { minHeight: 56, borderRadius: sawaaRadius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontSize: 17 },
});
