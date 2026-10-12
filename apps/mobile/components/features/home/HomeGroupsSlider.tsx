import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import { DateBox } from '@/components/ui/DateBox';
import { Pill } from '@/components/ui/Pill';
import { Thumb } from '@/components/ui/Thumb';
import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { DirState } from '@/hooks/useDir';
import { useGroupSessions } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { formatHalalasPrice, formatTimeOfDay } from '@/lib/session-format';

interface HomeGroupsSliderProps { dir: DirState; f400: string; f700: string }

const CARD_W = 224;
const TILE = 44;

/**
 * Horizontal slider of every support group. Same card shape as the packages
 * slider: date (or a people tile while the date is unknown) + two-line name on
 * top, time and price in the middle and the seats pill at the bottom.
 */
export function HomeGroupsSlider({ dir, f400, f700 }: HomeGroupsSliderProps) {
  const colors = useSawaaColors();
  const router = useRouter();
  const { t } = useTranslation();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const groups = useGroupSessions().data ?? [];
  if (groups.length === 0) return null;
  return (
    <LocalizedHorizontalScroll dir={dir} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.list, { flexDirection: dir.row }]}>
      {groups.map((group) => {
        const name = dir.isRTL ? group.nameAr : group.nameEn ?? group.nameAr;
        const description = (dir.isRTL ? group.publicDescriptionAr ?? group.descriptionAr : group.publicDescriptionEn ?? group.descriptionEn ?? group.publicDescriptionAr ?? group.descriptionAr)?.trim();
        const time = formatTimeOfDay(group.scheduledAt, dir.isRTL);
        const when = time ?? t('groups.dateTba');
        const price = formatHalalasPrice(group.price, dir.isRTL, t('home.sar'));
        return (
          <Glass
            key={group.id}
            variant="strong"
            radius={sawaaRadius.lg}
            accessibilityRole="button"
            accessibilityLabel={name}
            onPress={() => router.push(signedIn
              ? { pathname: '/(client)/groups/[id]', params: { id: group.id } }
              : { pathname: '/public-detail/[kind]/[id]', params: { kind: 'program', id: group.id } })}
            style={styles.card}
          >
            <View style={[styles.top, { flexDirection: dir.row }]}>
              {group.scheduledAt
                ? <DateBox iso={group.scheduledAt} fallback={t('groups.dateTba')} />
                : <Thumb uri={null} width={TILE} height={TILE} radius={sawaaRadius.md} icon={Users} />}
              <Text numberOfLines={2} style={[styles.name, { fontFamily: f700, color: colors.ink[900], textAlign: dir.textAlign }]}>{name}</Text>
            </View>
            {description ? (
              <Text numberOfLines={2} style={[styles.description, { fontFamily: f400, color: colors.ink[700], textAlign: dir.textAlign }]}>{description}</Text>
            ) : null}
            <View>
              <Text style={[styles.caption, { fontFamily: f400, color: colors.ink[500], textAlign: dir.textAlign }]}>{when}</Text>
              <Text style={[styles.price, { fontFamily: f700, color: colors.teal[700], textAlign: dir.textAlign }]}>{price}</Text>
            </View>
            <View style={{ alignSelf: dir.isRTL ? 'flex-end' : 'flex-start' }}>
              <Pill tone={group.isFull ? 'muted' : 'brand'} label={group.isFull ? t('groups.full') : t('groups.spotsLeft', { count: group.spotsLeft })} />
            </View>
          </Glass>
        );
      })}
    </LocalizedHorizontalScroll>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingHorizontal: 2 },
  card: { width: CARD_W, minHeight: 200, padding: sawaaSpacing.md, gap: sawaaSpacing.sm, justifyContent: 'space-between' },
  top: { alignItems: 'center', gap: sawaaSpacing.sm },
  name: { flex: 1, minWidth: 0, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  description: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
  caption: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
  price: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
});
