// src/components/HeaderNotifications.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

type Notification = {
  id: string
  type:
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'proposed'
    | 'approved'
    | 'rejected'
    | 'seen'
    | 'invite'
  message: string
  is_read: boolean
  created_at: string
  payload?: any
}

type Invite = {
  id: string
  group_id: string
  status: 'pending' | 'accepted' | 'refused'
  created_at: string
  group_name?: string
  inviter_username?: string | null
}

export default function HeaderNotifications() {
  // 1) Client Supabase (facultatif). S'il ne peut pas être créé -> Realtime désactivé mais le fetch continue de marcher.
  const supabase = useMemo(() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !key) return null
      return createBrowserClient(url, key)
    } catch {
      return null
    }
  }, [])

  const [open, setOpen] = useState(false)

  // Notifications (toujours chargées par fetch -> garanti)
  const [items, setItems] = useState<Notification[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Invites
  const [invites, setInvites] = useState<Invite[]>([])

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout((showToast as any)._t)
    ;(showToast as any)._t = window.setTimeout(() => setToast(null), 3000)
  }, [])

  const pendingInvites = useMemo(
    () => invites.filter(i => i.status === 'pending').length,
    [invites]
  )
  const totalBadge = (unreadCount ?? 0) + pendingInvites

  // === FETCH de base (marche même sans Realtime) ===
  async function loadFirstPage() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=20', { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      const gotItems = Array.isArray(j.items) ? (j.items as Notification[]) : []
      setItems(gotItems)
      setNextCursor(j.nextCursor ?? null)
      setUnreadCount(typeof j.unreadCount === 'number' ? j.unreadCount : 0)
    } catch {
      setItems([])
      setNextCursor(null)
      setUnreadCount(0)
    }

    try {
      const r2 = await fetch('/api/groups/invites', { cache: 'no-store' })
      const j2 = await r2.json().catch(() => ({ invites: [] }))
      setInvites(Array.isArray(j2.invites) ? (j2.invites as Invite[]) : [])
    } catch {
      setInvites([])
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const qs = new URLSearchParams()
      qs.set('limit', '20')
      qs.set('cursor', nextCursor)
      const res = await fetch(`/api/notifications?${qs.toString()}`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      const gotItems = Array.isArray(j.items) ? (j.items as Notification[]) : []
      setItems(prev => [...prev, ...gotItems])
      setNextCursor(j.nextCursor ?? null)
    } finally {
      setLoadingMore(false)
    }
  }

  async function refreshUnreadOnly() {
    try {
      const res = await fetch('/api/notifications?unread=1', { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      setUnreadCount(typeof j.unreadCount === 'number' ? j.unreadCount : 0)
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    loadFirstPage()
  }, [])

  // === Realtime facultatif (n’affecte jamais l’affichage si ça échoue) ===
  useEffect(() => {
    if (!supabase) return
    let channel: RealtimeChannel | null = null
    try {
      channel = supabase
        .channel('realtime:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload: any) => {
            const row = payload.new as Notification
            // ajoute en tête si pas déjà présent
            setItems(prev => (prev.some(n => n.id === row.id) ? prev : [row, ...prev]))
            if (!row.is_read) {
              setUnreadCount(u => u + 1)
              showToast('Nouvelle notification')
            }
          }
        )
        .subscribe()
    } catch {
      // En cas d’erreur Realtime, on ne casse pas l’UI.
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {
        /* noop */
      }
    }
  }, [supabase, showToast])

  // === Actions ===
  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function acceptInvite(inviteId: string) {
    const r = await fetch('/api/groups/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j.error || 'Action impossible')
      return
    }
    await loadFirstPage()
  }

  async function refuseInvite(inviteId: string) {
    const r = await fetch('/api/groups/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j.error || 'Action impossible')
      return
    }
    await loadFirstPage()
  }

  return (
    <>
      {/* Bouton cloche */}
      <div className="relative">
        <button className="btn" onClick={() => setOpen(o => !o)}>
          🔔
          {totalBadge > 0 && (
            <span className="ml-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
              {totalBadge > 99 ? '99+' : totalBadge}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-96 card p-3 z-50">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Notifications</div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button className="btn text-xs" onClick={markAllRead}>
                    Tout marquer lu
                  </button>
                )}
                <button className="btn text-xs" onClick={loadFirstPage}>
                  Rafraîchir
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-sm opacity-70">Chargement…</div>
            ) : (
              <>
                {/* Invitations */}
                {pendingInvites > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold opacity-70 mb-1">Invitations</div>
                    <ul className="space-y-2">
                      {invites
                        .filter(i => i.status === 'pending')
                        .map(i => (
                          <li key={i.id} className="p-2 rounded-lg border">
                            <div className="text-xs opacity-60 mb-1">
                              {new Date(i.created_at).toLocaleString()}
                            </div>
                            <div className="text-sm">
                              {i.inviter_username
                                ? `${i.inviter_username} t’a invité à rejoindre « ${
                                    i.group_name || 'Groupe'
                                  } ».`
                                : `Invitation à rejoindre « ${i.group_name || 'Groupe'} ».`}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button className="btn btn-primary" onClick={() => acceptInvite(i.id)}>
                                Accepter
                              </button>
                              <button className="btn btn-danger" onClick={() => refuseInvite(i.id)}>
                                Refuser
                              </button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Notifications classiques */}
                {items.length === 0 && pendingInvites === 0 ? (
                  <div className="text-sm opacity-70">Rien pour le moment.</div>
                ) : (
                  <>
                    <ul className="max-h-80 overflow-auto space-y-2">
                      {items.map(n => (
                        <li
                          key={n.id}
                          className={`p-2 rounded-lg border ${n.is_read ? 'opacity-70' : ''}`}
                        >
                          <div className="text-xs opacity-60">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                          <div className="text-sm">{n.message}</div>
                        </li>
                      ))}
                    </ul>

                    {/* Charger plus */}
                    {nextCursor && (
                      <div className="mt-2">
                        <button className="btn w-full" disabled={loadingMore} onClick={loadMore}>
                          {loadingMore ? 'Chargement…' : 'Charger plus'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Toast simple */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999]">
          <div className="px-4 py-3 rounded-xl shadow-lg border bg-neutral-900 text-white">
            <span className="mr-2">🔔</span> {toast}
          </div>
        </div>
      )}
    </>
  )
}
