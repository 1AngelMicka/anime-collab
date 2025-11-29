// src/app/proposals/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import SearchBar from '@/components/SearchBar'
import AnimeCard from '@/components/AnimeCard'

type UserInfo = { id: string | null; email?: string | null }
type RawStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'approved'
type Proposal = {
  id: string
  list_id: string
  user_id: string
  anime_id: number
  anime_title: string
  anime_data: any
  status: RawStatus
  created_at: string
  proposer_username?: string | null
}
type ListInfo = {
  id: string
  name: string
  is_public: boolean
  is_global: boolean
  owner_id?: string
  group_id?: string
}

function normalizeStatus(s: RawStatus): 'pending' | 'accepted' | 'rejected' | 'cancelled' {
  if (s === 'approved') return 'accepted'
  return s as any
}

export default function ProposalsPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const listId = sp.get('list_id')

  const [me, setMe] = useState<UserInfo | null>(null)
  const [loadingMe, setLoadingMe] = useState(true)
  const canAct = !!me?.id

  const [list, setList] = useState<ListInfo | null>(null)
  const [isOwner, setIsOwner] = useState<boolean>(false)
  const [isMember, setIsMember] = useState<boolean>(false)

  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!listId) { router.replace('/profile'); return }
    ;(async () => {
      setLoadingMe(true)
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' })
        const j = await r.json().catch(()=>({user:null}))
        setMe(j.user || null)
      } finally {
        setLoadingMe(false)
      }
    })()
  }, [listId, router])

  async function loadAll(targetId: string) {
    setErr(null)
    setLoading(true)
    try {
      // list + flags is_owner / is_member
      const infoR = await fetch(`/api/lists/info?id=${encodeURIComponent(targetId)}`, { cache: 'no-store' })
      const infoJ = await infoR.json().catch(()=>({}))
      setList(infoJ.list || null)
      setIsOwner(!!infoJ.is_owner)
      setIsMember(!!infoJ.is_member)

      // proposals (normaliser les statuts legacy "approved" -> "accepted")
      const pR = await fetch(`/api/proposals?list_id=${encodeURIComponent(targetId)}`, { cache: 'no-store' })
      const pJ = await pR.json().catch(()=>({ proposals: [] }))
      const rows: Proposal[] = (pJ.proposals || []).map((p: Proposal) => ({
        ...p,
        status: normalizeStatus(p.status),
      }))
      setProposals(rows)
    } catch {
      setErr('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!listId) return
    loadAll(listId)
  }, [listId])

  // ===== Actions =====
  async function onPick(media: any): Promise<boolean> {
    if (!listId) return false
    if (!canAct) { alert('Tu dois être connecté pour proposer.'); return false }

    const r = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: listId, anime: media })
    })
    const j = await r.json().catch(()=> ({}))
    if (!r.ok) { alert(j.error || 'Erreur'); return false }
    await loadAll(listId)
    return true
  }

  async function updateStatus(id: string, status: 'accepted'|'rejected'|'pending'|'cancelled') {
    if (!canAct) { alert('Tu dois être connecté pour effectuer cette action.'); return }
    const r = await fetch('/api/proposals/update', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id, status })
    })
    const j = await r.json().catch(()=> ({}))
    if (!r.ok) {
      // fallback delete si on voulait annuler mais que le serveur refuse le soft-cancel
      if (status === 'cancelled') {
        try {
          const r2 = await fetch('/api/proposals', {
            method: 'DELETE',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ id })
          })
          if (!r2.ok) {
            const j2 = await r2.json().catch(()=> ({}))
            alert(j2.error || j.error || 'Erreur')
            return
          }
        } catch {
          alert(j.error || 'Erreur')
          return
        }
      } else {
        alert(j.error || 'Erreur')
        return
      }
    }
    if (listId) await loadAll(listId)
  }

  const byStatus = useMemo(() => {
    const groups: Record<'pending'|'accepted'|'rejected', Proposal[]> = {
      pending: [],
      accepted: [],
      rejected: []
    }
    for (const p of proposals) {
      const s = normalizeStatus(p.status)
      if (s === 'pending') groups.pending.push(p)
      else if (s === 'accepted') groups.accepted.push(p)
      else if (s === 'rejected') groups.rejected.push(p)
      // on masque 'cancelled'
    }
    return groups
  }, [proposals])

  if (!listId) return <div className="card p-4">Paramètre <code>list_id</code> manquant.</div>
  if (loading || loadingMe) return <div className="card p-4">Chargement…</div>
  if (err) return <div className="card p-4 text-red-600">{err}</div>

  const publicOrGlobal = !!(list?.is_public || list?.is_global)

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-xl font-semibold">Propositions – {list?.name ?? 'Liste'}</div>
        <div className="text-xs opacity-70">
          {list?.is_global ? 'Liste générale' : (list?.is_public ? 'Liste publique' : 'Liste privée')}
        </div>
        <div className="mt-2 flex gap-2 text-xs">
          {isOwner && <span className="badge">Owner</span>}
          {isMember && <span className="badge">Membre</span>}
          {!isMember && publicOrGlobal && <span className="badge">Accès public</span>}
        </div>
      </div>

      {/* Barre de recherche pour proposer */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium mb-2">Proposer un animé</div>
          {!canAct && <a className="btn" href="/auth">Se connecter</a>}
        </div>
        {canAct ? (
          <SearchBar onPick={onPick} />
        ) : (
          <div className="text-sm opacity-70">Connecte-toi pour soumettre une proposition.</div>
        )}
      </div>

      {/* En attente */}
      <Section
        title={`En attente (${byStatus.pending.length})`}
        empty="Aucune proposition en attente."
      >
        {byStatus.pending.map((p) => (
          <ProposalRow
            key={p.id}
            p={p}
            meId={me?.id || null}
            isOwner={isOwner}
            isMemberOrPublic={isMember || publicOrGlobal}
            onAccept={() => updateStatus(p.id, 'accepted')}
            onReject={() => updateStatus(p.id, 'rejected')}
            onCancel={() => updateStatus(p.id, 'cancelled')}
          />
        ))}
      </Section>

      {/* Acceptées */}
      <Section
        title={`Acceptées (${byStatus.accepted.length})`}
        empty="Aucune proposition acceptée."
      >
        {byStatus.accepted.map((p) => (
          <ProposalRow
            key={p.id}
            p={p}
            meId={me?.id || null}
            isOwner={isOwner}
            isMemberOrPublic={isMember || publicOrGlobal}
            // option : l'owner peut remettre en "pending"
            onAccept={() => updateStatus(p.id, 'pending')}
            onReject={() => updateStatus(p.id, 'rejected')}
            onCancel={() => updateStatus(p.id, 'cancelled')}
          />
        ))}
      </Section>

      {/* Refusées */}
      <Section
        title={`Refusées (${byStatus.rejected.length})`}
        empty="Aucune proposition refusée."
      >
        {byStatus.rejected.map((p) => (
          <ProposalRow
            key={p.id}
            p={p}
            meId={me?.id || null}
            isOwner={isOwner}
            isMemberOrPublic={isMember || publicOrGlobal}
            onAccept={() => updateStatus(p.id, 'accepted')}
            onReject={() => updateStatus(p.id, 'pending')}
            onCancel={() => updateStatus(p.id, 'cancelled')}
          />
        ))}
      </Section>
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="font-medium mb-2">{title}</div>
      {Array.isArray(children) && children.length === 0 ? (
        <div className="text-sm opacity-70">{empty}</div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  )
}

function ProposalRow({
  p, meId, isOwner, isMemberOrPublic, onAccept, onReject, onCancel
}: {
  p: Proposal
  meId: string | null
  isOwner: boolean
  isMemberOrPublic: boolean
  onAccept: () => void
  onReject: () => void
  onCancel: () => void
}) {
  const m = p.anime_data || {}
  const title = m?.title?.english || m?.title?.romaji || p.anime_title
  const meta = [
    m?.format,
    m?.episodes ? `${m.episodes} épisodes` : null,
    Array.isArray(m?.genres) ? m.genres.slice(0, 3).join(' · ') : null
  ].filter(Boolean).join(' • ')
  const cover = m?.coverImage?.large

  const status = normalizeStatus(p.status)
  const isProposer = !!meId && meId === p.user_id

  // ✅ Important : pour affichage des boutons on autorise Membre OU Public/Global (sécurité côté API)
  const canVote = status === 'pending' && !!meId && isMemberOrPublic && !isProposer
  const canCancel = status === 'pending' && !!meId && (isProposer || isOwner)

  return (
    <AnimeCard cover={cover} title={title} meta={meta}>
      <div className="text-xs opacity-60 pr-2">
        Par {p.proposer_username ?? '—'} • {new Date(p.created_at).toLocaleDateString()}
      </div>
      <div className="flex items-center gap-2">
        {canVote && (
          <>
            <button className="btn" onClick={onAccept} title="Valider">
              Valider
            </button>
            <button className="btn" onClick={onReject} title="Refuser">
              Refuser
            </button>
          </>
        )}
        {canCancel && (
          <button className="btn btn-danger" onClick={onCancel} title="Annuler la proposition">
            Annuler
          </button>
        )}
      </div>
    </AnimeCard>
  )
}
