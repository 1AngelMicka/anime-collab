// src/components/Proposals.tsx
'use client'

import AnimeCard from '@/components/AnimeCard'
import { useMemo } from 'react'

export type RawStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'approved'
export type Proposal = {
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

function normalizeStatus(s: RawStatus): 'pending' | 'accepted' | 'rejected' | 'cancelled' {
  if (s === 'approved') return 'accepted'
  return s as any
}

export default function Proposals({
  meId,
  isOwner,
  isMemberOrPublic,
  proposals,
  onUpdateStatus,
}: {
  meId: string | null
  isOwner: boolean
  /** true si membre ou accès public; false si non-membre; undefined si inconnu (RLS) */
  isMemberOrPublic?: boolean
  proposals: Proposal[]
  onUpdateStatus: (id: string, status: 'accepted'|'rejected'|'pending'|'cancelled') => void
}) {
  const groups = useMemo(() => {
    const g: Record<'pending'|'accepted'|'rejected', Proposal[]> = { pending: [], accepted: [], rejected: [] }
    for (const p of proposals) {
      const s = normalizeStatus(p.status)
      if (s === 'pending') g.pending.push(p)
      else if (s === 'accepted') g.accepted.push(p)
      else if (s === 'rejected') g.rejected.push(p)
      // on masque 'cancelled'
    }
    return g
  }, [proposals])

  return (
    <>
      <Section title={`En attente (${groups.pending.length})`} empty="Aucune proposition en attente.">
        {groups.pending.map((p) => (
          <Row
            key={p.id}
            p={p}
            meId={meId}
            isOwner={isOwner}
            isMemberOrPublic={isMemberOrPublic}
            onAccept={() => onUpdateStatus(p.id, 'accepted')}
            onReject={() => onUpdateStatus(p.id, 'rejected')}
            onCancel={() => onUpdateStatus(p.id, 'cancelled')}
          />
        ))}
      </Section>

      <Section title={`Acceptées (${groups.accepted.length})`} empty="Aucune proposition acceptée.">
        {groups.accepted.map((p) => (
          <Row
            key={p.id}
            p={p}
            meId={meId}
            isOwner={isOwner}
            isMemberOrPublic={isMemberOrPublic}
            // option: owner peut remettre en pending
            onAccept={() => onUpdateStatus(p.id, 'pending')}
            onReject={() => onUpdateStatus(p.id, 'rejected')}
            onCancel={() => onUpdateStatus(p.id, 'cancelled')}
          />
        ))}
      </Section>

      <Section title={`Refusées (${groups.rejected.length})`} empty="Aucune proposition refusée.">
        {groups.rejected.map((p) => (
          <Row
            key={p.id}
            p={p}
            meId={meId}
            isOwner={isOwner}
            isMemberOrPublic={isMemberOrPublic}
            onAccept={() => onUpdateStatus(p.id, 'accepted')}
            onReject={() => onUpdateStatus(p.id, 'pending')}
            onCancel={() => onUpdateStatus(p.id, 'cancelled')}
          />
        ))}
      </Section>
    </>
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

function Row({
  p, meId, isOwner, isMemberOrPublic, onAccept, onReject, onCancel
}: {
  p: Proposal
  meId: string | null
  isOwner: boolean
  isMemberOrPublic?: boolean
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

  // 🎯 Si isMemberOrPublic est "inconnu" (undefined), on n’empêche PAS l’affichage des boutons pour user connecté ≠ auteur.
  const membershipUnknown = typeof isMemberOrPublic === 'undefined'
  const canVote = status === 'pending' && !!meId && !isProposer && (isMemberOrPublic || membershipUnknown)
  const canCancel = status === 'pending' && !!meId && (isProposer || isOwner)

  return (
    <AnimeCard cover={cover} title={title} meta={meta}>
      <div className="text-xs opacity-60 pr-2">
        Par {p.proposer_username ?? '—'} • {new Date(p.created_at).toLocaleDateString()}
      </div>
      <div className="flex items-center gap-2">
        {canVote && (
          <>
            <button className="btn" onClick={onAccept} title="Valider">Valider</button>
            <button className="btn" onClick={onReject} title="Refuser">Refuser</button>
          </>
        )}
        {canCancel && (
          <button className="btn btn-danger" onClick={onCancel} title="Annuler la proposition">Annuler</button>
        )}
      </div>
    </AnimeCard>
  )
}
