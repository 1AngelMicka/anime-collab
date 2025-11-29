// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 1) ✅ Essaye d'abord la RPC SECURITY DEFINER (bypass RLS proprement)
  const { data: r, error: re } = await supabase.rpc('my_profile');
  if (!re && Array.isArray(r) && r.length > 0) {
    const p = r[0];
    return NextResponse.json({ profile: { id: p.id, username: p.username, created_at: p.created_at, role: p.role, is_admin: p.is_admin } });
  }

  // 2) Fallback RLS classique (au cas où la RPC n’existe pas encore)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, created_at, role, is_admin')
    .eq('id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(()=> ({}));
  const username: string | undefined = body?.username;

  if (typeof username !== 'string' || username.trim().length < 3) {
    return NextResponse.json({ error: 'Username invalide (min 3 caractères)' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ username: username.trim() })
    .eq('id', user.id);

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Ce pseudo est déjà pris.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
