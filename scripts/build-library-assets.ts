#!/usr/bin/env npx tsx
/**
 * Bibliothèque CRFPA — asset pipeline.
 *
 * Copies curated content from `legal-sources-output/cache/` into `public/library/`
 * (the static-asset directory Vite serves at build time) and emits a typed
 * manifest at `src/lib/library/manifest.generated.ts`.
 *
 * Idempotent: safe to re-run. Detects unchanged outputs and skips.
 *
 * Categories:
 *   - PDFs:   crfpa-official/  + crfpa-rapports/  + institutional-rapports/
 *   - HTML:   conseil-constitutionnel/
 *   - Codes:  code-*.json + casf|cgct|cgppp|crpa|cgfp|cjpm|coj.json
 *   - Textes: constitution|deontologie|lois-non-codifiees|eu-regulations|
 *             international-texts|grands-arrets|crfpa-grounding|crfpa-official.json
 *
 * Usage:  npm run build:library    (or:  npx tsx scripts/build-library-assets.ts)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, copyFileSync } from 'fs'
import { join, basename, dirname } from 'path'

import type { LibraryEntry, LibraryCategory } from '../src/lib/library/types'

// ─── Paths ────────────────────────────────────────────────────────────────

const REPO = join(process.cwd())
const CACHE = join(REPO, 'legal-sources-output', 'cache')
const PUBLIC_LIB = join(REPO, 'public', 'library')
const MANIFEST_OUT = join(REPO, 'src', 'lib', 'library', 'manifest.generated.ts')

// Public R2 bucket hosting library assets (PDFs / code JSONs / CC HTMLs / textes JSONs).
// Bucket: studieskit-library — public dev URL enabled via `wrangler r2 bucket dev-url enable`.
// Override at build time with VITE_LIBRARY_BASE_URL if you ever migrate to a custom domain.
const LIBRARY_BASE_URL = process.env.VITE_LIBRARY_BASE_URL ?? 'https://pub-9015cb5b28aa4d429a0f2f6f43838c1d.r2.dev'

// ─── Display-title heuristics ────────────────────────────────────────────

const MATIERE_LABELS: Record<string, string> = {
  obligations: 'Obligations',
  civil: 'Droit civil',
  penal: 'Droit pénal',
  affaires: 'Droit des affaires',
  social: 'Droit social',
  administratif: 'Droit administratif',
  fiscal: 'Droit fiscal',
  immobilier: 'Droit immobilier',
  international: 'Droit international',
  procedures: 'Procédures',
  'procedure-civile': 'Procédure civile',
  'procedure-penale': 'Procédure pénale',
  'procedure-admin': 'Procédure administrative',
  'cas-pratiques': 'Cas pratiques',
  'note-synthese': 'Note de synthèse',
  libertes: 'Libertés fondamentales',
}

const CODE_LABELS: Record<string, string> = {
  'code-civil': 'Code civil',
  'code-penal': 'Code pénal',
  'code-commerce': 'Code de commerce',
  'code-travail': 'Code du travail',
  'code-procedure-civile': 'Code de procédure civile',
  'code-procedure-penale': 'Code de procédure pénale',
  'code-propriete-intellectuelle': 'Code de la propriété intellectuelle',
  'code-consommation': 'Code de la consommation',
  'code-construction-habitation': 'Code de la construction et de l\'habitation',
  'code-environnement': 'Code de l\'environnement',
  'code-justice-administrative': 'Code de justice administrative',
  'code-urbanisme': 'Code de l\'urbanisme',
  'code-monetaire-financier': 'Code monétaire et financier',
  'code-sante-publique': 'Code de la santé publique',
  'code-rural': 'Code rural et de la pêche maritime',
  'code-transports': 'Code des transports',
  'code-education': 'Code de l\'éducation',
  'code-postes': 'Code des postes et communications électroniques',
  'code-sport': 'Code du sport',
  'code-defense': 'Code de la défense',
  'code-assurances': 'Code des assurances',
  casf: 'Code de l\'action sociale et des familles',
  cgct: 'Code général des collectivités territoriales',
  cgppp: 'Code général de la propriété des personnes publiques',
  crpa: 'Code des relations entre le public et l\'administration',
  cgfp: 'Code général de la fonction publique',
  cjpm: 'Code de la justice pénale des mineurs',
  coj: 'Code de l\'organisation judiciaire',
}

function titleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function matiereLabel(slug: string): string {
  return MATIERE_LABELS[slug] ?? titleCase(slug)
}

function pdfDisplayTitle(filename: string): { title: string; year?: number; matiere?: string } {
  const stem = filename.replace(/\.pdf$/i, '')

  let m = stem.match(/^sujet-(\d{4})-(.+)$/)
  if (m) return { title: `Sujet ${m[1]} — ${matiereLabel(m[2])}`, year: parseInt(m[1], 10), matiere: m[2] }

  m = stem.match(/^grille-(\d{4})-(.+)$/)
  if (m) return { title: `Grille de notation ${m[1]} — ${matiereLabel(m[2])}`, year: parseInt(m[1], 10), matiere: m[2] }

  m = stem.match(/^cnb-rapport-crfpa-(.+)$/)
  if (m) {
    const year = parseInt(m[1].split('-')[0], 10)
    return { title: `Rapport CNB CRFPA ${m[1]}`, year: Number.isFinite(year) ? year : undefined }
  }

  m = stem.match(/^cnb-arrete-dates-crfpa-(\d{4})$/)
  if (m) return { title: `Calendrier CRFPA ${m[1]}`, year: parseInt(m[1], 10) }

  m = stem.match(/^rin-(\d{4})$/)
  if (m) return { title: `RIN ${m[1]}`, year: parseInt(m[1], 10) }

  m = stem.match(/^documents-autorises-(\d{4})$/)
  if (m) return { title: `Documents autorisés ${m[1]}`, year: parseInt(m[1], 10) }

  return { title: titleCase(stem) }
}

function ccDisplayTitle(filename: string): { title: string; year?: number; type: 'DC' | 'QPC' | 'AUTRE' } {
  // Handles two filename shapes observed in cache/conseil-constitutionnel/:
  //   - modern: "2024-2024-1089-QPC.html"  (year, year, num, type)
  //   - legacy: "1971-71-44-DC.html"       (year, year2-digits, num, type)
  const stem = filename.replace(/\.html$/i, '')
  const m = stem.match(/^(\d{4})-(\d{2,4})-(\d+)-(DC|QPC)$/i)
  if (m) {
    const type = m[4].toUpperCase() as 'DC' | 'QPC'
    return { title: `Décision n° ${m[2]}-${m[3]} ${type}`, year: parseInt(m[1], 10), type }
  }
  return { title: titleCase(stem), type: 'AUTRE' }
}

const TEXTE_LABELS: Record<string, string> = {
  constitution: 'Constitution du 4 octobre 1958',
  deontologie: 'Déontologie & RIN',
  'lois-non-codifiees': 'Lois non codifiées',
  'eu-regulations': 'Règlements & directives UE',
  'international-texts': 'Textes internationaux',
  'crfpa-grounding': 'Référentiel CRFPA',
  'crfpa-official': 'Programme officiel CRFPA',
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

function copyIfChanged(src: string, dst: string): boolean {
  if (existsSync(dst)) {
    const a = statSync(src), b = statSync(dst)
    if (a.size === b.size && a.mtimeMs <= b.mtimeMs) return false
  }
  ensureDir(dirname(dst))
  copyFileSync(src, dst)
  return true
}

function kbOf(p: string): number {
  return Math.round(statSync(p).size / 1024)
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.toLowerCase().endsWith(ext.toLowerCase())).sort()
}

// ─── Pipeline ────────────────────────────────────────────────────────────

interface BuildResult {
  copied: number
  skipped: number
  manifest: LibraryEntry[]
}

function copyPdfs(sourceDir: string, targetSubpath: string, category: LibraryCategory): BuildResult {
  const out: BuildResult = { copied: 0, skipped: 0, manifest: [] }
  const dst = join(PUBLIC_LIB, targetSubpath)
  ensureDir(dst)
  for (const f of listFiles(sourceDir, '.pdf')) {
    const src = join(sourceDir, f)
    const dstFile = join(dst, f)
    if (copyIfChanged(src, dstFile)) out.copied++; else out.skipped++
    const meta = pdfDisplayTitle(f)
    out.manifest.push({
      id: `${category}-${f.replace(/\.pdf$/i, '')}`,
      category,
      title: meta.title,
      format: 'pdf',
      path: `${LIBRARY_BASE_URL}/${targetSubpath}/${f}`,
      sizeKb: kbOf(dstFile),
      year: meta.year,
      matiere: meta.matiere,
      tags: [category, ...(meta.year ? [String(meta.year)] : []), ...(meta.matiere ? [meta.matiere] : [])],
    })
  }
  return out
}

function copyHtmlCC(): BuildResult {
  const out: BuildResult = { copied: 0, skipped: 0, manifest: [] }
  const sourceDir = join(CACHE, 'conseil-constitutionnel')
  const dst = join(PUBLIC_LIB, 'cc')
  ensureDir(dst)
  for (const f of listFiles(sourceDir, '.html')) {
    const src = join(sourceDir, f)
    const dstFile = join(dst, f)
    if (copyIfChanged(src, dstFile)) out.copied++; else out.skipped++
    const meta = ccDisplayTitle(f)
    out.manifest.push({
      id: `cc-${f.replace(/\.html$/i, '')}`,
      category: 'cc',
      title: meta.title,
      format: 'html',
      path: `${LIBRARY_BASE_URL}/cc/${f}`,
      sizeKb: kbOf(dstFile),
      year: meta.year,
      tags: ['cc', meta.type, ...(meta.year ? [String(meta.year)] : [])],
    })
  }
  return out
}

const CODE_FILES = [
  // Tier 1 (16 codes from ingest-extra-codes.ts, all small/niche)
  'casf.json', 'cgct.json', 'cgppp.json', 'crpa.json', 'cgfp.json', 'cjpm.json', 'coj.json',
  'code-assurances.json', 'code-defense.json', 'code-education.json',
  'code-monetaire-financier.json', 'code-postes.json', 'code-rural.json',
  'code-sante-publique.json', 'code-sport.json', 'code-transports.json',
  // Tier 2 (12 codes from ingest-major-codes.ts — the heavyweights)
  'code-civil.json', 'code-penal.json',
  'code-procedure-civile.json', 'code-procedure-penale.json',
  'code-travail.json', 'code-commerce.json',
  'code-propriete-intellectuelle.json', 'code-consommation.json',
  'code-construction-habitation.json', 'code-environnement.json',
  'code-justice-administrative.json', 'code-urbanisme.json',
] as const

function copyCodes(): BuildResult {
  const out: BuildResult = { copied: 0, skipped: 0, manifest: [] }
  const dst = join(PUBLIC_LIB, 'codes')
  ensureDir(dst)
  for (const f of CODE_FILES) {
    const src = join(CACHE, f)
    if (!existsSync(src)) continue
    const dstFile = join(dst, f)
    if (copyIfChanged(src, dstFile)) out.copied++; else out.skipped++
    const slug = f.replace(/\.json$/i, '')
    const title = CODE_LABELS[slug] ?? titleCase(slug)
    // Count chunks to surface in subtitle.
    let articleCount = 0
    try {
      const arr = JSON.parse(readFileSync(src, 'utf8')) as unknown[]
      articleCount = arr.length
    } catch { /* ignore */ }
    out.manifest.push({
      id: slug,
      category: 'codes',
      title,
      subtitle: articleCount ? `${articleCount.toLocaleString('fr')} articles` : undefined,
      format: 'code-tree',
      path: `${LIBRARY_BASE_URL}/codes/${f}`,
      sizeKb: kbOf(dstFile),
      tags: ['codes'],
    })
  }
  return out
}

