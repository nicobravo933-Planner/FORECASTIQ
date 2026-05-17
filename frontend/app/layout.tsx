import type { Metadata } from "next"
import { Inter } from "next/font/google"
import ThemeRegistry from "@/components/ui/ThemeRegistry"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "forecastiq — Forecasting con IA",
  description: "Subí tus ventas, obtené forecasts automáticos y charlá con tus datos usando IA.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
