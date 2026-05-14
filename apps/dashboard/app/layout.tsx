import { IBM_Plex_Sans_Arabic } from "next/font/google"

import "./globals.css"
import "./toast.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@deqah/ui"
import { Toaster } from "@deqah/ui"
import { BrandingProvider } from "@/components/providers/branding-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { LocaleProvider } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
      className={cn("antialiased", ibmPlexSansArabic.variable)}
    >
      <body className="font-sans">
          <LocaleProvider>
            <ThemeProvider>
              <QueryProvider>
                <AuthProvider>
                  <BrandingProvider>
                    <TooltipProvider>
                      {children}
                    </TooltipProvider>
                  </BrandingProvider>
                </AuthProvider>
              </QueryProvider>
            </ThemeProvider>
            <Toaster />
          </LocaleProvider>
      </body>
    </html>
  )
}
