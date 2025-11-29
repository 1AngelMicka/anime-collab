// src/app/api/lists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ lists: [] }, { status: 200 });

  const { searchParams } = new URL(req.url);
  const includeGlobal = searchParams.get('include_global') === '1';

  // Listes à masquer dans "Tes listes"
  const HIDDEN_NAMES = ['Animés vus', 'Liste principale'];

  let query = supabase
    .from('lists')
    .select('id, name, is_public, is_global, created_at');

  if (includeGlobal) {
    // Vue spéciale ailleurs : peut inclure les globales si on le demande
    query = query
      .or(`owner_id.eq.${user.id},user_id.eq.${user.id},is_global.eq.true`)
      .not('name', 'in', `(${HIDDEN_NAMES.map(n => `"${n}"`).join(',')})`);
  } else {
    // Vue Profil : seulement tes listes perso (pas globales, pas systèmes)
    query = query
      .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .eq('is_global', false)
      .not('name', 'in', `(${HIDDEN_NAMES.map(n => `"${n}"`).join(',')})`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lists: data || [] });
}


export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { name, is_public = false } = await req.json().catch(() => ({}));
  const cleanName = String(name || '').trim();
  if (!cleanName) return NextResponse.json({ error: 'name requis' }, { status: 400 });
  if (cleanName.length > 100) return NextResponse.json({ error: 'name trop long (max 100)' }, { status: 400 });

  const { error } = await supabase
    .from('lists')
    .insert({
      owner_id: user.id,
      user_id: user.id,
      name: cleanName,
      is_public: Boolean(is_public),
      is_global: false, // on n'insère jamais de globale ici
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, name, is_public } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const payload: Record<string, any> = {};
  if (typeof name === 'string') {
    const nn = name.trim();
    if (!nn) return NextResponse.json({ error: 'name invalide' }, { status: 400 });
    if (nn.length > 100) return NextResponse.json({ error: 'name trop long (max 100)' }, { status: 400 });
    payload.name = nn;
  }
  if (typeof is_public === 'boolean') payload.is_public = is_public;
  if (Object.keys(payload).length === 0) return NextResponse.json({ error: 'aucune modification' }, { status: 400 });

  // RLS contrôle owner (owner_id/user_id) et pas global
  const { error } = await supabase
    .from('lists')
    .update(payload)
    .eq('id', id)
    .eq('is_global', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  // RLS contrôle owner (owner_id/user_id) + on évite les globales
  const { error } = await supabase
    .from('lists')
    .delete()
    .eq('id', id)
    .eq('is_global', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
// RLS en place pour contrôler l'ownership (owner_id/user_id) et éviter les globales