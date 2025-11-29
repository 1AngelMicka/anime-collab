// src/app/api/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/** Appel RPC can_access_list (SECURITY DEFINER) si dispo, sinon fallback RLS */
async function canAccessList(supabase: any, listId: string, userId: string) {
  // 1) RPC privilégiée
  try {
    const { data, error } = await supabase.rpc('can_access_list', { lid: listId, uid: userId })
    if (!error && typeof data === 'boolean') return data
  } catch { /* ignore */ }

  // 2) Fallback soumis RLS
  const { data: list } = await supabase
    .from('lists')
    .select('group_id')
    .eq('id', listId)
    .maybeSingle()
  if (!list) return false

  if (!list.group_id) {
    const { data: lm } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .maybeSingle()
    return !!lm
  } else {
    const { data: gm } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', list.group_id)
      .eq('user_id', userId)
      .maybeSingle()
    return !!gm
  }
}

// GET /api/proposals?list_id=...
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = new URL(req.url)
  const listId = searchParams.get('list_id')
  if (!listId) return NextResponse.json({ proposals: [] }, { status: 200 })
  if (!user)  return NextResponse.json({ proposals: [] }, { status: 200 })

  // Autorisation
  const allowed = await canAccessList(supabase, listId, user.id)
  if (!allowed) return NextResponse.json({ proposals: [] }, { status: 200 })

  // 1) RPC "get_proposals_for_list" si dispo
  try {
    const { data: rows, error } = await supabase.rpc('get_proposals_for_list', { lid: listId })
    if (!error && Array.isArray(rows)) {
      const mapped = rows.map((p: any) => ({
        id: p.id,
        list_id: p.list_id,
        user_id: p.user_id,
        anime_id: p.anime_id,
        anime_title: p.anime_title,
        anime_data: p.anime_data,
        status: p.status,
        created_at: p.created_at,
        proposer_username: p.proposer_username ?? null,
      }))
      return NextResponse.json({ proposals: mapped })
    }
  } catch { /* ignore */ }

  // 2) Fallback SELECT direct (si RLS OK)
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('id,list_id,user_id,anime_id,anime_title,anime_data,status,created_at,profiles(username)')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const mapped = (data || []).map((p: any) => ({
      id: p.id,
      list_id: p.list_id,
      user_id: p.user_id,
      anime_id: p.anime_id,
      anime_title: p.anime_title,
      anime_data: p.anime_data,
      status: p.status,
      created_at: p.created_at,
      proposer_username: p.profiles?.[0]?.username ?? p.profiles?.username ?? null,
    }))
    return NextResponse.json({ proposals: mapped })
  } catch (e: any) {
    return NextResponse.json({ proposals: [], error: e?.message || 'select_failed' }, { status: 500 })
  }
}

// POST /api/proposals   body: { list_id, anime }
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { list_id, anime } = await req.json().catch(() => ({}))
  if (!list_id || !anime?.id) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  const allowed = await canAccessList(supabase, list_id, user.id)
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // 1) RPC insert_proposal (SECURITY DEFINER) si dispo
  try {
    const { error: insErr } = await supabase.rpc('insert_proposal', {
      lid: list_id,
      aid: anime.id,
      atitle: anime.title?.english || anime.title?.romaji || 'Sans titre',
      adata: anime
    })
    if (!insErr) return NextResponse.json({ ok: true })
  } catch { /* ignore */ }

  // 2) Petit garde-fou anti-doublon "pending" (ne casse rien)
  try {
    const { data: existing } = await supabase
      .from('proposals')
      .select('id')
      .eq('list_id', list_id)
      .eq('anime_id', anime.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, info: 'already_pending' })
    }
  } catch { /* ignore */ }

  // 3) Fallback insert direct (RLS doit être correct)
  const title = anime.title?.english || anime.title?.romaji || 'Sans titre'
  const { error } = await supabase.from('proposals').insert({
    list_id,
    user_id: user.id,
    anime_id: anime.id,
    anime_title: title,
    anime_data: anime,
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/proposals   body: { id }
// -> Soft-cancel si les colonnes existent (status/cancelled_*), sinon fallback delete.
// -> Pour l’instant seul l’auteur peut annuler (on branchera chef de groupe dès que tu m’envoies ta logique).
export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { data: p, error: eP } = await supabase
    .from('proposals')
    .select('id, list_id, user_id, status')
    .eq('id', id)
    .maybeSingle()
  if (eP) return NextResponse.json({ error: eP.message }, { status: 500 })
  if (!p) return NextResponse.json({ ok: true })

  // Autorisation "membre de la liste"
  const allowed = await canAccessList(supabase, p.list_id, user.id)
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Restriction : seul l'auteur peut annuler pour l’instant
  if (p.user_id !== user.id) {
    return NextResponse.json({ error: 'only_author_can_cancel_for_now' }, { status: 403 })
  }

  // 1) Tentative SOFT CANCEL (si les colonnes existent)
  try {
    const { error: upErr } = await supabase
      .from('proposals')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
      })
      .eq('id', id)

    if (!upErr) {
      return NextResponse.json({ ok: true, status: 'cancelled' })
    }

    // Si autre erreur que "undefined column", on la renvoie
    // (Postgres: 42703 = undefined_column)
    // @ts-ignore
    if (upErr?.code && upErr.code !== '42703') {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }
  } catch { /* ignore */ }

  // 2) Fallback DELETE (comportement historique)
  const { error: delErr } = await supabase.from('proposals').delete().eq('id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: true })
}
