"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Alert02Icon,
  MultiplicationSignCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      dir="auto"
      position="top-center"
      gap={8}
      icons={{
        success: (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="ck-toast-icon-success"
            style={{ width: 16, height: 16 }}
          />
        ),
        info: (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="ck-toast-icon-info"
            style={{ width: 16, height: 16 }}
          />
        ),
        warning: (
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="ck-toast-icon-warning"
            style={{ width: 16, height: 16 }}
          />
        ),
        error: (
          <HugeiconsIcon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            className="ck-toast-icon-error"
            style={{ width: 16, height: 16 }}
          />
        ),
        loading: (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            style={{ width: 16, height: 16 }}
          />
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "ck-toast",
          title: "ck-toast-title",
          description: "ck-toast-description",
          actionButton: "ck-toast-action",
          cancelButton: "ck-toast-cancel",
          icon: "ck-toast-icon",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