const TEXTE_FILES = [
  'constitution.json',
  'deontologie.json',
  'lois-non-codifiees.json',
  'eu-regulations.json',
  'international-texts.json',
  'grands-arrets.json',
  'crfpa-grounding.json',
  'crfpa-official.json',
] as const

function copyTextes(): BuildResult {
  const out: BuildResult = { copied: 0, skipped: 0, manifest: [] }
  const dst = join(PUBLIC_LIB, 'textes')
  ensureDir(dst)
  for (const f of TEXTE_FILES) {
    const src = join(CACHE, f)
    if (!existsSync(src)) continue
    const dstFile = join(dst, f)
    if (copyIfChanged(src, dstFile)) out.copied++; else out.skipped++
    const slug = f.replace(/\.json$/i, '')
    const title = TEXTE_LABELS[slug] ?? titleCase(slug)
    let chunkCount = 0
    try {
      const arr = JSON.parse(readFileSync(src, 'utf8')) as unknown[]
      chunkCount = arr.length
    } catch { /* ignore */ }
    out.manifest.push({
      id: `texte-${slug}`,
      category: 'textes',
      title,
      subtitle: chunkCount ? `${chunkCount.toLocaleString('fr')} sections` : undefined,
      format: 'markdown',
      path: `${LIBRARY_BASE_URL}/textes/${f}`,
      sizeKb: kbOf(dstFile),
      tags: ['textes', slug],
    })
  }
  return out
}

