import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCommandRegistry } from './CommandRegistry'
import { useProfileVertical } from '../../hooks/useProfileVertical'

interface RouteCommand {
  path: string
  label: string
  group?: string
  keywords?: string[]
  /** Restrict to profiles of this vertical. Omit for all profiles. */
  verticals?: Array<'crfpa' | 'cpge' | 'generic'>
}

const ROUTES: RouteCommand[] = [
  // CRFPA-only core
  { path: '/accueil',                label: 'Open Atelier (Dashboard)',           group: 'Navigate', verticals: ['crfpa'], keywords: ['accueil', 'dashboard', 'home', 'atelier', 'crfpa'] },
  { path: '/historique',             label: 'Open Historique (Session History)',   group: 'Navigate', verticals: ['crfpa'], keywords: ['historique', 'history', 'sessions', 'past'] },

  // Legal coaches — CRFPA-only
  { path: '/legal',                  label: 'Open Legal Oracle (Chat)',            group: 'Navigate', verticals: ['crfpa'], keywords: ['legal', 'oracle', 'chat', 'ask', 'ai'] },
  { path: '/legal/bibliotheque',     label: 'Open Bibliothèque',                   group: 'Navigate', verticals: ['crfpa'], keywords: ['bibliothèque', 'library', 'codes', 'civil', 'pénal'] },
  { path: '/legal/syllogisme',       label: 'Coach: Syllogisme',                   group: 'Coaches',  verticals: ['crfpa'], keywords: ['syllogisme', 'reasoning'] },
  { path: '/legal/plan',             label: 'Coach: Plan',                         group: 'Coaches',  verticals: ['crfpa'], keywords: ['plan', 'structure'] },
  { path: '/legal/fiche',            label: "Coach: Fiche d'arrêt",                group: 'Coaches',  verticals: ['crfpa'], keywords: ['fiche', 'arrêt', 'jurisprudence'] },
  { path: '/legal/commentaire',      label: "Coach: Commentaire d'arrêt",          group: 'Coaches',  verticals: ['crfpa'], keywords: ['commentaire', 'arrêt'] },
  { path: '/legal/cas-pratique',     label: 'Coach: Cas pratique',                 group: 'Coaches',  verticals: ['crfpa'], keywords: ['cas pratique', 'case', 'problem'] },
  { path: '/legal/fiches',           label: 'Coach: Fiches de révision',           group: 'Coaches',  verticals: ['crfpa'], keywords: ['fiches', 'révision', 'notes'] },
  { path: '/legal/synthese',         label: 'Coach: Note de synthèse',             group: 'Coaches',  verticals: ['crfpa'], keywords: ['synthèse', 'synthesis', 'note'] },
  { path: '/legal/grand-oral',       label: 'Coach: Grand Oral',                   group: 'Coaches',  verticals: ['crfpa'], keywords: ['grand oral', 'oral', 'speak'] },

  // Generic / shared across verticals
  { path: '/dashboard',              label: 'Open Dashboard',                      group: 'Navigate', verticals: ['cpge', 'generic'], keywords: ['dashboard', 'home'] },
  { path: '/queue',                  label: 'Open Daily Queue',                    group: 'Navigate', keywords: ['queue', 'session', 'review', 'today', 'daily'] },
  { path: '/practice-exam',          label: 'Open Practice Exam',                  group: 'Study',    keywords: ['practice', 'exam', 'mock', 'simulation'] },
  { path: '/exercises',              label: 'Open Exercises',                      group: 'Study',    keywords: ['exercises', 'drill', 'problems'] },
  { path: '/study-plan',             label: 'Open Study Plan',                     group: 'Study',    keywords: ['study plan', 'roadmap'] },
  { path: '/article-review',         label: 'Open Article Review',                 group: 'Study',    keywords: ['article', 'review', 'spaced'] },
  { path: '/sources',                label: 'Open Sources (Documents)',            group: 'Study',    keywords: ['sources', 'documents', 'upload', 'pdf'] },
  { path: '/analytics',              label: 'Open Analytics',                      group: 'Insight',  keywords: ['analytics', 'progress', 'mastery', 'graphs'] },
  { path: '/exam-dna',               label: 'Open Exam DNA',                       group: 'Insight',  keywords: ['exam dna', 'profile', 'pattern'] },
  { path: '/exam-profile',           label: 'Open Exam Profile',                   group: 'Settings', keywords: ['exam profile', 'subjects', 'goal'] },
  { path: '/settings',               label: 'Open Settings',                       group: 'Settings', keywords: ['settings', 'preferences', 'config'] },
  { path: '/pricing',                label: 'Open Pricing',                        group: 'Settings', keywords: ['pricing', 'subscription', 'upgrade'] },
  { path: '/all-tools',              label: 'Browse All Tools',                    group: 'Settings', keywords: ['tools', 'browse'] },
]

export function useRouteCommands() {
  const navigate = useNavigate()
  const { register, unregister } = useCommandRegistry()
  const { vertical } = useProfileVertical()

  useEffect(() => {
    const ids: string[] = []
    for (const route of ROUTES) {
      if (route.verticals && !route.verticals.includes(vertical)) continue
      const id = `route:${route.path}`
      register({
        id,
        label: route.label,
        group: route.group ?? 'Navigate',
        keywords: route.keywords,
        hint: route.path,
        perform: () => navigate(route.path),
      })
      ids.push(id)
    }
    return () => {
      for (const id of ids) unregister(id)
    }
  }, [navigate, register, unregister, vertical])
}
