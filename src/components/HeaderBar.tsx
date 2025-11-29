// src/components/HeaderBar.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import HeaderNotifications from '@/components/HeaderNotifications'
import { supabaseBrowser } from '@/lib/supabase-browser'

type UserInfo = { id: string | null; email?: string | null }

export default function HeaderBar() {
  const supabase = supabaseBrowser()
  const [me, setMe] = useState<UserInfo | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' })
      const j = await r.json().catch(() => ({ user: null }))
      setMe(j.user || null)

      const r2 = await fetch('/api/admin/whoami', { cache: 'no-store' })
      const j2 = await r2.json().catch(() => ({ is_admin: false }))
      setIsAdmin(!!j2.is_admin)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(async () => { await load() })
    return () => { sub.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('active_list_id')
    location.href = '/'
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-5 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-28 bg-gray-200 rounded" />
        </div>
        <div className="h-8 w-24 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      {/* ===== GAUCHE : Logo + nav publique ===== */}
      <div className="flex items-center gap-6 min-w-0">
        {/* Logo (public/logo.svg) */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <Image src="/logo.svg" alt="Logo Watch Anime Together" width={32} height={32} />
          <span className="truncate">Watch&nbsp;Anime&nbsp;Together</span>
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="btn">Accueil</Link>
          <Link href="/wat" className="btn">Watch List</Link>
          <Link href="/WatchTogether" className="btn">Watch Together</Link>
        </nav>
      </div>

      {/* ===== DROITE : Notifications + Profil + Déco / Connexion + Admin ===== */}
      <nav className="text-sm flex items-center gap-3">
        {me?.id && <HeaderNotifications />}

        {me?.id ? (
          <>
            <Link href="/profile" className="btn">Profil</Link>
            <button className="btn" onClick={logout}>Déconnexion</button>
          </>
        ) : (
          <Link href="/auth" className="btn">Connexion</Link>
        )}

        {isAdmin && <Link href="/admin" className="btn btn-danger">Administration</Link>}
      </nav>
    </div>
  )
}
