// src/app/api/watched/ids/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/watched/ids
// - sans params  → { ids: number[] }  (utilisé par la SearchBar pour "Déjà vu")
// - avec list_id → { items: [...] }   (compat pour /lists qui attendait les items)
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Non connecté → on renvoie vide pour ne rien casser
  if (!user) return NextResponse.json({ ids: [], items: [] }, { status: 200 });

  const { searchParams } = new URL(req.url);
  const listId = searchParams.get('list_id'); // optionnel
  const mode = searchParams.get('mode');      // optionnel: 'items'
  const limitParam = Number(searchParams.get('limit') || 0);
  const limit = Number.isFinite(limitParam) ? Math.max(0, Math.min(1000, limitParam)) : 0;

  let q = supabase
    .from('watched')
    .select('id, list_id, anime_id, anime_title, anime_data, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (listId) q = q.eq('list_id', listId);
  if (limit > 0) q = q.limit(limit);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compat: si on cible une liste (ou mode=items), renvoyer les items complets
  if (listId || mode === 'items') return NextResponse.json({ items: data || [] });

  // Par défaut: retourner seulement les IDs uniques
  const ids = Array.from(
    new Set((data || []).map(r => Number(r.anime_id)).filter(n => Number.isFinite(n)))
  );
  return NextResponse.json({ ids });
}
