/**
 * IndexedDB persistence for CRFPA legal fiches.
 *
 * Fiches live in their own `legalFiches` table — they aren't coaching attempts
 * (no submission, no grading), they're reference documents the student creates
 * and annotates over time.
 */

import { db } from '../../db'
import type { LegalFiche, LegalFicheActualiteStatus } from '../../db/schema'
import type { CasPratiqueGroundingEntry } from './types'

export interface LegalFicheSourceChunk {
  chunkId: string
  documentId: string
  score: number
}

export interface LegalFicheView {
  id: string
  examProfileId: string
  theme: string
  themeId?: string
  matiere?: string
  source: 'theme' | 'cours' | 'custom'
  prompt: string
  content: string
  groundingPool: CasPratiqueGroundingEntry[]
  userSourceChunks: LegalFicheSourceChunk[]
  userAnnotations: Record<string, string>
  actualiteEnrichedAt?: string
  actualiteStatus: LegalFicheActualiteStatus
  actualiteError?: string
  version: number
  parentId?: string
  createdAt: string
  updatedAt: string
}

function hydrate(row: LegalFiche): LegalFicheView {
  return {
    id: row.id,
    examProfileId: row.examProfileId,
    theme: row.theme,
    themeId: row.themeId,
    matiere: row.matiere,
    source: row.source,
    prompt: row.prompt,
    content: row.content,
    groundingPool: safeParseArray<CasPratiqueGroundingEntry>(row.groundingPool),
    userSourceChunks: safeParseArray<LegalFicheSourceChunk>(row.userSourceChunks),
    userAnnotations: safeParseObject<Record<string, string>>(row.userAnnotations),
    actualiteEnrichedAt: row.actualiteEnrichedAt,
    actualiteStatus: row.actualiteStatus,
    actualiteError: row.actualiteError,
    version: row.version,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function safeParseArray<T>(s: string): T[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}

function safeParseObject<T>(s: string): T {
  try { const v = JSON.parse(s); return (typeof v === 'object' && v !== null) ? v as T : {} as T } catch { return {} as T }
}

export interface CreateLegalFicheInput {
  examProfileId: string
  theme: string
  themeId?: string
  matiere?: string
  source: 'theme' | 'cours' | 'custom'
  prompt: string
  content: string
  groundingPool: CasPratiqueGroundingEntry[]
  userSourceChunks: LegalFicheSourceChunk[]
  actualiteStatus: LegalFicheActualiteStatus
  parentId?: string
  version?: number
}

export async function createLegalFiche(input: CreateLegalFicheInput): Promise<string> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.legalFiches.put({
    id,
    examProfileId: input.examProfileId,
    theme: input.theme,
    themeId: input.themeId,
    matiere: input.matiere,
    source: input.source,
    prompt: input.prompt,
    content: input.content,
    groundingPool: JSON.stringify(input.groundingPool),
    userSourceChunks: JSON.stringify(input.userSourceChunks),
    userAnnotations: JSON.stringify({}),
    actualiteStatus: input.actualiteStatus,
    version: input.version ?? 1,
    parentId: input.parentId,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export async function loadLegalFiche(id: string): Promise<LegalFicheView | undefined> {
  const row = await db.legalFiches.get(id)
  if (!row) return undefined
  return hydrate(row)
}

export async function listLegalFiches(examProfileId: string): Promise<LegalFicheView[]> {
  const rows = await db.legalFiches
    .where('[examProfileId+createdAt]')
    .between([examProfileId, ''], [examProfileId, '￿'])
    .toArray()
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map(hydrate)
}

export async function updateLegalFicheContent(id: string, content: string): Promise<void> {
  await db.legalFiches.update(id, {
    content,
    updatedAt: new Date().toISOString(),
  })
}

export async function updateLegalFicheAnnotations(
  id: string,
  sectionKey: string,
  note: string,
): Promise<void> {
  const row = await db.legalFiches.get(id)
  if (!row) return
  const annotations = safeParseObject<Record<string, string>>(row.userAnnotations)
  if (note.trim()) {
    annotations[sectionKey] = note
  } else {
    delete annotations[sectionKey]
  }
  await db.legalFiches.update(id, {
    userAnnotations: JSON.stringify(annotations),
    updatedAt: new Date().toISOString(),
  })
}

export interface UpdateLegalFicheActualiteInput {
  content: string
  status: LegalFicheActualiteStatus
  enrichedAt?: string
  error?: string
}

export async function updateLegalFicheActualite(
  id: string,
  input: UpdateLegalFicheActualiteInput,
): Promise<void> {
  const now = new Date().toISOString()
  await db.legalFiches.update(id, {
    content: input.content,
    actualiteStatus: input.status,
    actualiteEnrichedAt: input.enrichedAt ?? now,
    actualiteError: input.error,
    updatedAt: now,
  })
}

export async function deleteLegalFiche(id: string): Promise<void> {
  await db.legalFiches.delete(id)
}
