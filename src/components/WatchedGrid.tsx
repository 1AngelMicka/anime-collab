"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";

type UserInfo = { id: string | null; email?: string | null };

// Structure renvoyée par GET /api/watched (chez toi)
type WatchedItem = {
  id: string;
  anime_id: number;
  anime_title: string;
  anime_data: any;
  created_at: string;
};

// Listes perso (pour ajouter depuis /watched)
type ListMini = { id: string; name: string; is_public: boolean; is_global: boolean };

export default function WatchedGrid() {
  const [me, setMe] = useState<UserInfo | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [items, setItems] = useState<WatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<"recent" | "alpha">("recent");

  const [current, setCurrent] = useState<WatchedItem | null>(null);

  // listes pour ajout
  const [lists, setLists] = useState<ListMini[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  const canAct = !!me?.id; // règle UI : actions seulement si connecté

  // Charger l'état de connexion
  useEffect(() => {
    (async () => {
      setLoadingMe(true);
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j = await r.json().catch(() => ({ user: null }));
        setMe(j.user || null);
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  // Charger les animés vus
  async function loadWatched() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/watched?limit=100`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error || "Impossible de charger les animés vus.");
        setItems([]);
      } else {
        setItems(j.items || []);
      }
    } catch {
      setError("Erreur réseau.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWatched();
  }, []);

  // Charger les listes de l’utilisateur (pour ajouter depuis /watched)
  async function loadLists() {
    setLoadingLists(true);
    try {
      const r = await fetch("/api/lists", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setLists(j.lists || []);
    } finally {
      setLoadingLists(false);
    }
  }

  // suppression d’un “vu”
  async function removeWatched(anime_id: number) {
    if (!canAct) {
      alert("Tu dois être connecté pour effectuer cette action.");
      return;
    }
    const prev = items;
    // Optimiste
    setItems((cur) => cur.filter((i) => i.anime_id !== anime_id));
    try {
      const r = await fetch("/api/watched", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anime_id }),
      });
      if (!r.ok) throw new Error();
    } catch {
      // rollback
      setItems(prev);
      alert("Suppression impossible (rollback).");
    }
  }

  // ajouter l’anime courant à une liste
  async function addCurrentToList(listId: string, anime: any) {
    if (!canAct) {
      alert("Tu dois être connecté pour effectuer cette action.");
      return;
    }
    try {
      const r = await fetch("/api/list-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_id: listId, anime }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error || "Erreur lors de l’ajout.");
        return;
      }
      alert("Ajouté à la liste ✅");
    } catch {
      alert("Erreur réseau.");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === "alpha") {
      return copy.sort((a, b) => {
        const ta =
          a.anime_data?.title?.english ||
          a.anime_data?.title?.romaji ||
          a.anime_title ||
          "";
        const tb =
          b.anime_data?.title?.english ||
          b.anime_data?.title?.romaji ||
          b.anime_title ||
          "";
        return ta.localeCompare(tb);
      });
    }
    // recent (created_at DESC)
    return copy.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [items, sort]);

  if (loading || loadingMe) {
    return <div className="text-sm opacity-70">Chargement…</div>;
  }
  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-80">Tri</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-md bg-zinc-900 text-zinc-100 px-2 py-1 border border-zinc-700"
          >
            <option value="recent">Récents</option>
            <option value="alpha">Alphabétique</option>
          </select>
        </div>

        {!canAct && (
          <a className="btn" href="/auth">
            Se connecter
          </a>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-sm opacity-70">
          Aucun animé vu. {canAct ? "Ajoute-en depuis ton profil/lists." : "Connecte-toi pour commencer à ajouter."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {sorted.map((it) => {
            const m = it.anime_data || {};
            const cover = m?.coverImage?.large;
            const title =
              m?.title?.english || m?.title?.romaji || it.anime_title || "Sans titre";
            const genres: string[] = Array.isArray(m?.genres) ? m.genres : [];
            return (
              <div
                key={it.id}
                className="group relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow hover:shadow-lg transition cursor-pointer"
                onClick={() => {
                  setCurrent(it);
                  if (canAct && lists.length === 0) loadLists();
                }}
              >
                {cover ? (
                  <img src={cover} alt={title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 grid place-items-center text-xs opacity-60">Pas d’image</div>
                )}
                <div className="p-2">
                  <div className="font-medium text-sm line-clamp-2 text-zinc-100">{title}</div>
                </div>

                {/* bouton supprimer (seulement si connecté) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canAct) removeWatched(it.anime_id);
                  }}
                  title={canAct ? "Retirer des vus" : "Connexion requise"}
                  disabled={!canAct}
                  className={`absolute right-2 top-2 rounded-full w-8 h-8 grid place-items-center transition ${
                    canAct
                      ? "bg-white/90 text-zinc-900 opacity-0 group-hover:opacity-100"
                      : "bg-zinc-700 text-zinc-300 opacity-80 cursor-not-allowed"
                  }`}
                >
                  🗑️
                </button>

                {/* genres badge */}
                {genres?.length > 0 && (
                  <div className="absolute left-2 top-2 bg-black/70 text-white text-xs rounded px-2 py-0.5">
                    {genres[0]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal détails + ajout à d'autres listes (si connecté) */}
      <Modal open={!!current} onClose={() => setCurrent(null)} title={current ? (current.anime_data?.title?.english || current.anime_data?.title?.romaji || current.anime_title) : ""}>
        {current && (
          <div className="space-y-3">
            {current.anime_data?.description && (
              <p className="text-sm opacity-80">{stripHTML(current.anime_data.description)}</p>
            )}
            {current.anime_data?.genres && (
              <div className="flex flex-wrap gap-2">
                {current.anime_data.genres.map((g: string) => (
                  <span key={g} className="text-xs bg-zinc-800 text-zinc-200 rounded px-2 py-0.5">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {canAct ? (
              <>
                <div className="pt-2 font-medium">Ajouter à une liste :</div>
                {loadingLists ? (
                  <div className="text-sm opacity-70">Chargement des listes…</div>
                ) : lists.length === 0 ? (
                  <div className="text-sm opacity-70">Aucune liste trouvée. Crée une liste dans ton profil.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {lists
                      .filter((l) => !l.is_global) // on évite d'ajouter dans les globales
                      .map((l) => (
                        <button
                          key={l.id}
                          className="px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm"
                          onClick={() => addCurrentToList(l.id, current.anime_data)}
                        >
                          {l.name}
                        </button>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm opacity-70">Connecte-toi pour ajouter cet animé à tes listes.</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// petite utilité pour nettoyer une description HTML éventuelle
function stripHTML(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "");
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent || el.innerText || "";
}
