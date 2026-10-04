"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { BankTransferAccount } from "@sawaa/shared"
import { isValidSaudiIban } from "@sawaa/shared"
import { Button, Card, CardContent, Input, Label, Skeleton, Switch } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { toastApiError } from "@/lib/mutation-helpers"
import { usePaymentSettings, usePaymentSettingsMutation } from "@/hooks/use-organization-settings"

const newAccount = (): BankTransferAccount => ({
  id: crypto.randomUUID(),
  label: "",
  bankName: "",
  beneficiaryName: "",
  iban: "",
})

function isCompleteAccount(account: BankTransferAccount): boolean {
  return Boolean(
    account.id.trim() && account.label.trim() && account.bankName.trim() &&
    account.beneficiaryName.trim() && isValidSaudiIban(account.iban),
  )
}

export function BankTransferAccountsPanel() {
  const { t } = useLocale()
  const { data, isLoading } = usePaymentSettings()
  const mutation = usePaymentSettingsMutation()
  const [enabled, setEnabled] = useState(false)
  const [accounts, setAccounts] = useState<BankTransferAccount[]>([])

  useEffect(() => {
    if (!data) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(data.paymentBankTransferEnabled ?? false)
    setAccounts(data.bankTransferAccounts ?? [])
  }, [data])

  const accountsValid = accounts.every(isCompleteAccount)
  const canEnable = accounts.length > 0 && accountsValid

  const updateAccount = (id: string, patch: Partial<BankTransferAccount>) => {
    setAccounts((current) => current.map((account) => account.id === id ? { ...account, ...patch } : account))
  }

  const save = () => {
    if (!accountsValid || (enabled && !canEnable)) return
    mutation.mutate(
      { paymentBankTransferEnabled: enabled, bankTransferAccounts: accounts },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: toastApiError(t("settings.error"), t),
      },
    )
  }

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t("settings.payment.bankTransfer.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("settings.payment.bankTransfer.description")}</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <Label htmlFor="client-bank-transfer-enabled">{t("settings.payment.bankTransfer.enabled")}</Label>
          <Switch
            id="client-bank-transfer-enabled"
            checked={enabled}
            disabled={mutation.isPending || (!canEnable && !enabled)}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-4">
          {accounts.map((account) => (
            <section key={account.id} className="space-y-3 rounded-lg border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${account.id}-label`}>{t("settings.payment.bankTransfer.label")}</Label>
                  <Input id={`${account.id}-label`} value={account.label} onChange={(event) => updateAccount(account.id, { label: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${account.id}-bank`}>{t("settings.payment.bankTransfer.bankName")}</Label>
                  <Input id={`${account.id}-bank`} value={account.bankName} onChange={(event) => updateAccount(account.id, { bankName: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${account.id}-beneficiary`}>{t("settings.payment.bankTransfer.beneficiaryName")}</Label>
                  <Input id={`${account.id}-beneficiary`} value={account.beneficiaryName} onChange={(event) => updateAccount(account.id, { beneficiaryName: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${account.id}-iban`}>{t("settings.payment.bankTransfer.iban")}</Label>
                  <Input id={`${account.id}-iban`} value={account.iban} onChange={(event) => updateAccount(account.id, { iban: event.target.value })} dir="ltr" autoCapitalize="characters" />
                  {account.iban && !isValidSaudiIban(account.iban) ? (
                    <p className="text-xs text-destructive">{t("settings.payment.bankTransfer.invalidIban")}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAccounts((current) => current.filter((item) => item.id !== account.id))}
                >
                  {t("settings.payment.bankTransfer.removeAccount")}
                </Button>
              </div>
            </section>
          ))}
          {(!accountsValid || (enabled && !canEnable)) ? (
            <p role="alert" className="text-sm text-destructive">{t("settings.payment.bankTransfer.required")}</p>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setAccounts((current) => [...current, newAccount()])}>
            {t("settings.payment.bankTransfer.addAccount")}
          </Button>
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button disabled={mutation.isPending || !accountsValid || (enabled && !canEnable)} onClick={save}>
            {t("settings.payment.bankTransfer.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
