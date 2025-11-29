// src/components/SearchBar.tsx
'use client';
import { useEffect, useState } from 'react';

export default function SearchBar({
  onPick,
}: {
  // retourne true si la proposition a réussi → on efface la recherche
  onPick: (media: any) => Promise<boolean>;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [seenIds, setSeenIds] = useState<number[]>([]);
  const [me, setMe] = useState<{ id: string | null } | null>(null);
  const canAct = !!me?.id; // actions seulement si connecté

  // Charger session
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        const j = await r.json().catch(() => ({ user: null }));
        setMe(j.user || null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  // Charger ids déjà vus (ok même si non loggé → retour vide côté API)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/watched/ids', { cache: 'no-store' });
        if (!r.ok) { setSeenIds([]); return; }
        const j = await r.json().catch(() => ({ ids: [] }));
        setSeenIds(Array.isArray(j.ids) ? j.ids : []);
      } catch {
        setSeenIds([]);
      }
    })();
  }, []);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q));
      const j = await res.json().catch(() => ({}));
      setResults(j.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function propose(m: any) {
    if (!canAct) {
      alert('Tu dois être connecté pour effectuer cette action.');
      return;
    }
    const ok = await onPick(m);
    if (ok) {
      setQ('');
      setResults([]);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex gap-2 items-center">
        <input
          className="border rounded-xl px-3 py-2 flex-1"
          placeholder="Tape le nom de l’animé"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={(e)=>{ if (e.key==='Enter') search(); }}
        />
        <button className="btn btn-primary" onClick={search} disabled={loading}>
          {loading ? '…' : 'Rechercher'}
        </button>
        {!canAct && (
          <a className="btn" href="/auth" title="Connecte-toi pour proposer/ajouter">
            Se connecter
          </a>
        )}
      </div>

      {results.length>0 && (
        <ul className="mt-3 grid md:grid-cols-2 gap-2">
          {results.map(m => {
            const title = m.title?.english || m.title?.romaji || 'Sans titre';
            const meta = [
              m.format,
              m.episodes ? `${m.episodes} épisodes` : null,
              (m.genres||[]).slice(0,2).join(' · ')
            ].filter(Boolean).join(' • ');
            const alreadySeen = seenIds.includes(m.id);

            return (
              <li key={m.id} className="card p-3 flex items-center gap-3">
                <img src={m.coverImage?.large} className="w-16 h-20 rounded-lg object-cover" alt="" />
                <div className="flex-1">
                  {alreadySeen && (
                    <div className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-block mb-1">
                      Déjà vu
                    </div>
                  )}
                  <div className="font-medium">{title}</div>
                  <div className="text-xs opacity-70">{meta}</div>
                </div>
                <button
                  className={`btn btn-primary ${canAct ? '' : 'opacity-60 cursor-not-allowed'}`}
                  onClick={() => canAct ? propose(m) : null}
                  title={canAct ? 'Proposer / Ajouter' : 'Connexion requise'}
                  disabled={!canAct}
                >
                  Proposer
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
