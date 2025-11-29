import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST { name } -> crée une liste générale (is_public=true, is_global=true)
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { name } = await req.json().catch(()=> ({}))
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('lists')
    .insert({ owner_id: user.id, name, is_public: true, is_global: true })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}
