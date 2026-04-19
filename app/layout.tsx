import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AudioProvider } from "@/components/providers/AudioProvider"
import { MiniPlayer } from "@/components/player/MiniPlayer"
import { FullPlayer } from "@/components/player/FullPlayer"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "AudioShelf",
  description: "Your personal audiobook library",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AudioShelf",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased font-sans">
        <AudioProvider>
          {children}
          <MiniPlayer />
          <FullPlayer />
          <Toaster position="top-center" />
        </AudioProvider>
      </body>
    </html>
  )
}
