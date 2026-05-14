import { cn } from "@/lib/utils"

interface ListPageShellProps {
  children: React.ReactNode
  className?: string
}

export function ListPageShell({ children, className }: ListPageShellProps) {
  return (
    <div className={cn("flex flex-col gap-6 fade-in-up", className)}>
      {children}
    </div>
  )
}
