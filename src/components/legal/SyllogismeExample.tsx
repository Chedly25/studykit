/**
 * Collapsible worked example shown on the Syllogisme editor.
 * Static content — one reference-quality syllogisme on a scenario
 * DIFFERENT from anything the generator produces (to avoid revealing a real model).
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'

export function SyllogismeExample() {
  const [open, setOpen] = useState(false)

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-[var(--text-heading)]">
          <Lightbulb className="w-4 h-4 text-[var(--color-warning)]" />
          <span className="font-semibold">Voir un exemple de syllogisme bien rédigé</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--border-card)] p-4 space-y-4 text-sm leading-relaxed">
          <div className="text-xs text-[var(--text-muted)] italic">
            Exemple à titre pédagogique (scénario fictif, différent de ton entraînement).
          </div>

          <Section label="Scénario">
            Paul cède son vélo à Julie le 10 février 2026 pour 400 €, convenu en espèces. Julie
            emporte le vélo mais ne règle que 200 € à la livraison, puis cesse de répondre aux
            relances. Un mois plus tard, Paul n'a toujours rien reçu.
          </Section>

          <Section label="Question">
            Paul peut-il exiger le paiement du solde du prix auprès de Julie ?
          </Section>

          <Section label="Majeure">
            L'article 1583 du Code civil dispose que la vente est parfaite entre les parties dès
            qu'on est convenu de la chose et du prix, et l'article 1650 fait peser sur l'acheteur
            l'obligation principale de payer le prix au jour et au lieu convenus. Cette
            obligation suppose trois éléments :
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>un contrat de vente valablement formé (chose, prix, consentement) ;</li>
              <li>une obligation de paiement à la charge de l'acheteur ;</li>
              <li>l'inexécution ou l'exécution partielle de cette obligation au terme prévu.</li>
            </ul>
          </Section>

          <Section label="Mineure">
            En l'espèce, chaque élément est satisfait :
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <span className="font-medium">Contrat valablement formé</span> — Paul et Julie se
                sont accordés sur la chose (le vélo) et le prix (400 €).
              </li>
              <li>
                <span className="font-medium">Obligation de paiement</span> — Julie, en qualité
                d'acheteuse, est tenue de payer le prix convenu.
              </li>
              <li>
                <span className="font-medium">Inexécution partielle</span> — elle n'a réglé que
                200 € sur 400 €, un mois après la livraison, et cesse de répondre.
              </li>
            </ul>
          </Section>

          <Section label="Conclusion">
            Paul peut donc, sur le fondement de l'article 1650 du Code civil, exiger le paiement
            du solde de 200 € auprès de Julie. À défaut de règlement amiable, il pourra agir en
            justice pour obtenir l'exécution forcée, le cas échéant assortie de dommages et
            intérêts pour le préjudice subi du fait du retard (art. 1231-1 C. civ.).
          </Section>

          <div className="mt-4 pt-4 border-t border-[var(--border-card)] text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-body)]">À retenir&nbsp;:</span> la
            majeure décompose la règle en éléments constitutifs. La mineure rattache CHAQUE
            élément à un fait précis du scénario. La conclusion relie explicitement mineure et
            majeure — elle ne se contente pas d'affirmer.
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
        {label}
      </div>
      <div className="text-[var(--text-body)]">{children}</div>
    </div>
  )
}
