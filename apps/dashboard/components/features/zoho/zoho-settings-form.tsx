"use client"

import { useState } from "react"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import {
  useDisconnectZoho,
  useSelectZohoOrganization,
  useStartZohoConnect,
  useTestZohoConfig,
  useUpdateZohoConfig,
  useZohoStatus,
} from "@/hooks/use-zoho-invoice"
import type { ZohoDataCenter } from "@/lib/types/zoho-invoice"
import { ZohoPaymentMirrorTable } from "./zoho-payment-mirror-table"

const DCS: ZohoDataCenter[] = ["sa", "com", "eu", "in", "au", "jp", "ca"]

export function ZohoSettingsForm() {
  const { t } = useLocale()
  const status = useZohoStatus()
  const startConnect = useStartZohoConnect()
  const selectOrg = useSelectZohoOrganization()
  const disconnect = useDisconnectZoho()
  const update = useUpdateZohoConfig()
  const test = useTestZohoConfig()

  const [dc, setDc] = useState<ZohoDataCenter>("sa")
  const [orgIdInput, setOrgIdInput] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const data = status.data
  const isConnected = data?.isConfigured && data.isActive
  // Backend marks the integration row inactive when more than one Zoho org
  // matched and the user hasn't picked one yet.
  const isPendingOrgSelect = data?.isConfigured && !data.isActive

  const onConnect = async () => {
    setStatusMessage(null)
    const res = await startConnect.mutateAsync(dc)
    window.location.href = res.authUrl
  }

  const onDisconnect = async () => {
    if (!window.confirm(t("zoho.actions.disconnectConfirm"))) return
    await disconnect.mutateAsync()
    setStatusMessage(null)
  }

  const onTest = async () => {
    setStatusMessage(null)
    const result = await test.mutateAsync()
    setStatusMessage(
      result.ok
        ? t("zoho.actions.testOk")
        : t("zoho.actions.testFail").replace("{error}", result.error ?? ""),
    )
  }

  const onSelectOrg = async () => {
    if (!orgIdInput.trim()) return
    await selectOrg.mutateAsync(orgIdInput.trim())
    setOrgIdInput("")
  }

  if (status.isLoading) {
    return <p className="text-muted-foreground">{t("loading")}</p>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("zoho.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">{t("zoho.description")}</p>

          {!data?.isConfigured ? (
            <NotConnectedSection
              dc={dc}
              setDc={setDc}
              onConnect={onConnect}
              isPending={startConnect.isPending}
              t={t}
            />
          ) : isPendingOrgSelect ? (
            <PendingOrgSection
              orgIdInput={orgIdInput}
              setOrgIdInput={setOrgIdInput}
              onConfirm={onSelectOrg}
              isPending={selectOrg.isPending}
              t={t}
            />
          ) : (
            <ConnectedSection
              status={data}
              onTest={onTest}
              testing={test.isPending}
              onDisconnect={onDisconnect}
              disconnecting={disconnect.isPending}
              statusMessage={statusMessage}
              t={t}
            />
          )}
        </CardContent>
      </Card>

      {isConnected ? (
        <DefaultsCard
          initial={data?.defaults ?? { sendOnCreate: true }}
          onSave={async (input) => {
            await update.mutateAsync(input)
          }}
          saving={update.isPending}
          t={t}
        />
      ) : null}

      {isConnected ? <ZohoPaymentMirrorTable /> : null}
    </div>
  )
}

// ───────── Subcomponents ─────────

function NotConnectedSection({
  dc,
  setDc,
  onConnect,
  isPending,
  t,
}: {
  dc: ZohoDataCenter
  setDc: (v: ZohoDataCenter) => void
  onConnect: () => void
  isPending: boolean
  t: (key: string) => string
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4">
      <p className="text-sm font-medium">{t("zoho.notConnected.title")}</p>
      <p className="text-sm text-muted-foreground">{t("zoho.notConnected.body")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="zoho-dc">{t("zoho.notConnected.dcLabel")}</Label>
          <select
            id="zoho-dc"
            value={dc}
            onChange={(e) => setDc(e.target.value as ZohoDataCenter)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {DCS.map((d) => (
              <option key={d} value={d}>
                {d.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={onConnect} disabled={isPending}>
          {isPending ? t("zoho.notConnected.connecting") : t("zoho.notConnected.connect")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("zoho.notConnected.dcHint")}</p>
    </div>
  )
}

function PendingOrgSection({
  orgIdInput,
  setOrgIdInput,
  onConfirm,
  isPending,
  t,
}: {
  orgIdInput: string
  setOrgIdInput: (v: string) => void
  onConfirm: () => void
  isPending: boolean
  t: (key: string) => string
}) {
  return (
    <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
      <p className="text-sm font-medium">{t("zoho.selectOrg.title")}</p>
      <p className="text-sm text-muted-foreground">{t("zoho.selectOrg.description")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={orgIdInput}
          onChange={(e) => setOrgIdInput(e.target.value)}
          placeholder={t("zoho.selectOrg.placeholder")}
          className="max-w-xs"
        />
        <Button onClick={onConfirm} disabled={!orgIdInput.trim() || isPending}>
          {t("zoho.selectOrg.confirm")}
        </Button>
      </div>
    </div>
  )
}

function ConnectedSection({
  status,
  onTest,
  testing,
  onDisconnect,
  disconnecting,
  statusMessage,
  t,
}: {
  status: NonNullable<ReturnType<typeof useZohoStatus>["data"]>
  onTest: () => void
  testing: boolean
  onDisconnect: () => void
  disconnecting: boolean
  statusMessage: string | null
  t: (key: string) => string
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("zoho.status.org")} value={status.zohoOrganizationName ?? status.zohoOrganizationId ?? "—"} />
        <Field label={t("zoho.status.dc")} value={status.dataCenter?.toUpperCase() ?? "—"} />
      </div>

      {status.webhookUrl ? (
        <div className="space-y-1.5 rounded-md border bg-background p-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("zoho.status.webhookUrl")}
          </Label>
          <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
            {status.webhookUrl}
          </code>
          <p className="text-xs text-muted-foreground">{t("zoho.status.webhookHint")}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onTest} disabled={testing}>
          {testing ? t("zoho.actions.testing") : t("zoho.actions.test")}
        </Button>
        <Button variant="destructive" onClick={onDisconnect} disabled={disconnecting}>
          {disconnecting ? t("zoho.actions.disconnecting") : t("zoho.actions.disconnect")}
        </Button>
      </div>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function DefaultsCard({
  initial,
  onSave,
  saving,
  t,
}: {
  initial: { sendOnCreate: boolean; itemId?: string; branchId?: string; paymentTerms?: string }
  onSave: (input: { sendOnCreate: boolean; itemId?: string; branchId?: string; paymentTerms?: string }) => Promise<void>
  saving: boolean
  t: (key: string) => string
}) {
  const [sendOnCreate, setSendOnCreate] = useState(initial.sendOnCreate)
  const [itemId, setItemId] = useState(initial.itemId ?? "")
  const [branchId, setBranchId] = useState(initial.branchId ?? "")
  const [paymentTerms, setPaymentTerms] = useState(initial.paymentTerms ?? "")
  const [savedFlash, setSavedFlash] = useState(false)

  const onSubmit = async () => {
    await onSave({
      sendOnCreate,
      itemId: itemId.trim() || undefined,
      branchId: branchId.trim() || undefined,
      paymentTerms: paymentTerms.trim() || undefined,
    })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("zoho.config.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sendOnCreate}
            onChange={(e) => setSendOnCreate(e.target.checked)}
            className="h-4 w-4"
          />
          {t("zoho.config.sendOnCreate")}
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="zoho-item">{t("zoho.config.itemId")}</Label>
          <Input
            id="zoho-item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="60035000000123456"
          />
          <p className="text-xs text-muted-foreground">{t("zoho.config.itemIdHint")}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="zoho-branch">{t("zoho.config.branchId")}</Label>
          <Input
            id="zoho-branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="zoho-terms">{t("zoho.config.paymentTerms")}</Label>
          <Input
            id="zoho-terms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Due on receipt"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? t("zoho.config.saving") : t("zoho.config.save")}
          </Button>
          {savedFlash ? <span className="text-sm text-success">{t("zoho.config.saved")}</span> : null}
        </div>
      </CardContent>
    </Card>
  )
}
