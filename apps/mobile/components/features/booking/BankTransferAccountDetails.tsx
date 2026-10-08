import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { BankTransferAccount } from '@sawaa/shared';

import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { InfoRows } from '@/components/ui/InfoRows';
import { Landmark, Hash, UserRound, Wallet, CreditCard, Check } from 'lucide-react-native';
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const selected = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  if (!selected) return null;

  const details = [
    { icon: CreditCard, key: 'label', label: t('payment.bankAccountLabel'), value: selected.label },
    { icon: Landmark, key: 'bank', label: t('payment.bankName'), value: selected.bankName },
    { icon: UserRound, key: 'beneficiary', label: t('payment.accountHolder'), value: selected.beneficiaryName },
    { icon: Hash, key: 'iban', label: t('payment.iban'), value: selected.iban },
    { icon: Wallet, key: 'amount', label: t('payment.transferAmount'), value: amountLabel },
  ];

  return (
    <View style={styles.container}>
      {accounts.length > 1 ? (
        <View style={[styles.accountPicker, { flexDirection: dir.row }]}>
          {accounts.map((account) => (
            <Pressable
              key={account.id}
              onPress={() => onSelectAccount(account.id)}
              accessibilityRole="radio"
              accessibilityLabel={account.label}
              accessibilityState={{ selected: selected.id === account.id }}
            >
              <Glass
                variant={selected.id === account.id ? 'strong' : 'regular'}
                radius={sawaaRadius.pill}
                style={[styles.accountChip, { flexDirection: dir.row }]}
              >
                <Text style={[styles.accountChipText, { fontFamily: f500 }]}>{account.label}</Text>
                {selected.id === account.id ? <View testID="bank-account-selected-check" accessible={false}><Check size={18} color={colors.teal[700]} /></View> : null}
              </Glass>
            </Pressable>
          ))}
        </View>
      ) : null}

      <InfoRows rows={details} layout="stacked" />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { gap: sawaaSpacing.md },
  accountPicker: { flexWrap: 'wrap', gap: sawaaSpacing.sm },
  accountChip: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.sm, paddingHorizontal: sawaaSpacing.md, paddingVertical: sawaaSpacing.sm, borderRadius: sawaaRadius.pill },
  accountChipText: { color: colors.ink[700], fontSize: sawaaType.caption.fontSize, textAlign: 'center' },
});
