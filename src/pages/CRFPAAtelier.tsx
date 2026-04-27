/**
 * CRFPA Atelier — the home of the CRFPA vertical.
 * Action-chip canvas. No productivity dashboard. No streaks. No "you're late."
 * Only personalization: an optional "Reprendre" card if she has in-progress work,
 * and a small "last 3 exercises" strip at the bottom (scores, no comparison).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useUser } from '@clerk/clerk-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PenSquare, ListTree, FileText, BookMarked, Scale, FolderOpen, RotateCcw, ArrowRight, Upload, FileCheck, Mic2, NotebookPen } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useProfileVertical } from '../hooks/useProfileVertical'
import { listSyllogismeSessions, type SyllogismeSessionView } from '../ai/coaching/syllogismeStore'
import { listPlanSessions, type PlanSessionView } from '../ai/coaching/planStore'
import { listFicheSessions, type FicheSessionView } from '../ai/coaching/ficheArretStore'
import { listCommentaireSessions, type CommentaireSessionView } from '../ai/coaching/commentaireStore'
import { listCasPratiqueSessions, type CasPratiqueSessionView } from '../ai/coaching/casPratiqueStore'
import { listNoteSyntheseSessions, type NoteSyntheseSessionView } from '../ai/coaching/noteSyntheseStore'
import { db } from '../db'

type RecentItem =
  | { kind: 'syllogisme'; id: string; title: string; score?: number; createdAt: string }
  | { kind: 'plan'; id: string; title: string; score?: number; createdAt: string }
  | { kind: 'fiche'; id: string; title: string; score?: number; createdAt: string }
  | { kind: 'commentaire'; id: string; title: string; score?: number; createdAt: string }
  | { kind: 'cas-pratique'; id: string; title: string; score?: number; createdAt: string }
  | { kind: 'note-synthese'; id: string; title: string; score?: number; createdAt: string }

const FALLBACK_PROFILE_ID = 'legal-chat'

export default function CRFPAAtelier() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { activeProfile } = useExamProfile()
  const { isCRFPA } = useProfileVertical()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [syllogismes, setSyllogismes] = useState<SyllogismeSessionView[]>([])
  const [plans, setPlans] = useState<PlanSessionView[]>([])
  const [fiches, setFiches] = useState<FicheSessionView[]>([])
  const [commentaires, setCommentaires] = useState<CommentaireSessionView[]>([])
  const [casPratiques, setCasPratiques] = useState<CasPratiqueSessionView[]>([])
  const [notesSynthese, setNotesSynthese] = useState<NoteSyntheseSessionView[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listSyllogismeSessions(examProfileId),
      listPlanSessions(examProfileId),
      listFicheSessions(examProfileId),
      listCommentaireSessions(examProfileId),
      listCasPratiqueSessions(examProfileId),
      listNoteSyntheseSessions(examProfileId),
    ]).then(([s, p, f, c, cp, ns]) => {
      if (cancelled) return
      setSyllogismes(s)
      setPlans(p)
      setFiches(f)
      setCommentaires(c)
      setCasPratiques(cp)
      setNotesSynthese(ns)
    })
    return () => { cancelled = true }
  }, [examProfileId])

  // Optional countdown — memoized; recomputes only when the exam date changes.
  const daysUntilExam = useMemo<number | null>(() => {
    if (!activeProfile?.examDate) return null
    // eslint-disable-next-line react-hooks/purity -- Date.now() inside useMemo is cached by deps
    const diff = new Date(activeProfile.examDate).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / 86400000))
  }, [activeProfile?.examDate])

  // Recent documents — live query so uploads appear without a manual refresh
  const recentDocs = useLiveQuery(
    async () => {
      if (!activeProfile?.id) return []
      const docs = await db.documents
        .where('examProfileId').equals(activeProfile.id)
        .reverse()
        .sortBy('createdAt')
      return docs.slice(0, 4)
    },
    [activeProfile?.id],
  ) ?? []

  // Non-CRFPA users should not land here
  if (!isCRFPA) return <Navigate to="/dashboard" replace />

  const firstName = user?.firstName
  const showCountdown = daysUntilExam !== null && daysUntilExam > 0 && daysUntilExam <= 120

  // In-progress: a session with submission but no grading
  const inProgressSyllogisme = syllogismes.find(s => s.submission && !s.grading)
  const inProgressPlan = plans.find(p => p.submission && !p.grading)
  const inProgressFiche = fiches.find(f => f.submission && !f.grading)
  const inProgressCommentaire = commentaires.find(c => c.submission && !c.grading)
  const inProgressCasPratique = casPratiques.find(c => c.submission && !c.grading)
  const inProgressSynthese = notesSynthese.find(n => n.task && !n.generating && n.submission && !n.grading)
  const inProgress = inProgressSyllogisme
    ? { kind: 'syllogisme' as const, id: inProgressSyllogisme.id, title: inProgressSyllogisme.task.theme }
    : inProgressPlan
    ? { kind: 'plan' as const, id: inProgressPlan.id, title: inProgressPlan.task.themeLabel }
    : inProgressFiche
    ? { kind: 'fiche' as const, id: inProgressFiche.id, title: inProgressFiche.task.decision.chamber }
    : inProgressCommentaire
    ? { kind: 'commentaire' as const, id: inProgressCommentaire.id, title: inProgressCommentaire.task.decision.chamber }
    : inProgressCasPratique
    ? { kind: 'cas-pratique' as const, id: inProgressCasPratique.id, title: inProgressCasPratique.task.specialtyLabel }
    : inProgressSynthese
    ? { kind: 'note-synthese' as const, id: inProgressSynthese.id, title: inProgressSynthese.task!.dossierTitle }
    : null

  // Recent 3 graded
  const recent: RecentItem[] = [
    ...syllogismes
      .filter(s => s.grading)
      .map(s => ({
        kind: 'syllogisme' as const,
        id: s.id,
        title: s.task.theme,
        score: s.grading!.overall.score,
        createdAt: s.createdAt,
      })),
    ...plans
      .filter(p => p.grading)
      .map(p => ({
        kind: 'plan' as const,
        id: p.id,
        title: p.task.question,
        score: p.grading!.overall.score,
        createdAt: p.createdAt,
      })),
    ...fiches
      .filter(f => f.grading)
      .map(f => ({
        kind: 'fiche' as const,
        id: f.id,
        title: f.task.decision.chamber,
        score: f.grading!.overall.score,
        createdAt: f.createdAt,
      })),
    ...commentaires
      .filter(c => c.grading)
      .map(c => ({
        kind: 'commentaire' as const,
        id: c.id,
        title: c.task.decision.chamber,
        score: c.grading!.overall.score,
        createdAt: c.createdAt,
      })),
    ...casPratiques
      .filter(c => c.grading)
      .map(c => ({
        kind: 'cas-pratique' as const,
        id: c.id,
        title: c.task.specialtyLabel,
        score: c.grading!.overall.score,
        createdAt: c.createdAt,
      })),
    ...notesSynthese
      .filter(n => n.grading)
      .map(n => ({
        kind: 'note-synthese' as const,
        id: n.id,
        title: n.task?.dossierTitle ?? 'Note de synthèse',
        score: n.grading!.overall.score,
        createdAt: n.createdAt,
      })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)

  const handleResume = () => {
    if (!inProgress) return
    const base = inProgress.kind === 'syllogisme' ? '/legal/syllogisme'
      : inProgress.kind === 'plan' ? '/legal/plan'
      : inProgress.kind === 'fiche' ? '/legal/fiche'
      : inProgress.kind === 'commentaire' ? '/legal/commentaire'
      : inProgress.kind === 'cas-pratique' ? '/legal/cas-pratique'
      : '/legal/synthese'
    navigate(`${base}?session=${inProgress.id}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-fade-in">
      <Helmet>
        <title>Accueil — CRFPA | StudiesKit</title>
      </Helmet>

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-heading)]">
          {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
        </h1>
        {showCountdown && (
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Écrit dans <span className="font-semibold text-[var(--text-body)]">{daysUntilExam}</span>{' '}
            {daysUntilExam === 1 ? 'jour' : 'jours'}.
          </p>
        )}
      </div>

      {/* Resume banner — only if in-progress */}
      {inProgress && (
        <button
          onClick={handleResume}
          className="group w-full mb-6 flex items-center gap-4 p-4 rounded-xl border border-[var(--accent-text)]/40 bg-[var(--accent-bg)] hover:bg-[var(--accent-bg)]/80 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-text)]/10 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5 text-[var(--accent-text)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider font-semibold text-[var(--accent-text)]">
              Reprendre ton exercice
            </div>
            <div className="text-sm text-[var(--text-heading)] font-medium truncate">
              {inProgress.kind === 'syllogisme' ? 'Syllogisme'
                : inProgress.kind === 'plan' ? 'Plan détaillé'
                : inProgress.kind === 'fiche' ? 'Fiche d\'arrêt'
                : inProgress.kind === 'commentaire' ? 'Commentaire d\'arrêt'
                : inProgress.kind === 'cas-pratique' ? 'Cas pratique'
                : 'Note de synthèse'} — {inProgress.title}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-[var(--accent-text)] group-hover:translate-x-1 transition-transform shrink-0" />
        </button>
      )}

      {/* Action grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <ActionCard
          to="/legal/syllogisme"
          icon={PenSquare}
          title="Syllogisme"
          hint="Majeure, mineure, conclusion — correction méthodologique."
        />
        <ActionCard
          to="/legal/plan"
          icon={ListTree}
          title="Plan détaillé"
          hint="Problématique + I/II structurés, évalués sur 6 axes."
        />
        <ActionCard
          to="/legal/fiche"
          icon={FileText}
          title="Fiche d'arrêt"
          hint="Entraîne-toi sur une décision réelle de la Cour de cassation."
        />
        <ActionCard
          to="/legal/commentaire"
          icon={BookMarked}
          title="Commentaire d'arrêt"
          hint="Introduction et plan d'un commentaire sur décision réelle."
        />
        <ActionCard
          to="/legal/cas-pratique"
          icon={Scale}
          title="Cas pratique"
          hint="Consultation juridique sur 3 h — rubrique sur 20."
        />
        <ActionCard
          to="/legal/fiches"
          icon={NotebookPen}
          title="Fiches de révision"
          hint="Fiches denses, ancrées dans tes cours et la base légale."
        />
        <ActionCard
          to="/legal/synthese"
          icon={FileCheck}
          title="Note de synthèse"
          hint="Dossier de documents réels — rédige ta synthèse en 4 pages."
        />
        <ActionCard
          to="/legal/grand-oral"
          icon={Mic2}
          title="Grand Oral"
          hint="Simulation vocale avec jury IA — 15 min d'exposé + 30 min de questions."
        />
        <ActionCard
          to="/legal"
          icon={Scale}
          title="Oracle"
          hint="Interroge les codes et la jurisprudence française."
        />
        <ActionCard
          to="/sources"
          icon={FolderOpen}
          title="Mes documents"
          hint="Ajoute tes cours, polycopiés, TD."
        />
        <ActionCard
          to="/historique"
          icon={RotateCcw}
          title="Historique"
          hint="Tes entraînements passés et leurs corrections."
        />
      </div>

      {/* Documents strip — visible once she has uploaded at least one doc */}
      {recentDocs.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)]">
              Tes documents récents
            </h2>
            <Link
              to="/sources"
              className="flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline"
            >
              <Upload className="w-3 h-3" />
              En ajouter
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentDocs.map(doc => (
              <Link
                key={doc.id}
                to={`/read/${doc.id}`}
                className="glass-card p-3 hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    {doc.sourceType}
                  </span>
                </div>
                <div className="text-sm font-medium text-[var(--text-heading)] line-clamp-2 leading-snug">
                  {doc.title}
                </div>
                {doc.wordCount > 0 && (
                  <div className="text-[11px] text-[var(--text-muted)] mt-2 tabular-nums">
                    {doc.wordCount.toLocaleString('fr')} mots
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent strip */}
      {recent.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-3">
            Tes derniers entraînements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recent.map(r => {
              const base = r.kind === 'syllogisme' ? '/legal/syllogisme'
                : r.kind === 'plan' ? '/legal/plan'
                : r.kind === 'fiche' ? '/legal/fiche'
                : r.kind === 'commentaire' ? '/legal/commentaire'
                : r.kind === 'cas-pratique' ? '/legal/cas-pratique'
                : '/legal/synthese'
              const href = `${base}?session=${r.id}`
              const kindLabel = r.kind === 'syllogisme' ? 'Syllogisme'
                : r.kind === 'plan' ? 'Plan'
                : r.kind === 'fiche' ? 'Fiche d\'arrêt'
                : r.kind === 'commentaire' ? 'Commentaire'
                : r.kind === 'cas-pratique' ? 'Cas pratique'
                : 'Synthèse'
              const scoreMax = r.kind === 'note-synthese' || r.kind === 'cas-pratique' ? 20
                : (r.kind === 'fiche' || r.kind === 'commentaire') ? 25 : 30
              return (
                <Link
                  key={r.id}
                  to={href}
                  className="glass-card p-3 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
                    {kindLabel}
                  </div>
                  <div className="text-sm font-medium text-[var(--text-heading)] line-clamp-2 leading-snug">
                    {r.title}
                  </div>
                  {r.score !== undefined && (
                    <div className="text-xs text-[var(--text-muted)] mt-2 tabular-nums">
                      {r.score}/{scoreMax}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface ActionCardProps {
  to?: string
  icon: typeof PenSquare
  title: string
  hint: string
  disabled?: boolean
}

function ActionCard({ to, icon: Icon, title, hint, disabled }: ActionCardProps) {
  const content = (
    <div className={`group relative h-full p-5 rounded-2xl border transition-all ${
      disabled
        ? 'border-[var(--border-card)] bg-[var(--bg-card)]/50 opacity-50 cursor-not-allowed'
        : 'border-[var(--border-card)] bg-[var(--bg-card)] hover:border-[var(--accent-text)] hover:-translate-y-0.5 hover:shadow-sm cursor-pointer'
    }`}>
      <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[var(--accent-text)]" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold text-[var(--text-heading)]">{title}</div>
        {disabled ? (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">
            Bientôt
          </span>
        ) : (
          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] group-hover:translate-x-0.5 transition-all shrink-0" />
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">{hint}</p>
    </div>
  )

  if (disabled || !to) return content
  return <Link to={to} className="block">{content}</Link>
}
