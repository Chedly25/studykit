/**
 * State machine + persistence coordinator for CRFPA legal fiches.
 *
 * States:
 *   idle → generating → generated → enriching → saved
 *                     ↘ (no marker) ↗
 *
 * Flow contract:
 *   1. `generate(...)` calls the coach. Fiche is persisted as soon as it lands.
 *   2. If `hasActualiteMarker === true`, the hook auto-fires `enrichActualite()` exactly once.
 *   3. `enrichActualite()` can also be called manually at any time (button on the viewer).
 *   4. Regenerate always creates a new row pointing back at the prior version.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import {
  generateLegalFiche,
  enrichFicheActualite,
  applyActualiteSnippet,
} from '../ai/coaching/legalFicheCoach'
import {
  createLegalFiche,
  deleteLegalFiche,
  listLegalFiches,
  loadLegalFiche,
  updateLegalFicheAnnotations,
  updateLegalFicheContent,
  updateLegalFicheActualite,
  type LegalFicheView,
} from '../ai/coaching/legalFicheStore'
import { findThemeById, type FicheMatiere } from '../ai/prompts/legalFichePrompts'
import { classifyCoachingError, formatCoachingError } from '../ai/coaching/coachingErrors'

const FALLBACK_PROFILE_ID = 'legal-chat'

export type LegalFichePhase = 'idle' | 'generating' | 'generated' | 'enriching' | 'saved'

export interface GenerateFicheArgs {
  source: 'theme' | 'cours' | 'custom'
  /** For theme: pick a theme id. For cours: title of the picked doc. For custom: free text query title. */
  theme: string
  themeId?: string
  customQuery?: string
  /** For 'cours' source: the document the student is fiching from. Optional. */
  documentId?: string
}

