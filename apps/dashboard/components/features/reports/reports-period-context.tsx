"use client"

import { createContext, ReactNode, useContext } from "react"
import {
  useReportsPeriod,
  type UseReportsPeriodReturn,
} from "@/hooks/use-reports-period"

const ReportsPeriodContext = createContext<UseReportsPeriodReturn | null>(null)

export function ReportsPeriodProvider({ children }: { children: ReactNode }) {
  const value = useReportsPeriod()
  return (
    <ReportsPeriodContext.Provider value={value}>
      {children}
    </ReportsPeriodContext.Provider>
  )
}

export function useReportsPeriodCtx(): UseReportsPeriodReturn {
  const ctx = useContext(ReportsPeriodContext)
  if (!ctx) {
    throw new Error(
      "useReportsPeriodCtx must be used inside ReportsPeriodProvider",
    )
  }
  return ctx
}
