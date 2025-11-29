// src/app/api/list-items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const { searchParams } = new URL(req.url)
  const list_id = searchParams.get('list_id')
  if (!list_id) return NextResponse.json({ error: 'list_id requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('list_items')
    .select('id, list_id, user_id, added_by, anime_id, anime_title, anime_data, created_at')
    .eq('list_id', list_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { list_id, anime } = await req.json().catch(()=> ({}))
  if (!list_id || !anime?.id) return NextResponse.json({ error: 'bad payload' }, { status: 400 })

  const anime_id = Number(anime.id)
  const anime_title = anime.title?.english || anime.title?.romaji || 'Sans titre'

  const { error } = await supabase.from('list_items').insert({
    list_id,
    user_id: user.id,     // historique/compat
    added_by: user.id,    // ✅ NOUVEAU: qui a ajouté l'item (NOT NULL)
    anime_id,
    anime_title,
    anime_data: anime
  })

  if (error) {
    // 23505 = doublon (unique index list_id + anime_id)
    if ((error as any).code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await req.json().catch(()=> ({}))
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