export function useLegalFiche() {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const examProfileId = activeProfile?.id ?? FALLBACK_PROFILE_ID

  const [phase, setPhase] = useState<LegalFichePhase>('idle')
  const [fiche, setFiche] = useState<LegalFicheView | null>(null)
  const [history, setHistory] = useState<LegalFicheView[]>([])
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const autoEnrichedOnceRef = useRef<Set<string>>(new Set())

  const refreshHistory = useCallback(async () => {
    const rows = await listLegalFiches(examProfileId)
    setHistory(rows)
  }, [examProfileId])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase('idle')
    setFiche(null)
    setError(null)
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const generate = useCallback(async (args: GenerateFicheArgs) => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setPhase('generating')
    setFiche(null)
    setError(null)

    try {
      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const themeRow = args.themeId ? findThemeById(args.themeId) : undefined
      const matiere = themeRow?.matiere

      const result = await generateLegalFiche({
        theme: args.theme,
        themeId: args.themeId,
        matiere,
        source: args.source,
        customQuery: args.customQuery,
        documentId: args.documentId,
        examProfileId,
        authToken: token,
        getToken: async () => getToken(),
        signal: abort.signal,
      })

      const id = await createLegalFiche({
        examProfileId,
        theme: args.theme,
        themeId: args.themeId,
        matiere: matiere ?? undefined,
        source: args.source,
        prompt: args.customQuery ?? args.theme,
        content: result.content,
        groundingPool: result.groundingPool,
        userSourceChunks: result.userCoursChunks.map(c => ({
          chunkId: c.chunkId,
          documentId: c.documentId,
          score: c.score,
        })),
        actualiteStatus: result.hasActualiteMarker ? 'pending' : 'not-needed',
      })

      const view = await loadLegalFiche(id)
      if (!view) throw new Error('Fiche créée mais introuvable en base')
      setFiche(view)
      setPhase('generated')
      await refreshHistory()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(formatCoachingError(classifyCoachingError(err)))
      setPhase('idle')
    }
  }, [examProfileId, getToken, refreshHistory])

  const runEnrichment = useCallback(async (
    target: LegalFicheView,
    statusOnSuccess: 'auto-enriched' | 'manually-enriched',
  ) => {
    if (!target.matiere) {
      // No matière → no allowlist → can't safely enrich
      await updateLegalFicheActualite(target.id, {
        content: target.content,
        status: 'not-needed',
      })
      const refreshed = await loadLegalFiche(target.id)
      if (refreshed) setFiche(refreshed)
      return
    }

    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setPhase('enriching')
    try {
      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const enrichment = await enrichFicheActualite(
        {
          theme: target.theme,
          matiere: target.matiere as FicheMatiere,
          authToken: token,
          getToken: async () => getToken(),
          signal: abort.signal,
        },
        statusOnSuccess,
      )

      const nextContent = applyActualiteSnippet(target.content, enrichment.snippet) ?? target.content

      await updateLegalFicheActualite(target.id, {
        content: nextContent,
        status: enrichment.status,
        error: enrichment.error,
      })

      const refreshed = await loadLegalFiche(target.id)
      if (refreshed) setFiche(refreshed)
      setPhase('saved')
      await refreshHistory()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const classified = classifyCoachingError(err)
      await updateLegalFicheActualite(target.id, {
        content: target.content,
        status: 'failed',
        error: classified.message,
      })
      const refreshed = await loadLegalFiche(target.id)
      if (refreshed) setFiche(refreshed)
      setError(formatCoachingError(classified))
      setPhase('saved')
    }
  }, [getToken, refreshHistory])

  // Auto-enrichment: fires once per fiche id that lands in 'generated' with marker.
  useEffect(() => {
    if (phase !== 'generated' || !fiche) return
    if (fiche.actualiteStatus !== 'pending') return
    if (autoEnrichedOnceRef.current.has(fiche.id)) return
    autoEnrichedOnceRef.current.add(fiche.id)
    runEnrichment(fiche, 'auto-enriched')
  }, [phase, fiche, runEnrichment])

  const enrichActualite = useCallback(async () => {
    if (!fiche) return
    await runEnrichment(fiche, 'manually-enriched')
  }, [fiche, runEnrichment])

  const saveEdit = useCallback(async (nextContent: string) => {
    if (!fiche) return
    await updateLegalFicheContent(fiche.id, nextContent)
    const refreshed = await loadLegalFiche(fiche.id)
    if (refreshed) setFiche(refreshed)
    await refreshHistory()
  }, [fiche, refreshHistory])

  const saveAnnotation = useCallback(async (sectionKey: string, note: string) => {
    if (!fiche) return
    await updateLegalFicheAnnotations(fiche.id, sectionKey, note)
    const refreshed = await loadLegalFiche(fiche.id)
    if (refreshed) setFiche(refreshed)
  }, [fiche])

  const regenerate = useCallback(async () => {
    if (!fiche) return
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setPhase('generating')
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Authentification requise')

      const themeRow = fiche.themeId ? findThemeById(fiche.themeId) : undefined
      const result = await generateLegalFiche({
        theme: fiche.theme,
        themeId: fiche.themeId,
        matiere: themeRow?.matiere,
        source: fiche.source,
        customQuery: fiche.source === 'custom' ? fiche.prompt : undefined,
        examProfileId,
        authToken: token,
        getToken: async () => getToken(),
        signal: abort.signal,
      })

      const newId = await createLegalFiche({
        examProfileId,
        theme: fiche.theme,
        themeId: fiche.themeId,
        matiere: fiche.matiere,
        source: fiche.source,
        prompt: fiche.prompt,
        content: result.content,
        groundingPool: result.groundingPool,
        userSourceChunks: result.userCoursChunks.map(c => ({
          chunkId: c.chunkId,
          documentId: c.documentId,
          score: c.score,
        })),
        actualiteStatus: result.hasActualiteMarker ? 'pending' : 'not-needed',
        parentId: fiche.id,
        version: fiche.version + 1,
      })
      const view = await loadLegalFiche(newId)
      if (!view) throw new Error('Nouvelle version introuvable')
      setFiche(view)
      setPhase('generated')
      await refreshHistory()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(formatCoachingError(classifyCoachingError(err)))
      setPhase('idle')
    }
  }, [fiche, examProfileId, getToken, refreshHistory])

  const loadFiche = useCallback(async (id: string) => {
    const view = await loadLegalFiche(id)
    if (!view) return
    setFiche(view)
    setPhase(view.actualiteStatus === 'pending' ? 'enriching' : 'saved')
    setError(null)
  }, [])

  const removeFiche = useCallback(async (id: string) => {
    await deleteLegalFiche(id)
    if (id === fiche?.id) reset()
    await refreshHistory()
  }, [fiche, reset, refreshHistory])

  return {
    phase,
    fiche,
    history,
    error,
    generate,
    regenerate,
    saveEdit,
    saveAnnotation,
    enrichActualite,
    loadFiche,
    removeFiche,
    reset,
    cancel,
  }
}
