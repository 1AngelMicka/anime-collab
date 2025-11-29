import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 200 });

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 20)));

  const { data, error } = await supabase
    .from('watched')
    .select('id, anime_id, anime_title, anime_data, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { anime } = await req.json().catch(()=> ({}));
  const id = anime?.id;
  const title = anime?.title?.english || anime?.title?.romaji || '';
  if (!id || !anime) return NextResponse.json({ error: 'anime manquant' }, { status: 400 });

  const { error } = await supabase
    .from('watched')
    .insert({ user_id: user.id, anime_id: id, anime_title: title, anime_data: anime });

  // 23505 = déjà présent (unique user_id/anime_id) => OK idempotent
  if (error && (error as any).code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { anime_id } = await req.json().catch(()=> ({}));
  if (!anime_id) return NextResponse.json({ error: 'anime_id requis' }, { status: 400 });

  const { error } = await supabase
    .from('watched')
    .delete()
    .eq('user_id', user.id)
    .eq('anime_id', anime_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
