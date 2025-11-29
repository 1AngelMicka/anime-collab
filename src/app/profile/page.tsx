'use client';

import { useEffect, useMemo, useState } from 'react';
import SearchBar from '@/components/SearchBar';

type Profile = { id: string; username: string | null; created_at: string };
type WatchedItem = {
  id: string; anime_id: number; anime_title: string; anime_data: any; created_at: string;
};
type List = { id: string; name: string; is_public: boolean; is_global: boolean; created_at?: string };

export default function ProfilePage() {
  // account
  const [meEmail, setMeEmail] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [busyName, setBusyName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<'idle'|'checking'|'ok'|'ko'>('idle');

  const [newEmail, setNewEmail] = useState('');
  const [busyEmail, setBusyEmail] = useState(false);

  const [pwd, setPwd] = useState('');
  const [busyPwd, setBusyPwd] = useState(false);

  // watched (mini)
  const [watchedMini, setWatchedMini] = useState<WatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // lists perso
  const [lists, setLists] = useState<List[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newListPublic, setNewListPublic] = useState(false);
  const [creatingList, setCreatingList] = useState(false);

  // Load account + watched mini + lists
  async function loadLists() {
    const lR = await fetch('/api/lists', { cache: 'no-store' });
    const lJ = await lR.json().catch(()=> ({}));
    if (lR.ok) setLists(lJ.lists || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const meR = await fetch('/api/auth/me', { cache: 'no-store' });
        const meJ = await meR.json().catch(()=>({user:null}));
        if (!meJ?.user?.id) {
          setErr('Tu dois être connecté pour voir ton profil.');
          setLoading(false);
          return;
        }

        // Profil
        const pR = await fetch('/api/profile', { cache: 'no-store' });
        const pJ = await pR.json().catch(()=> ({}));
        if (pR.ok) {
          setProfile(pJ.profile || null);
          setUsername(pJ.profile?.username || '');
          setMeEmail(pJ.email || '');
          setNewEmail(pJ.email || '');
        } else {
          setErr(pJ.error || 'Impossible de charger le profil.');
        }

        // mini watched (20)
        const wR = await fetch('/api/watched?limit=20', { cache: 'no-store' });
        const wJ = await wR.json().catch(()=> ({}));
        if (wR.ok) setWatchedMini(wJ.items || []);

        // tes listes (perso uniquement — les globales sont filtrées côté API)
        await loadLists();
      } catch {
        setErr('Erreur réseau.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Vérif disponibilité pseudo (live debounce)
  useEffect(() => {
    if (!username || !username.trim() || username === (profile?.username || '')) {
      setNameAvailable('idle');
      return;
    }
    const t = setTimeout(async () => {
      setNameAvailable('checking');
      try {
        const r = await fetch('/api/profile/check-username?u=' + encodeURIComponent(username.trim()));
        const j = await r.json().catch(()=> ({}));
        setNameAvailable(j?.available ? 'ok' : 'ko');
      } catch { setNameAvailable('idle'); }
    }, 400);
    return () => clearTimeout(t);
  }, [username, profile?.username]);

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 3) { alert('Min 3 caractères'); return; }
    setBusyName(true);
    const r = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ username: username.trim() })
    });
    const j = await r.json().catch(()=> ({}));
    setBusyName(false);
    if (!r.ok) { alert(j.error || 'Erreur'); return; }
    alert('Pseudo mis à jour ✅');
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.includes('@')) { alert('Email invalide'); return; }
    setBusyEmail(true);
    const r = await fetch('/api/auth/change-email', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email: newEmail.trim() })
    });
    const j = await r.json().catch(()=> ({}));
    setBusyEmail(false);
    if (!r.ok) { alert(j.error || 'Erreur'); return; }
    alert('Email mis à jour (vérifie ta boîte pour confirmation) ✅');
  }

  async function savePwd(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) { alert('Mot de passe trop court (min 6)'); return; }
    setBusyPwd(true);
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    const j = await r.json().catch(()=> ({}));
    setBusyPwd(false);
    if (!r.ok) { alert(j.error || 'Erreur'); return; }
    setPwd('');
    alert('Mot de passe mis à jour ✅');
  }

  // Ajouter un animé vu
  async function addWatched(media: any): Promise<boolean> {
    const r = await fetch('/api/watched', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ anime: media })
    });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok) { alert(j.error || 'Erreur'); return false; }
    // refresh mini
    const wR = await fetch('/api/watched?limit=20', { cache: 'no-store' });
    const wJ = await wR.json().catch(()=> ({}));
    setWatchedMini(wJ.items || []);
    return true; // pour clear la searchbar
  }

  // Création liste visuelle
  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    setCreatingList(true);
    const r = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ name: newListName.trim(), is_public: newListPublic })
    });
    const j = await r.json().catch(()=> ({}));
    setCreatingList(false);
    if (!r.ok) { alert(j.error || 'Erreur'); return; }
    setNewListName(''); setNewListPublic(false);
    await loadLists();
  }

  // Suppression d'une liste (avec confirmation)
  async function deleteList(id: string) {
    const ok = window.confirm('Êtes-vous sûr de vouloir supprimer cette liste ?');
    if (!ok) return;
    const r = await fetch('/api/lists', {
      method: 'DELETE',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id })
    });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok) { alert(j.error || 'Suppression impossible'); return; }
    await loadLists();
  }

  // Stats sur TOUT (via /api/watched/all)
  const [stats, setStats] = useState({ totalAnime: 0, totalEpisodes: 0, totalHours: 0, topGenre: '-' });
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/watched/all', { cache: 'no-store' });
        const j = await r.json().catch(()=>({items:[]}));
        const items: WatchedItem[] = j.items || [];
        // calcul
        const seenIds = new Set<number>();
        let episodes = 0;
        let minutes = 0;
        const genreCount = new Map<string, number>();
        for (const it of items) {
          const m = it.anime_data || {};
          const id = Number(m.id || it.anime_id);
          if (id && !seenIds.has(id)) seenIds.add(id);
          const eps = Number(m.episodes || 0);
          const dur = Number(m.duration || 24); // fallback 24 min
          episodes += eps;
          minutes += eps * dur;
          const genres: string[] = Array.isArray(m.genres) ? m.genres : [];
          for (const g of genres) genreCount.set(g, (genreCount.get(g)||0)+1);
        }
        let topGenre = '-';
        let max = 0;
        for (const [g, c] of genreCount.entries()) if (c > max) { max = c; topGenre = g; }

        setStats({
          totalAnime: seenIds.size,
          totalEpisodes: episodes,
          totalHours: Math.round(minutes/60),
          topGenre
        });
      } catch {
        // ignore
      }
    })();
  }, []);

  const watchedThumbs = useMemo(() => watchedMini.slice(0, 20), [watchedMini]);

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold mb-1">Profil</h1>
            <p className="text-sm opacity-70">Gère tes informations et tes animés vus.</p>
          </div>
        </div>
      </div>

      {loading && <div className="card p-4">Chargement…</div>}
      {!loading && err && <div className="card p-4 text-red-600">{err}</div>}

      {!loading && !err && (
        <>
          {/* Infos compte */}
          <div className="card p-4 space-y-4">
            <div className="font-medium">Informations du compte</div>

            <form className="flex flex-col sm:flex-row gap-3 items-start sm:items-end" onSubmit={saveUsername}>
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium mb-1">Pseudo</label>
                <div className="flex gap-2">
                  <input
                    className={`w-full border rounded-xl px-3 py-2 ${
                      nameAvailable === 'ok' ? 'border-green-500' :
                      nameAvailable === 'ko' ? 'border-red-500' :
                      nameAvailable === 'checking' ? 'border-yellow-500' : ''
                    }`}
                    placeholder="Ton pseudo"
                    value={username}
                    onChange={(e)=>setUsername(e.target.value)}
                  />
                  {nameAvailable === 'checking' && <span className="text-xs px-2 py-2">…</span>}
                  {nameAvailable === 'ok' && <span className="text-xs text-green-600 px-2 py-2">dispo</span>}
                  {nameAvailable === 'ko' && <span className="text-xs text-red-600 px-2 py-2">déjà pris</span>}
                </div>
              </div>
              <button className="btn btn-primary" disabled={busyName}>Sauvegarder</button>
            </form>

            <form className="flex flex-col sm:flex-row gap-3 items-start sm:items-end" onSubmit={saveEmail}>
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium mb-1">Adresse email</label>
                <input className="w-full border rounded-xl px-3 py-2"
                       type="email"
                       placeholder="Email"
                       value={newEmail}
                       onChange={(e)=>setNewEmail(e.target.value)} />
                <div className="text-xs opacity-70 mt-1">Email actuel : {meEmail}</div>
              </div>
              <button className="btn" disabled={busyEmail}>Mettre à jour</button>
            </form>

            <form className="flex flex-col sm:flex-row gap-3 items-start sm:items-end" onSubmit={savePwd}>
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium mb-1">Nouveau mot de passe</label>
                <input className="w-full border rounded-xl px-3 py-2"
                       type="password"
                       placeholder="••••••••"
                       value={pwd}
                       onChange={(e)=>setPwd(e.target.value)} />
              </div>
              <button className="btn" disabled={busyPwd}>Changer</button>
            </form>
          </div>

          {/* Animés vus */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Animés vus</div>
              <div className="flex items-center gap-2">
                <SearchBar onPick={addWatched} />
                <a className="btn" href="/watched">Afficher tout</a>
              </div>
            </div>

            {watchedThumbs.length === 0 ? (
              <div className="text-sm opacity-70">Aucun animé vu. Ajoute ton premier via la barre de recherche.</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {watchedThumbs.map((w) => {
                  const m = w.anime_data || {};
                  const cover = m?.coverImage?.large;
                  const title = m?.title?.english || m?.title?.romaji || w.anime_title;
                  return (
                    <div key={w.id} className="rounded-xl overflow-hidden border">
                      <img src={cover} alt={title} className="w-full h-40 object-cover" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Statistiques */}
          <div className="card p-4">
            <div className="font-medium mb-2">Statistiques</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border">
                <div className="text-xs opacity-70">Animés vus</div>
                <div className="text-lg font-semibold">{stats.totalAnime}</div>
              </div>
              <div className="p-3 rounded-xl border">
                <div className="text-xs opacity-70">Épisodes visionnés</div>
                <div className="text-lg font-semibold">{stats.totalEpisodes}</div>
              </div>
              <div className="p-3 rounded-xl border">
                <div className="text-xs opacity-70">Heures estimées</div>
                <div className="text-lg font-semibold">{stats.totalHours} h</div>
              </div>
              <div className="p-3 rounded-xl border">
                <div className="text-xs opacity-70">Genre le plus regardé</div>
                <div className="text-lg font-semibold">{stats.topGenre}</div>
              </div>
            </div>
            <div className="text-xs opacity-60 mt-2">
              * Calcul basé sur <em>episodes</em> × <em>duration</em> (minutes/épisode) fournis par AniList (valeurs manquantes ≈ 24 min/épisode).
            </div>
          </div>

          {/* Listes perso (visuelles) */}
          <div className="card p-4">
            <div className="font-medium mb-2">Créer une nouvelle liste</div>
            <form className="flex flex-col sm:flex-row gap-3 items-start sm:items-end" onSubmit={createList}>
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium mb-1">Nom</label>
                <input className="w-full border rounded-xl px-3 py-2"
                       placeholder="Mes favoris, À revoir…"
                       value={newListName}
                       onChange={(e)=>setNewListName(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input id="pub" type="checkbox" className="scale-110" checked={newListPublic}
                       onChange={(e)=>setNewListPublic(e.target.checked)} />
                <label htmlFor="pub" className="text-sm">Rendre publique</label>
              </div>
              <button className="btn btn-primary" disabled={creatingList}>
                {creatingList ? 'Création…' : 'Créer'}
              </button>
            </form>
          </div>

          <div className="card p-4">
            <div className="font-medium mb-2">Tes listes</div>
            {lists.length === 0 ? (
              <div className="text-sm opacity-70">Aucune liste pour le moment.</div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {lists.map((l) => (
                  <li key={l.id} className="p-3 border rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs opacity-70">
                        {l.is_global ? 'Liste générale' : (l.is_public ? 'Liste publique' : 'Liste privée')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a className="btn" href={`/lists?id=${encodeURIComponent(l.id)}`}>Voir</a>
                      {/* Supprimer (confirmation) */}
                      <button className="btn btn-danger" onClick={() => deleteList(l.id)}>
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-xs opacity-70 mt-2">
              Ces listes sont <strong>visuelles</strong> uniquement – elles n’entrent pas dans les statistiques.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
