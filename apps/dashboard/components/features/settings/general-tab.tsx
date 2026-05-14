"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { cn } from "@/lib/utils"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"

type TabId = "contact" | "regional" | "notifications" | "entity"

const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "24/03/2026 (DD/MM/YYYY)" },
  { value: "Y-m-d", label: "2026-03-24 (Y-m-d)" },
  { value: "d/m/Y", label: "24/03/2026 (d/m/Y)" },
  { value: "m/d/Y", label: "03/24/2026 (m/d/Y)" },
]

const TIMEZONE_OPTIONS = [
  { value: "Asia/Riyadh", label: "Asia/Riyadh (UTC+3)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
  { value: "Asia/Kuwait", label: "Asia/Kuwait (UTC+3)" },
  { value: "Asia/Bahrain", label: "Asia/Bahrain (UTC+3)" },
  { value: "Asia/Qatar", label: "Asia/Qatar (UTC+3)" },
  { value: "Africa/Cairo", label: "Africa/Cairo (UTC+2)" },
  { value: "Europe/London", label: "Europe/London (UTC+0)" },
  { value: "America/New_York", label: "America/New_York (UTC-5)" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul (UTC+3)" },
  { value: "Asia/Amman", label: "Asia/Amman (UTC+3)" },
  { value: "Asia/Beirut", label: "Asia/Beirut (UTC+2)" },
  { value: "Asia/Baghdad", label: "Asia/Baghdad (UTC+3)" },
]

function toPercentRate(rate: number | null | undefined): string {
  if (rate == null) return "15"
  return String(rate <= 1 ? rate * 100 : rate)
}

export function GeneralTab() {
  const { t } = useLocale()
  const { data: settings, isLoading } = useOrganizationSettings()

  const WEEK_START_OPTIONS = [
    { value: "sunday", label: t("settings.weekStart.sunday") },
    { value: "monday", label: t("settings.weekStart.monday") },
  ]

  const TIME_FORMAT_OPTIONS = [
    { value: "24h", label: t("settings.timeFormat.24h") },
    { value: "12h", label: t("settings.timeFormat.12h") },
  ]
  const updateSettings = useUpdateOrganizationSettings()

  const [activeTab, setActiveTab] = useState<TabId>("contact")

  const [organizationEmail, setClinicEmail] = useState("")
  const [organizationPhone, setClinicPhone] = useState("")
  const [organizationAddress, setClinicAddress] = useState("")
  const [weekStartDay, setWeekStartDay] = useState("sunday")
  const [dateFormat, setDateFormat] = useState("Y-m-d")
  const [timeFormat, setTimeFormat] = useState("24h")
  const [clinicTimezone, setClinicTimezone] = useState("Asia/Riyadh")
  const [defaultLanguage, setDefaultLanguage] = useState("ar")
  const [sessionDuration, setSessionDuration] = useState("60")
  const [reminderBeforeMinutes, setReminderBeforeMinutes] = useState("60")
  const [companyNameAr, setCompanyNameAr] = useState("")
  const [companyNameEn, setCompanyNameEn] = useState("")
  const [businessRegistration, setBusinessRegistration] = useState("")
  const [vatRegistrationNumber, setVatRegistrationNumber] = useState("")
  const [vatRate, setVatRate] = useState("15")
  const [sellerAddress, setSellerAddress] = useState("")
  const [organizationCity, setClinicCity] = useState("")
  const [postalCode, setPostalCode] = useState("")

  useEffect(() => {
    if (!settings) return
    // Seed editable form fields from server settings; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClinicEmail(settings.contactEmail ?? "")
    setClinicPhone(settings.contactPhone ?? "")
    setClinicAddress(settings.address ?? "")
    setWeekStartDay(settings.weekStartDay ?? "sunday")
    setDateFormat(settings.dateFormat ?? "Y-m-d")
    setTimeFormat(settings.timeFormat ?? "24h")
    setClinicTimezone(settings.timezone ?? "Asia/Riyadh")
    setDefaultLanguage(settings.defaultLanguage ?? "ar")
    setSessionDuration(String(settings.sessionDuration ?? 60))
    setReminderBeforeMinutes(String(settings.reminderBeforeMinutes ?? 60))
    setCompanyNameAr(settings.companyNameAr ?? "")
    setCompanyNameEn(settings.companyNameEn ?? "")
    setBusinessRegistration(settings.businessRegistration ?? "")
    setVatRegistrationNumber(settings.vatRegistrationNumber ?? "")
    setVatRate(toPercentRate(settings.vatRate))
    setSellerAddress(settings.sellerAddress ?? "")
    setClinicCity(settings.organizationCity ?? "")
    setPostalCode(settings.postalCode ?? "")
  }, [settings])

  const handleSaveContact = () => {
    updateSettings.mutate(
      {
        contactEmail: organizationEmail || null,
        contactPhone: organizationPhone || null,
        address: organizationAddress || null,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  const handleSaveRegional = () => {
    updateSettings.mutate(
      {
        weekStartDay,
        dateFormat,
        timeFormat,
        timezone: clinicTimezone,
        defaultLanguage,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  const handleSaveNotifications = () => {
    updateSettings.mutate(
      {
        sessionDuration: Number(sessionDuration) || 60,
        reminderBeforeMinutes: Number(reminderBeforeMinutes) || 60,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  const handleSaveEntity = () => {
    updateSettings.mutate(
      {
        companyNameAr: companyNameAr || null,
        companyNameEn: companyNameEn || null,
        businessRegistration: businessRegistration || null,
        vatRegistrationNumber: vatRegistrationNumber || null,
        vatRate: Number(vatRate) / 100,
        sellerAddress: sellerAddress || null,
        organizationCity,
        postalCode: postalCode || null,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    )
  }

  const DEFAULT_LANGUAGE_OPTIONS = [
    { value: "ar", label: t("settings.defaultLanguage.ar") },
    { value: "en", label: t("settings.defaultLanguage.en") },
  ]

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "contact", label: t("settings.tabs.general"), desc: t("settings.organizationEmail") },
    { id: "regional", label: t("settings.regionalSettings"), desc: t("settings.weekStartDay") },
    { id: "notifications", label: t("settings.reminders"), desc: t("settings.sessionDuration") },
    { id: "entity", label: t("settings.tabs.entity"), desc: t("settings.entity.companyNameAr") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.tabs.general")}
            </p>
          </div>
          <div role="tablist" className="flex-1 p-3 space-y-1.5">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={0}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(tab.id) }}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
              >
                <p className="text-sm font-medium truncate leading-tight">{tab.label}</p>
                {activeTab === tab.id && (
                  <p className="text-xs mt-0.5 line-clamp-2 leading-tight opacity-80">{tab.desc}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col">
          {activeTab === "contact" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.organizationEmail")}</Label>
                    <Input type="email" value={organizationEmail} onChange={(e) => setClinicEmail(e.target.value)} />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.organizationPhone")}</Label>
                    <Input value={organizationPhone} onChange={(e) => setClinicPhone(e.target.value)} />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.organizationAddress")}</Label>
                    <Input value={organizationAddress} onChange={(e) => setClinicAddress(e.target.value)} />
                  </CardContent>
                </Card>
                <div />
              </div>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={updateSettings.isPending} onClick={handleSaveContact}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "regional" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.weekStartDay")}</Label>
                    <Select value={weekStartDay} onValueChange={setWeekStartDay}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEK_START_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.dateFormat")}</Label>
                    <Select value={dateFormat} onValueChange={setDateFormat}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DATE_FORMAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.timeFormat")}</Label>
                    <Select value={timeFormat} onValueChange={setTimeFormat}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIME_FORMAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.organizationTimezone")}</Label>
                    <Select value={clinicTimezone} onValueChange={setClinicTimezone}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.defaultLanguage")}</Label>
                    <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEFAULT_LANGUAGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={updateSettings.isPending} onClick={handleSaveRegional}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.sessionDuration")}</Label>
                    <p className="text-xs text-muted-foreground">{t("settings.sessionDurationDesc")}</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={sessionDuration}
                        onChange={(e) => setSessionDuration(e.target.value)}
                        className="w-24 tabular-nums"
                        min={5}
                        max={480}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.reminderBeforeMinutes")}</Label>
                    <p className="text-xs text-muted-foreground">{t("settings.reminderBeforeMinutesDesc")}</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={reminderBeforeMinutes}
                        onChange={(e) => setReminderBeforeMinutes(e.target.value)}
                        className="w-24 tabular-nums"
                        min={0}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={updateSettings.isPending} onClick={handleSaveNotifications}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "entity" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
                <p className="text-sm text-warning-foreground">
                  {t("settings.entity.warning")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.entity.companyNameAr")}</Label>
                    <Input value={companyNameAr} onChange={(e) => setCompanyNameAr(e.target.value)} dir="rtl" />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.entity.companyNameEn")}</Label>
                    <Input value={companyNameEn} onChange={(e) => setCompanyNameEn(e.target.value)} dir="ltr" />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.entity.businessRegistration")}</Label>
                    <Input value={businessRegistration} onChange={(e) => setBusinessRegistration(e.target.value)} dir="ltr" />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.entity.vatRegistration")}</Label>
                    <Input value={vatRegistrationNumber} onChange={(e) => setVatRegistrationNumber(e.target.value)} dir="ltr" />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.entity.vatRate")}</Label>
                    <Input value={vatRate} onChange={(e) => setVatRate(e.target.value)} type="number" min="0" max="100" dir="ltr" />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.entity.sellerAddress")}</Label>
                    <Input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.entity.organizationCity")}</Label>
                    <Input value={organizationCity} onChange={(e) => setClinicCity(e.target.value)} />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.entity.postalCode")}</Label>
                    <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} dir="ltr" />
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={updateSettings.isPending} onClick={handleSaveEntity}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
