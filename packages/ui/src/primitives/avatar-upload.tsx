"use client"

import { useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageUploadIcon, UserIcon, Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { cn } from "../lib/cn"

interface AvatarUploadProps {
  value?: string
  onChange: (file: File, previewUrl: string) => void
  onClear: () => void
  className?: string
  children?: React.ReactNode  // slot for extra controls (e.g. switch)
}

export function AvatarUpload({ value, onChange, onClear, className, children }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | undefined>(value)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    onChange(file, url)
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(undefined)
    onClear()
  }

  return (
    <div className={cn("flex items-center justify-between gap-4 pb-4 mb-2 border-b border-border", className)}>
      {/* Avatar + badge button */}
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 shrink-0">
          {/* Circle */}
          <div
            className="group h-20 w-20 cursor-pointer rounded-full border-2 border-dashed border-border bg-surface-muted overflow-hidden flex items-center justify-center"
            onClick={() => inputRef.current?.click()}
          >
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="avatar" className="h-full w-full object-cover" />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <HugeiconsIcon icon={ImageUploadIcon} className="h-5 w-5 text-white" />
                </div>
              </>
            ) : (
              <HugeiconsIcon icon={UserIcon} className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {/* Badge button — + when empty, × when has image */}
          {preview ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute bottom-0 end-0 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-md ring-2 ring-background hover:bg-destructive/80 transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute bottom-0 end-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background hover:bg-primary/80 transition-colors"
            >
              <HugeiconsIcon icon={Add01Icon} className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Slot for switch or other controls */}
      {children}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
