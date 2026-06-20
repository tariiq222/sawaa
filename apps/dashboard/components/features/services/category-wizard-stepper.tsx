"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

interface CategoryWizardStepperProps {
  tabs: string[]
  activeTab: string
  onTabChange: (tab: string) => void
  t: (key: string) => string
}

export function CategoryWizardStepper({ tabs, activeTab, onTabChange, t }: CategoryWizardStepperProps) {
  const tabIndex = tabs.indexOf(activeTab)

  return (
    <div className="mb-6 flex items-start">
      {tabs.map((tab, index) => {
        const isCompleted = index < tabIndex
        const isCurrent = index === tabIndex
        const isUpcoming = index > tabIndex

        return (
          <div key={tab} className="flex flex-1 items-start">
            {/* Step */}
            <button
              type="button"
              onClick={() => onTabChange(tab)}
              className="flex flex-col items-center gap-1.5 focus:outline-none"
            >
              <div
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  isCurrent ? "bg-primary text-primary-foreground" : "",
                  isCompleted ? "bg-primary/80 text-primary-foreground" : "",
                  isUpcoming ? "border border-border bg-surface text-muted-foreground" : "",
                ].join(" ")}
              >
                {isCompleted ? (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={[
                  "max-w-[80px] text-center text-xs leading-tight",
                  isCurrent ? "font-semibold text-foreground" : "",
                  isCompleted ? "text-foreground" : "",
                  isUpcoming ? "text-muted-foreground" : "",
                ].join(" ")}
              >
                {t(`services.categories.page.tabs.${tab}`)}
              </span>
            </button>

            {/* Connector — only between steps, not after the last */}
            {index < tabs.length - 1 && (
              <div
                className={[
                  "mt-4 h-px flex-1",
                  isCompleted ? "bg-primary/40" : "bg-border",
                ].join(" ")}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
