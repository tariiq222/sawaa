"use client"

interface ProgressiveFieldProps {
  show: boolean
  children: React.ReactNode
}

export function ProgressiveField({ show, children }: ProgressiveFieldProps) {
  if (!show) return null
  return <div>{children}</div>
}
