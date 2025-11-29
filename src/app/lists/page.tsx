// src/app/lists/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import SearchBar from '@/components/SearchBar'

type List = { id: string; name: string; is_public: boolean; is_global: boolean; created_at?: string }
type Item = { id: string; anime_id: number; anime_title: string; anime_data: any; created_at: string }
type Watched = Item
type UserInfo = { id: string | null; email?: string | null }

export default function ListPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const listId = sp.get('id')

  const [me, setMe] = useState<UserInfo | null>(null)
  const [list, setList] = useState<List | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMe, setLoadingMe] = useState(true)
  const isWatched = useMemo(() => list?.name === 'Animés vus', [list?.name])
  const canAct = !!me?.id // règle UI : actions seulement si connecté

  // Charge session utilisateur
  useEffect(() => {
    (async () => {
      setLoadingMe(true)
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' })
        const j = await r.json().catch(() => ({ user: null }))
        setMe(j.user || null)
      } finally {
        setLoadingMe(false)
      }
    })()
  }, [])

  async function loadAll(targetId: string) {
    // Infos liste
    const r = await fetch(`/api/lists/info?id=${encodeURIComponent(targetId)}`, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    setList(j.list || null)

    if (!j?.list) { setItems([]); return }

    if (j.list.name === 'Animés vus') {
      // contenus depuis watched (endpoint ids/items)
      const r2 = await fetch(`/api/watched/ids?list_id=${encodeURIComponent(targetId)}`, { cache: 'no-store' })
      const j2 = await r2.json().catch(() => ({ items: [] }))
      setItems(j2.items || [])
    } else {
      const r3 = await fetch(`/api/list-items?list_id=${encodeURIComponent(targetId)}`, { cache: 'no-store' })
      const j3 = await r3.json().catch(() => ({ items: [] }))
      setItems(j3.items || [])
    }
  }

  useEffect(() => {
    if (!listId) { router.replace('/profile'); return }
    ;(async () => {
      setLoading(true)
      try {
        await loadAll(listId)
      } finally {
        setLoading(false)
      }
    })()
  }, [listId, router])

  async function onPick(media: any): Promise<boolean> {
    if (!listId) return false
    if (!canAct) { alert('Tu dois être connecté pour effectuer cette action.'); return false }

    if (isWatched) {
      // ajoute via /api/watched
      const r = await fetch('/api/watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime: media })
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert(j.error || 'Erreur')
        return false
      }
      await loadAll(listId)
      return true
    } else {
      const r = await fetch('/api/list-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: listId, anime: media })
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert(j.error || 'Erreur')
        return false
      }
      await loadAll(listId)
      return true
    }
  }

  async function removeItem(idOrAnimeId: string | number) {
    if (!listId) return
    if (!canAct) { alert('Tu dois être connecté pour effectuer cette action.'); return }

    if (isWatched) {
      await fetch('/api/watched', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime_id: idOrAnimeId })
      })
    } else {
      await fetch('/api/list-items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idOrAnimeId })
      })
    }
    await loadAll(listId)
  }

  if (loading || loadingMe) return <div className="card p-4">Chargement…</div>
  if (!list) return <div className="card p-4">Liste introuvable.</div>

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-xl font-semibold">{list.name}</div>
        <div className="text-xs opacity-70">
          {list.is_global ? 'Liste générale' : (list.is_public ? 'Liste publique' : 'Liste privée')}
        </div>
      </div>

      {/* Barre de recherche pour ajouter à la liste — visible uniquement si connecté */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium mb-2">Ajouter un animé</div>
          {!canAct && <a className="btn" href="/auth">Se connecter</a>}
        </div>
        {canAct ? (
          <SearchBar onPick={onPick} />
        ) : (
          <div className="text-sm opacity-70">
            Connecte-toi pour ajouter des animés à cette liste.
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="font-medium mb-2">Contenu ({items.length})</div>
        {items.length === 0 ? (
          <div className="text-sm opacity-70">Aucun animé ici pour le moment.</div>
        ) : (
          <ul className="space-y-2">
            {items.map(it => {
              const m = it.anime_data
              const title = m?.title?.english || m?.title?.romaji || it.anime_title
              const meta = [
                m?.format,
                m?.episodes ? `${m.episodes} épisodes` : null,
                m?.genres?.slice(0, 3)?.join(' · ')
              ].filter(Boolean).join(' • ')
              const cover = m?.coverImage?.large
              return (
                <li key={it.id} className="p-3 border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {cover && <img src={cover} className="w-14 h-20 rounded-xl object-cover" alt="" />}
                    <div>
                      <div className="font-medium">{title}</div>
                      <div className="text-xs opacity-70">{meta}</div>
                    </div>
                  </div>
                  {/* Bouton Retirer — visible/actif uniquement si connecté */}
                  <button
                    className={`btn ${canAct ? 'btn-danger' : 'btn-disabled opacity-60 cursor-not-allowed'}`}
                    onClick={() => canAct ? removeItem(isWatched ? it.anime_id : it.id) : null}
                    title={canAct ? 'Retirer de la liste' : 'Connexion requise'}
                    disabled={!canAct}
                  >
                    Retirer
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
