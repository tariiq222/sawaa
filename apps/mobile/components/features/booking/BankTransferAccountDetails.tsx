import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { BankTransferAccount } from '@sawaa/shared';

import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

interface BankTransferAccountDetailsProps {
  accounts: BankTransferAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (id: string) => void;
  amountLabel: string;
}

export function BankTransferAccountDetails({
  accounts,
  selectedAccountId,
  onSelectAccount,
  amountLabel,
}: BankTransferAccountDetailsProps) {
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const dir = useDir();
  const f500 = getFontName(dir.locale, '500');
  const f700 = getFontName(dir.locale, '700');
  const styles = useMemo(() => createStyles(colors), [colors]);
  const selected = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  if (!selected) return null;

  const details = [
    { key: 'label', label: t('payment.bankAccountLabel'), value: selected.label },
    { key: 'bank', label: t('payment.bankName'), value: selected.bankName },
    { key: 'beneficiary', label: t('payment.accountHolder'), value: selected.beneficiaryName },
    { key: 'iban', label: t('payment.iban'), value: selected.iban },
    { key: 'amount', label: t('payment.transferAmount'), value: amountLabel },
  ];

  return (
    <View style={styles.container}>
      {accounts.length > 1 ? (
        <View style={[styles.accountPicker, { flexDirection: dir.row }]}>
          {accounts.map((account) => (
            <Pressable
              key={account.id}
              onPress={() => onSelectAccount(account.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: selected.id === account.id }}
            >
              <Glass
                variant={selected.id === account.id ? 'strong' : 'regular'}
                radius={sawaaRadius.pill}
                style={styles.accountChip}
              >
                <Text style={[styles.accountChipText, { fontFamily: f500 }]}>{account.label}</Text>
              </Glass>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
        {details.map((detail, index) => (
          <View
            key={detail.key}
            style={[styles.row, { flexDirection: dir.row }, index < details.length - 1 && styles.rowDivider]}
          >
            <View style={styles.rowMid}>
              <Text style={[styles.rowLabel, { fontFamily: f500, textAlign: dir.textAlign }]}>
                {detail.label}
              </Text>
              <Text style={[styles.rowValue, { fontFamily: f700, textAlign: dir.textAlign }]}>
                {detail.value}
              </Text>
            </View>
          </View>
        ))}
      </Glass>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { gap: sawaaSpacing.md },
  accountPicker: { flexWrap: 'wrap', gap: sawaaSpacing.sm },
  accountChip: { paddingHorizontal: sawaaSpacing.md, paddingVertical: sawaaSpacing.sm, borderRadius: sawaaRadius.pill },
  accountChipText: { color: colors.ink[700], fontSize: sawaaType.caption.fontSize, textAlign: 'center' },
  card: { padding: sawaaSpacing.md, borderRadius: sawaaRadius.xl },
  row: { padding: sawaaSpacing.lg, alignItems: 'center', gap: sawaaSpacing.md },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glass.border },
  rowMid: { flex: 1 },
  rowLabel: { fontSize: sawaaType.micro.fontSize, lineHeight: sawaaType.micro.lineHeight, color: colors.ink[500] },
  rowValue: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[900], marginTop: sawaaSpacing.xs, fontVariant: ['tabular-nums'], textAlign: 'right' },
});
