// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? 20), 50))
  const cursor = url.searchParams.get('cursor')
  const unreadOnly = url.searchParams.get('unread') === '1'
  const debug = url.searchParams.get('debug') === '1'

  const { data: { user } } = await supabase.auth.getUser()

  // ⚠️ En debug, on veut voir si on est authentifié
  if (!user) {
    if (debug) {
      return NextResponse.json({ debug: { authUid: null, note: 'No auth user' } }, { status: 200 })
    }
    // Comportement normal en prod : renvoie vide
    return NextResponse.json({ items: [], nextCursor: null, unreadCount: 0 }, { status: 200 })
  }

  // Unread count
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (unreadOnly) {
    return NextResponse.json({ unreadCount: unreadCount ?? 0 })
  }

  let query = supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at, payload, user_id') // <- user_id inclus en debug
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt('created_at', cursor)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = data ?? []
  const nextCursor = items.length ? items[items.length - 1].created_at : null

  if (debug) {
    return NextResponse.json({
      debug: {
        authUid: user.id,
        rowsVisible: items.length,
        sample: items.slice(0, 3),
      },
      items,
      nextCursor,
      unreadCount: unreadCount ?? 0,
    })
  }

  return NextResponse.json({ items, nextCursor, unreadCount: unreadCount ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({} as any))

  if (body?.all === true) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (Array.isArray(body?.ids) && body.ids.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', body.ids)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'bad payload' }, { status: 400 })
}
