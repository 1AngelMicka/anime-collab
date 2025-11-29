import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const limit = Math.max(1, Math.min(25, Number(searchParams.get('limit') || 10)))

  // 1) RPC SECURITY DEFINER (recommandé)
  const { data: rpcData, error: rpcErr } = await supabase.rpc('profiles_suggest', { q, lim: limit })
  if (!rpcErr && Array.isArray(rpcData)) {
    return NextResponse.json({ items: rpcData })
  }

  // 2) Fallback gentil (si jamais la RPC n’existe pas)
  const q2 = supabase
    .from('profiles')
    .select('id, username')
    .order('username', { ascending: true })
    .limit(limit)

  const final = q ? q2.ilike('username', `${q}%`) : q2
  const { data, error } = await final
  if (error) return NextResponse.json({ items: [] }) // on renvoie vide plutôt que 500
  return NextResponse.json({ items: data || [] })
}
