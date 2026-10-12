import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { GroupOverview } from '@/components/features/groups/GroupOverview';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { Skeleton } from '@/components/ui/Skeleton';
import { GROUP_FLOW_STEPS, groupStepPath } from '@/features/groups/group-flow';
import { useBranding, useGroupSession } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { useDir } from '@/hooks/useDir';
import { goBackOrHome } from '@/lib/navigation';
import { getFontName } from '@/theme/fonts';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/**
 * Step 1 of the support-group flow, shared by the client route and the guest
 * public-detail route: the group overview, then continue (or contact when full).
 */
export function GroupDetailsStep({ id }: { id?: string }) {
  const colors = useSawaaColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const [footerHeight, setFooterHeight] = useState(180);
  const groupQuery = useGroupSession(id);
  const group = groupQuery.data;
  const contactPhone = useBranding().data?.contactPhone ?? null;
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');

  const onContinue = () => {
    if (!id) return;
    router.push({ pathname: groupStepPath('confirm', signedIn), params: { id } });
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: group ? footerHeight + sawaaSpacing.lg : insets.bottom + sawaaSpacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <BookingStepHeader
          step={1}
          total={GROUP_FLOW_STEPS}
          title={t('groups.title')}
          onBack={() => (signedIn ? goBackOrHome(router, '/(client)/(tabs)/home') : goBackOrHome(router))}
        />
        {groupQuery.isLoading ? (
          <Skeleton height={180} radius={sawaaRadius.xl} />
        ) : groupQuery.isError || !group ? (
          <EmptyState
            icon="cloud-offline-outline"
            tone="danger"
            title={t('groups.loadError')}
            actionLabel={t('common.retry')}
            onAction={() => { void groupQuery.refetch(); }}
          />
        ) : (
          <GroupOverview group={group} />
        )}
      </ScrollView>

      {group ? (
        <FloatingCta onHeightChange={setFooterHeight}>
          {group.isFull ? (
            <View style={styles.fullBlock}>
              <Text style={[styles.fullHint, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                {t('groups.fullContactHint')}
              </Text>
              {contactPhone ? (
                <PrimaryButton label={t('groups.contactUs')} onPress={() => { void Linking.openURL(`tel:${contactPhone}`); }} fontFamily={f700} />
              ) : null}
            </View>
          ) : (
            <PrimaryButton label={t('common.continue')} onPress={onContinue} fontFamily={f700} />
          )}
        </FloatingCta>
      ) : null}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  fullBlock: { gap: sawaaSpacing.md },
  fullHint: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
