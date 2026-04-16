/**
 * CRFPA Historique — merged list of past Syllogisme + Plan sessions.
 * Clicking a row navigates to the relevant coach (the coach's own history
 * sidebar displays the full list for in-page selection).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { History, ArrowRight, PenSquare, ListTree, FileText, BookMarked } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useProfileVertical } from '../hooks/useProfileVertical'
import {
  listSyllogismeSessions,
  type SyllogismeSessionView,
} from '../ai/coaching/syllogismeStore'
import { listPlanSessions, type PlanSessionView } from '../ai/coaching/planStore'
import { listFicheSessions, type FicheSessionView } from '../ai/coaching/ficheArretStore'
import { listCommentaireSessions, type CommentaireSessionView } from '../ai/coaching/commentaireStore'

type Filter = 'all' | 'syllogisme' | 'plan' | 'fiche' | 'commentaire'

interface Row {
  kind: 'syllogisme' | 'plan' | 'fiche' | 'commentaire'
  id: string
  primary: string       // theme / question / chamber
  secondary?: string    // difficulty / themeLabel / reference
  score?: number
  maxScore: number      // 30 for syllogisme+plan, 25 for fiche+commentaire
  status: 'en-cours' | 'soumis' | 'corrigé'
  createdAt: string
}

const FALLBACK_PROFILE_ID = 'legal-chat'

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`
  return `il y a ${Math.floor(days / 30)} mois`
}

function toRow(s: SyllogismeSessionView): Row {
  return {
    kind: 'syllogisme',
    id: s.id,
    primary: s.task.theme,
    secondary: s.task.difficulty,
    score: s.grading?.overall.score,
    maxScore: 30,
    status: s.grading ? 'corrigé' : s.submission ? 'soumis' : 'en-cours',
    createdAt: s.createdAt,
  }
}

function toRowPlan(p: PlanSessionView): Row {
  return {
    kind: 'plan',
    id: p.id,
    primary: p.task.question,
    secondary: p.task.themeLabel,
    score: p.grading?.overall.score,
    maxScore: 30,
    status: p.grading ? 'corrigé' : p.submission ? 'soumis' : 'en-cours',
    createdAt: p.createdAt,
  }
}

function toRowFiche(f: FicheSessionView): Row {
  return {
    kind: 'fiche',
    id: f.id,
    primary: f.task.decision.chamber,
    secondary: f.task.decision.reference,
    score: f.grading?.overall.score,
    maxScore: 25,
    status: f.grading ? 'corrigé' : f.submission ? 'soumis' : 'en-cours',
    createdAt: f.createdAt,
  }
}

function toRowCommentaire(c: CommentaireSessionView): Row {
  return {
    kind: 'commentaire',
    id: c.id,
    primary: c.task.decision.chamber,
    secondary: c.task.decision.reference,
    score: c.grading?.overall.score,
    maxScore: 25,
    status: c.grading ? 'corrigé' : c.submission ? 'soumis' : 'en-cours',
    createdAt: c.createdAt,
  }
}

export default function CRFPAHistorique() {
  const { activeProfile } = useExamProfile()
  const { isCRFPA } = useProfileVertical()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [syllogismes, setSyllogismes] = useState<SyllogismeSessionView[]>([])
  const [plans, setPlans] = useState<PlanSessionView[]>([])
  const [fiches, setFiches] = useState<FicheSessionView[]>([])
  const [commentaires, setCommentaires] = useState<CommentaireSessionView[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listSyllogismeSessions(examProfileId),
      listPlanSessions(examProfileId),
      listFicheSessions(examProfileId),
      listCommentaireSessions(examProfileId),
    ]).then(([s, p, f, c]) => {
      if (cancelled) return
      setSyllogismes(s)
      setPlans(p)
      setFiches(f)
      setCommentaires(c)
    })
    return () => { cancelled = true }
  }, [examProfileId])

  const rows: Row[] = useMemo(() => {
    const all = [
      ...syllogismes.map(toRow),
      ...plans.map(toRowPlan),
      ...fiches.map(toRowFiche),
      ...commentaires.map(toRowCommentaire),
    ]
    const filtered = filter === 'all' ? all : all.filter(r => r.kind === filter)
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [syllogismes, plans, fiches, commentaires, filter])

  if (!isCRFPA) return <Navigate to="/dashboard" replace />

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fade-in">
      <Helmet>
        <title>Historique — CRFPA | StudiesKit</title>
      </Helmet>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
          <History className="w-5 h-5 text-[var(--accent-text)]" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
            Historique
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Tes entraînements passés et leurs corrections.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--border-card)]">
        {(['all', 'syllogisme', 'plan', 'fiche', 'commentaire'] as Filter[]).map(f => {
          const label = f === 'all' ? 'Tous'
            : f === 'syllogisme' ? 'Syllogismes'
            : f === 'plan' ? 'Plans'
            : f === 'fiche' ? 'Fiches'
            : 'Commentaires'
          const count = f === 'all' ? rows.length : 0  // count shown only on "all"
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
                active
                  ? 'border-[var(--accent-text)] text-[var(--accent-text)] font-medium'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'
              }`}
            >
              {label}
              {f === 'all' && count > 0 && (
                <span className="ml-2 text-xs text-[var(--text-muted)]">({count})</span>
              )}
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-[var(--text-muted)]">
            Pas encore d'entraînements.
          </p>
          <Link
            to="/accueil"
            className="inline-block mt-4 text-sm text-[var(--accent-text)] hover:underline"
          >
            Retour à l'accueil
          </Link>
        </div>
      ) : (
        <div className="glass-card divide-y divide-[var(--border-card)]">
          {rows.map(r => {
            const base = r.kind === 'syllogisme' ? '/legal/syllogisme'
              : r.kind === 'plan' ? '/legal/plan'
              : r.kind === 'fiche' ? '/legal/fiche'
              : '/legal/commentaire'
            const href = `${base}?session=${r.id}`
            const Icon = r.kind === 'syllogisme' ? PenSquare
              : r.kind === 'plan' ? ListTree
              : r.kind === 'fiche' ? FileText
              : BookMarked
            const kindLabel = r.kind === 'syllogisme' ? 'Syllogisme'
              : r.kind === 'plan' ? 'Plan'
              : r.kind === 'fiche' ? 'Fiche d\'arrêt'
              : 'Commentaire'
            return (
              <Link
                key={r.id}
                to={href}
                className="flex items-center gap-3 p-4 hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[var(--accent-text)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
                      {kindLabel}
                      {r.secondary && ` · ${r.secondary}`}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-sm font-medium text-[var(--text-heading)] truncate">
                    {r.primary}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
                    {relativeTime(r.createdAt)}
                    {r.score !== undefined && ` · ${r.score}/${r.maxScore}`}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Row['status'] }) {
  const styles =
    status === 'corrigé' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
    : status === 'soumis' ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
    : 'text-[var(--text-muted)] bg-[var(--bg-hover)]'
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${styles}`}>
      {status}
    </span>
  )
}
