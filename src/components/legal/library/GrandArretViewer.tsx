/**
 * Bibliothèque grand-arrêt viewer — structured render of one entry from
 * scripts/data/grandsArretsSeed.ts. No fetch; the seed file is imported
 * at build time and bundled.
 */
import { ExternalLink, Scale } from 'lucide-react'
import { GRANDS_ARRETS } from '../../../../scripts/data/grandsArretsSeed'

interface Props {
  /** Slug from the seed file, e.g. "tc-blanco-1873". */
  slug: string
}

const SUBJECT_LABELS: Record<string, string> = {
  admin: 'Droit administratif',
  civil: 'Droit civil',
  pénal: 'Droit pénal',
  penal: 'Droit pénal',
  constitutionnel: 'Droit constitutionnel',
  social: 'Droit social',
  procédure: 'Procédure',
  procedure: 'Procédure',
}

function formatDate(iso: string): string {
  // YYYY-MM-DD → DD month YYYY in French
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const months = [
    '', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ]
  const day = parseInt(m[3], 10)
  const month = months[parseInt(m[2], 10)] ?? ''
  return `${day} ${month} ${m[1]}`
}

export function GrandArretViewer({ slug }: Props) {
  const arret = GRANDS_ARRETS.find(a => a.slug === slug)
  if (!arret) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">
        Arrêt introuvable.
      </div>
    )
  }
  return (
    <article className="max-w-3xl mx-auto p-6 space-y-5">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Scale className="w-3.5 h-3.5" />
          {SUBJECT_LABELS[arret.subject] ?? arret.subject}
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">{arret.name}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-semibold">{arret.court}</span>
          {', '}
          {formatDate(arret.date)}
          {arret.citation ? <> — <span className="font-mono text-xs">{arret.citation}</span></> : null}
        </p>
      </header>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Portée
        </h2>
        <p className="text-sm leading-relaxed text-[var(--text-primary)]">{arret.portee}</p>
      </section>

      {arret.attendu && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
            Attendu (extrait)
          </h2>
          <blockquote className="text-sm italic leading-relaxed border-l-2 border-[var(--accent-text)] pl-4 text-[var(--text-secondary)]">
            {arret.attendu}
          </blockquote>
        </section>
      )}

      {arret.wikipediaSlug && (
        <a
          href={`https://fr.wikipedia.org/wiki/${arret.wikipediaSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-text)] hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Lire l'article complet sur Wikipédia
        </a>
      )}
    </article>
  )
}
