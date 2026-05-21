// EXCEPTION: icon grid + color swatches are tightly coupled state; split adds complexity with no benefit, approved 2026-04-24
"use client"

import { useRef, useState, useMemo } from "react"
import * as HugeIcons from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@sawaa/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { ServiceAvatar } from "./service-avatar"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"

/* ─── Icon list ─── */
const ALL_ICON_NAMES: string[] = Object.keys(HugeIcons).filter(
  (k) =>
    k.endsWith("Icon") &&
    Array.isArray((HugeIcons as Record<string, unknown>)[k])
)

/* ─── Color palette — calm presets aligned with brand warmth (60-30-10) ─── */
// Avatar bg colors are user-chosen presets persisted as hex (sent to backend, rendered as inline style).
// Brand primary/accent are surfaced as the first two swatches client-side via useBgColors().
const PRESET_bgColors = [
  "#3B82C4", // blue
  "#7FAE3A", // green
  "#C8503E", // red
  "#C77A2E", // orange
  "#8E5BA8", // purple
  "#2FA694", // teal
  "#2D7AB0", // deep blue
  "#D89432", // amber
  "#2A8E78", // emerald
  "#7B3F94", // violet
  "#A53A30", // brick
  "#3B8F52", // forest
]

/** Resolves brand primary/accent from CSS vars at client render time. */
function useBgColors(): string[] {
  return useMemo(() => {
    if (typeof window === "undefined") return PRESET_bgColors
    const root = getComputedStyle(document.documentElement)
    const primary = root.getPropertyValue("--primary").trim()
    const accent = root.getPropertyValue("--accent").trim()
    const head: string[] = []
    if (primary) head.push(primary)
    if (accent && accent !== primary) head.push(accent)
    return [...head, ...PRESET_bgColors].slice(0, 12)
  }, [])
}

/* ─── Props ─── */
interface ServiceAvatarPickerProps {
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  serviceName?: string
  onIconChange: (iconName: string, iconBgColor: string) => void
  onImageChange: (file: File) => void
  onClear: () => void
}

/* ─── Component ─── */
export function ServiceAvatarPicker({
  iconName,
  iconBgColor,
  imageUrl,
  serviceName,
  onIconChange,
  onImageChange,
  onClear,
}: ServiceAvatarPickerProps) {
  const { t } = useLocale()
  const bgColors = useBgColors()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIcon, setSelectedIcon] = useState<string | null>(
    iconName ?? null
  )
  const [selectedColor, setSelectedColor] = useState<string>(
    iconBgColor ?? bgColors[0]
  )
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    imageUrl ?? undefined
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLInputElement>(null)

  const hasValue = !!(imageUrl || previewUrl || iconName || selectedIcon)

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_ICON_NAMES
    const q = search.toLowerCase()
    return ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q))
  }, [search])

  const handleIconSelect = (name: string) => {
    setSelectedIcon(name)
    onIconChange(name, selectedColor)
  }

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    if (selectedIcon) onIconChange(selectedIcon, color)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setSelectedIcon(null)
    onImageChange(file)
    setOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIcon(null)
    setPreviewUrl(undefined)
    onClear()
  }

  const displayImageUrl = previewUrl ?? imageUrl ?? undefined
  const displayIconName = selectedIcon ?? iconName ?? undefined
  const displayBgColor = selectedColor ?? iconBgColor ?? undefined

  return (
    <div className="relative h-20 w-20 shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-surface-muted"
          >
            <ServiceAvatar
              iconName={displayIconName}
              iconBgColor={displayBgColor}
              imageUrl={displayImageUrl}
              name={serviceName}
              size="lg"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0" align="start">
          <Tabs defaultValue="icon">
            <TabsList className="w-full rounded-none border-b border-border">
              <TabsTrigger value="icon" className="flex-1">
                {t("services.avatar.iconTab")}
              </TabsTrigger>
              <TabsTrigger value="image" className="flex-1">
                {t("services.avatar.imageTab")}
              </TabsTrigger>
            </TabsList>

            {/* ── Icon Tab ── */}
            <TabsContent value="icon" className="space-y-3 p-3">
              <Input
                placeholder={t("services.avatar.iconSearch")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />

              {/* Icon Grid */}
              <div className="h-48 overflow-y-auto">
                <div className="grid grid-cols-6 gap-1">
                  {filtered.slice(0, 200).map((name) => {
                    const icon = (HugeIcons as Record<string, unknown>)[name]
                    const isSelected = selectedIcon === name
                    return (
                      <button
                        key={name}
                        type="button"
                        title={name.replace("Icon", "")}
                        onClick={() => handleIconSelect(name)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <HugeiconsIcon
                          icon={
                            icon as Parameters<typeof HugeiconsIcon>[0]["icon"]
                          }
                          size={18}
                          color="currentColor"
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Color Swatches */}
              {selectedIcon && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    {t("services.avatar.bgColor")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {bgColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorSelect(color)}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all",
                          selectedColor === color
                            ? "scale-110 border-foreground"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      />
                    ))}
                    {/* Custom color picker */}
                    <div className="relative h-6 w-6">
                      <button
                        type="button"
                        onClick={() => colorPickerRef.current?.click()}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all",
                          !bgColors.includes(selectedColor)
                            ? "scale-110 border-foreground"
                            : "border-dashed border-muted-foreground/40 hover:scale-105 hover:border-muted-foreground"
                        )}
                        style={
                          !bgColors.includes(selectedColor)
                            ? { backgroundColor: selectedColor }
                            : undefined
                        }
                        aria-label={t("services.avatar.customColor")}
                      >
                        {bgColors.includes(selectedColor) && (
                          <span className="text-[10px] leading-none font-bold text-muted-foreground">
                            +
                          </span>
                        )}
                      </button>
                      <input
                        ref={colorPickerRef}
                        type="color"
                        value={selectedColor}
                        onChange={(e) => handleColorSelect(e.target.value)}
                        className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  onClear()
                  setSelectedIcon(null)
                  setPreviewUrl(undefined)
                  setOpen(false)
                }}
              >
                {t("services.avatar.clear")}
              </Button>
            </TabsContent>

            {/* ── Image Tab ── */}
            <TabsContent value="image" className="space-y-3 p-3">
              {displayImageUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayImageUrl}
                    alt="preview"
                    className="mx-auto h-24 w-24 rounded-full border border-border object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setPreviewUrl(undefined)
                      onClear()
                      setOpen(false)
                    }}
                  >
                    {t("services.avatar.deleteImage")}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <span className="text-sm">
                    {t("services.avatar.uploadHint")}
                  </span>
                  <span className="text-xs opacity-60">
                    {t("services.avatar.uploadFormats")}
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFile}
              />
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Badge button */}
      {hasValue ? (
        <button
          type="button"
          onClick={handleClear}
          className="inset-b-0 absolute inset-e-0 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-md ring-2 ring-background transition-colors hover:bg-destructive/80"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inset-b-0 absolute inset-e-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-colors hover:bg-primary/80"
        >
          <HugeiconsIcon icon={Add01Icon} className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