async function buildGrandsArretsManifest(): Promise<LibraryEntry[]> {
  // Direct import of the typed seed file via tsx — no regex parsing needed.
  const mod = await import('./data/grandsArretsSeed')
  const entries = mod.GRANDS_ARRETS
  return entries.map(e => ({
    id: `gajc-${e.slug}`,
    category: 'grands-arrets' as const,
    title: e.name,
    subtitle: `${e.court}, ${e.date}${e.citation ? ` — ${e.citation}` : ''}`,
    format: 'grand-arret' as const,
    path: e.slug, // not a URL — runtime slug consumed by GrandArretViewer
    sizeKb: 1,    // synthetic; entries live in JS, not on disk
    year: parseInt(e.date.slice(0, 4), 10) || undefined,
    matiere: e.subject,
    tags: ['grands-arrets', e.subject, ...(e.date.slice(0, 4) ? [e.date.slice(0, 4)] : [])],
  }))
}

// ─── Manifest emission ───────────────────────────────────────────────────

function emitManifest(entries: LibraryEntry[]): void {
  ensureDir(dirname(MANIFEST_OUT))
  // Stable sort: category, then title.
  const sorted = [...entries].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.title.localeCompare(b.title, 'fr')
  })
  const banner = `// AUTO-GENERATED by scripts/build-library-assets.ts — do not edit by hand.
// Re-run with \`npm run build:library\`.

import type { LibraryEntry } from './types'

export const LIBRARY_MANIFEST: readonly LibraryEntry[] = ${JSON.stringify(sorted, null, 2)} as const

export const LIBRARY_MANIFEST_BUILT_AT = '${new Date().toISOString()}'
`
  writeFileSync(MANIFEST_OUT, banner)
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[library] starting asset pipeline')
  ensureDir(PUBLIC_LIB)

  const all: LibraryEntry[] = []
  let copied = 0, skipped = 0

  for (const [src, sub, cat] of [
    [join(CACHE, 'crfpa-official'), 'pdfs/crfpa', 'crfpa-officiel' as const],
    [join(CACHE, 'crfpa-rapports'), 'pdfs/rapports', 'rapports' as const],
    [join(CACHE, 'institutional-rapports'), 'pdfs/rapports', 'rapports' as const],
  ]) {
    const r = copyPdfs(src as string, sub as string, cat as LibraryCategory)
    copied += r.copied; skipped += r.skipped
    all.push(...r.manifest)
    console.log(`[library]   ${cat}: copied ${r.copied} / skipped ${r.skipped}`)
  }

  const cc = copyHtmlCC()
  copied += cc.copied; skipped += cc.skipped
  all.push(...cc.manifest)
  console.log(`[library]   cc: copied ${cc.copied} / skipped ${cc.skipped}`)

  const codes = copyCodes()
  copied += codes.copied; skipped += codes.skipped
  all.push(...codes.manifest)
  console.log(`[library]   codes: copied ${codes.copied} / skipped ${codes.skipped} / count ${codes.manifest.length}`)

  const textes = copyTextes()
  copied += textes.copied; skipped += textes.skipped
  all.push(...textes.manifest)
  console.log(`[library]   textes: copied ${textes.copied} / skipped ${textes.skipped} / count ${textes.manifest.length}`)

  const arrets = await buildGrandsArretsManifest()
  all.push(...arrets)
  console.log(`[library]   grands-arrets: ${arrets.length}`)

  emitManifest(all)
  const totalKb = all.reduce((s, e) => s + e.sizeKb, 0)
  console.log(`\n[library] DONE  ${all.length} entries  copied=${copied} skipped=${skipped}  total ${(totalKb / 1024).toFixed(1)} MB`)
  console.log(`[library] manifest → ${MANIFEST_OUT}`)
}

main().catch(err => {
  console.error('[library] FAILED:', err)
  process.exit(1)
})
