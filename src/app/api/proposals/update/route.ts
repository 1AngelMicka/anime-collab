// src/app/api/proposals/update/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type RawStatus = 'approved' | 'accepted' | 'rejected' | 'pending' | 'cancelled'
type Status = 'accepted' | 'rejected' | 'pending' | 'cancelled'

// --- Utils ---
function normalizeStatus(s: RawStatus): Status | null {
  if (s === 'approved') return 'accepted'
  if (s === 'accepted' || s === 'rejected' || s === 'pending' || s === 'cancelled') return s
  return null
}

// Fallback côté API si la RPC n'est pas dispo
async function ensureMembership(supabase: any, userId: string, listId: string) {
  const { data: list } = await supabase
    .from('lists')
    .select('id, group_id, owner_id')
    .eq('id', listId)
    .maybeSingle()
  if (!list) return { isMember: false, isOwner: false, list: null }

  // Liste liée à un groupe → vérifier group_members
  let isMember = false
  if (list.group_id) {
    const { data: gm } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', list.group_id)
      .eq('user_id', userId)
      .maybeSingle()
    isMember = !!gm
  } else {
    // Ancienne logique : membre direct de la liste
    const { data: lm } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .maybeSingle()
    isMember = !!lm
  }

  const isOwner = !!list.owner_id && list.owner_id === userId
  return { isMember, isOwner, list }
}

// PATCH /api/proposals/update   body: { id, status }
export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id: string | undefined = body?.id
  const rawStatus: RawStatus | undefined = body?.status
  if (!id || !rawStatus) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  const status = normalizeStatus(rawStatus)
  if (!status) return NextResponse.json({ error: 'invalid_status' }, { status: 400 })

  // 1) Essai via RPC sécurisée (si elle existe chez toi)
  try {
    const { error: rpcErr } = await supabase.rpc('update_proposal_status', {
      pid: id,
      new_status: status,
    })

    if (!rpcErr) {
      return NextResponse.json({ ok: true, status })
    }

    const code = (rpcErr as any)?.code
    const msg = (rpcErr as any)?.message || ''

    // Messages d'erreur "métier" éventuels renvoyés par la RPC
    if (msg.includes('self_moderation_forbidden')) {
      return NextResponse.json({ error: 'Tu ne peux pas valider/refuser ta propre proposition.' }, { status: 403 })
    }
    if (msg.includes('forbidden')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    if (msg.includes('invalid_status')) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    }
    // 42883 = undefined_function → on tente le fallback
    if (code && code !== '42883') {
      return NextResponse.json({ error: msg || 'server_error' }, { status: 500 })
    }
  } catch {
    // ignore → on tente le fallback plus bas
  }

  // 2) Fallback local (si la RPC n'existe pas encore)
  // Charger la proposition pour récupérer list_id + user_id (proposeur) + status courant
  const { data: prop, error: pErr } = await supabase
    .from('proposals')
    .select('id, list_id, user_id, status')
    .eq('id', id)
    .maybeSingle()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!prop) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Récupérer membership + owner
  const { isMember, isOwner } = await ensureMembership(supabase, user.id, prop.list_id)
  if (!isMember && !isOwner) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const isProposer = prop.user_id === user.id

  // --- Règles métier fallback ---
  // - accepted/rejected : interdit au proposeur (sauf owner qui "force")
  // - cancelled : auteur OU owner
  // - pending : autorisée au owner (remise à zéro)
  if (status === 'accepted' || status === 'rejected') {
    if (isProposer && !isOwner) {
      return NextResponse.json({ error: 'Tu ne peux pas valider/refuser ta propre proposition.' }, { status: 403 })
    }
  }

  if (status === 'cancelled') {
    if (!isProposer && !isOwner) {
      return NextResponse.json({ error: 'only_author_or_owner_can_cancel' }, { status: 403 })
    }
  }

  if (status === 'pending') {
    if (!isOwner) {
      return NextResponse.json({ error: 'only_owner_can_reset_to_pending' }, { status: 403 })
    }
  }

  // Ne rien faire si pas de changement
  if (prop.status === status) {
    return NextResponse.json({ ok: true, status })
  }

  // Tentative d'UPDATE
  // - si status = cancelled → soft fields (cancelled_at/by) si colonnes présentes
  // - sinon → simple update
  if (status === 'cancelled') {
    // Essaye soft-cancel
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

      // Si colonne inconnue → fallback sans colonnes soft
      // @ts-ignore
      if (upErr?.code && upErr.code !== '42703') {
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }
    } catch {
      // ignore → on tente fallback simple juste après
    }

    // Fallback : simple update du status
    const { error: simpleErr } = await supabase
      .from('proposals')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (simpleErr) return NextResponse.json({ error: simpleErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'cancelled' })
  }

  // accepted / rejected / pending
  const { error: updErr } = await supabase
    .from('proposals')
    .update({ status })
    .eq('id', id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, status })
}
