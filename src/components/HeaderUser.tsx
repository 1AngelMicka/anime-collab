// src/components/HeaderUser.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type UserInfo = { id: string | null; email?: string | null }

export default function HeaderUser() {
  const [me, setMe] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' })
      const j = await r.json().catch(()=>({ user:null }))
      setMe(j.user || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    // nettoyage local éventuel
    localStorage.removeItem('active_list_id')
    location.href = '/'
  }

  if (loading) {
    return <div className="text-xs opacity-60">…</div>
  }

  if (!me?.id) {
    return <Link href="/auth" className="btn">Connexion</Link>
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/profile" className="btn">Profil</Link>
      <button className="btn" onClick={logout}>Déconnexion</button>
    </div>
  )
}
