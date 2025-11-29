// src/hooks/useNotifications.ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

type NotificationRow = {
  id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
  payload: any
}

export function useNotifications() {
  const [items, setItems] = useState<NotificationRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [unread, setUnread] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const mounted = useRef(false)

  const fetchPage = useCallback(async (cursor?: string | null) => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (cursor) qs.set('cursor', cursor)
    qs.set('limit', '20')
    const res = await fetch(`/api/notifications?${qs.toString()}`)
    const json = await res.json()
    if (Array.isArray(json.items)) {
      setItems(prev => [...prev, ...json.items])
      setNextCursor(json.nextCursor ?? null)
      setUnread(typeof json.unreadCount === 'number' ? json.unreadCount : 0)
    }
    setLoading(false)
  }, [])

  const refreshUnread = useCallback(async () => {
    const res = await fetch('/api/notifications?unread=1')
    const json = await res.json()
    if (typeof json.unreadCount === 'number') setUnread(json.unreadCount)
  }, [])

  const markRead = useCallback(async (ids: string[] | 'all') => {
    const body = Array.isArray(ids) ? { ids } : { all: true }
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    // Optimiste
    setItems(prev =>
      prev.map(n => (ids === 'all' || (Array.isArray(ids) && ids.includes(n.id)) ? { ...n, is_read: true } : n))
    )
    refreshUnread()
  }, [refreshUnread])

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    fetchPage()
  }, [fetchPage])

  return {
    items,
    loading,
    nextCursor,
    fetchNext: () => nextCursor ? fetchPage(nextCursor) : null,
    unread,
    refreshUnread,
    markRead,
  }
}
