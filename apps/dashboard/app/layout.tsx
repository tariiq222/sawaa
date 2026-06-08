import type { Metadata } from "next"
import localFont from "next/font/local"

import "./globals.css"
import "./toast.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@sawaa/ui"
import { Toaster } from "@sawaa/ui"
import { AuthProvider } from "@/components/providers/auth-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { LocaleProvider } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: {
    default: "لوحة التحكم — سواء",
    template: "%s — لوحة التحكم — سواء",
  },
  description: "لوحة تحكم مركز سواء للاستشارات الأسرية",
}

const handicrafts = localFont({
  variable: "--font-arabic",
  display: "swap",
  src: [
    { path: "../public/fonts/Handicrafts-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/Handicrafts-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/Handicrafts-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/Handicrafts-Bold.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/Handicrafts-Black.woff2", weight: "900", style: "normal" },
  ],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={cn("antialiased", handicrafts.variable)}
    >
      <body className="font-sans">
          <LocaleProvider>
            <ThemeProvider>
              <QueryProvider>
                <AuthProvider>
                  <TooltipProvider>
                    {children}
                  </TooltipProvider>
                </AuthProvider>
              </QueryProvider>
            </ThemeProvider>
            <Toaster />
          </LocaleProvider>
      </body>
    </html>
  )
}
