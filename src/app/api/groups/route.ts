// src/app/api/groups/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ groups: [] }, { status: 200 })

  // 1) ✅ RPC SECURITY DEFINER (by-pass RLS en toute sécurité)
  const { data: r, error: re } = await supabase.rpc('list_my_groups')
  if (!re && Array.isArray(r)) {
    const groups = r.map((g: any) => ({
      id: g.id,
      name: g.name,
      owner_id: g.owner_id,
      my_role: (g.my_role || 'member') as 'owner'|'admin'|'member',
      created_at: g.created_at
    }))
    return NextResponse.json({ groups })
  }

  // 2) Fallback RLS : propriétaire + membership
  //    (fonctionnera si tes policies groups/group_members sont OK)
  const { data: owned, error: e1 } = await supabase
    .from('groups')
    .select('id, name, owner_id, created_at')
    .eq('owner_id', user.id)

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const { data: memberOf, error: e2 } = await supabase
    .from('group_members')
    .select('group_id, role, groups!inner(id, name, owner_id, created_at)')
    .eq('user_id', user.id)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  const memGroups = (memberOf || []).map((m: any) => ({
    id: m.groups?.id,
    name: m.groups?.name,
    owner_id: m.groups?.owner_id,
    created_at: m.groups?.created_at,
    my_role: (m.role || 'member') as 'owner'|'admin'|'member'
  })).filter(g => !!g.id)

  const map: Record<string, any> = {}
  for (const g of owned || []) {
    map[g.id] = { ...g, my_role: 'owner' as const }
  }
  for (const g of memGroups) {
    map[g.id] ||= g
  }

  return NextResponse.json({ groups: Object.values(map) })
}
