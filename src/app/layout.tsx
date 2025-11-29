// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import HeaderBar from '@/components/HeaderBar'

export const metadata: Metadata = {
  title: 'Watch Anime Together',
  description: 'Collaborer pour regarder des animés ensemble',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear()
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
          <HeaderBar />
        </header>

        <main className="max-w-8xl mx-auto px-4 py-6 flex-1 w-full">
          {children}
        </main>

        <footer className="w-full border-t bg-white/70">
          <div className="max-w-8xl mx-auto px-4 py-4 text-xs sm:text-sm text-center opacity-70">
            © {year} • Angel — Watch Anime Together
          </div>
        </footer>
      </body>
    </html>
  )
}
