# CRFPA Roadmap — Beyond the Coaches

> Written 2026-04-16 as a handoff for a future implementation session. Captures the agreed backlog, sequencing, and standing constraints so we can just pick up and ship.

## Where we are today (shipped)

### Coaches (all live)
- **Syllogisme** — `/legal/syllogisme` — majeure/mineure/conclusion, 3-axis rubric /30
- **Plan détaillé** — `/legal/plan` — dissertation plan, 6-axis rubric /30
- **Fiche d'arrêt** — `/legal/fiche` — real Cour de cassation decision from Vectorize, 5-axis rubric /25
- **Commentaire d'arrêt** — `/legal/commentaire` — intro + plan on real decision, 5-axis rubric /25

### CRFPA vertical shell
- Onboarding fork at `/welcome` — VerticalPicker → CRFPA 3-question form
- Shell: 4-item sidebar (Accueil / Entraînement / Oracle / Historique)
- Atelier `/accueil` — action-chip canvas, optional countdown, optional "Reprendre" banner, recent-exercises strip, documents strip
- Historique `/historique` — merged tabbed list of all coaching sessions
- `profileVertical: 'crfpa' | 'cpge' | 'generic'` on ExamProfile (Dexie v37 backfill)

### Polish
- Draft auto-save (localStorage) on all 4 coaches
- Deep-linking `?session=ID` on coach pages
- "Voir un exemple" on Syllogisme
- Better error messages (quota / rate-limit / auth / network / parse)
- Timer on all 4 coaches (optional, soft expiry, sessionStorage-persisted)
- Oracle CRFPA prompt tuning (syllogisme bias, strict source citations, coach cross-references)

### Infra references for future sessions
- Prompts: `src/ai/prompts/{syllogisme,plan,ficheArret,commentaire}Prompts.ts`
- Coaches: `src/ai/coaching/{syllogisme,plan,ficheArret,commentaire}Coach.ts`
- Stores: `src/ai/coaching/{syllogisme,plan,ficheArret,commentaire}Store.ts`
- Shared: `src/ai/coaching/{coachingClient,coachingErrors,searchHelpers}.ts`
- Random decision endpoint: `functions/api/random-decision.ts`
- Legacy CRFPA-relevant infra to reuse: `src/ai/workflows/{syntheseGeneration,syntheseGrading,casPratiqueGeneration,grandOralGeneration}.ts`, `src/ai/prompts/{syntheseRealPrompts,casPratiquePrompts,grandOralPrompts,fichePrompts}.ts`
- Existing revision fiche infra: `revisionFiches` table in schema, `fichePrompts.ts` (tied to topicId — needs CRFPA-skin)

---

## Accepted scope (what to build next)

### Tier A — core écrit coverage
Both are the biggest missing pieces for real exam prep.

#### 1. Note de synthèse coach
**Why:** 50% of écrit grade. Nothing in the app addresses it for CRFPA.
**What:** 5h exam format — 15-30 documents → 4-5 page synthesis. She writes the synthesis and gets graded on problématisation, citation de chaque doc, hiérarchisation, plan binaire.
**Reuse:** `src/ai/workflows/syntheseGeneration.ts` + `syntheseGrading.ts` + `syntheseRealPrompts.ts` already exist with CRFPA rubric. Needs CRFPA-skin: surface in the vertical, French UI, integrate with coaching store pattern, drop the CPGE-flavored framing.
**Entry point:** `/legal/synthese` + tab in LegalPageTabs + Atelier card + Historique filter.
**Estimate:** 2-3 days.

#### 2. Full cas pratique coach
**Why:** The other half of the écrit. Syllogisme is a 15-min chunk; real cas pratique is 3h, 3-5 interconnected questions.
**What:** AI generates a complex scenario with multiple legal issues, student works through 3-5 sub-questions. Graded holistically + per question.
**Reuse:** `casPratiqueGeneration.ts` + `casPratiquePrompts.ts` exist. Per-sub-question grading can reuse the Syllogisme rubric. Need articulation grading on TOP (does she handle transitions between issues?).
**Entry point:** `/legal/cas-pratique` + tab + Atelier card.
**Estimate:** 2 days if we leverage existing infra.

### Tier B — compounding-value infra
These two unlock everything else.

#### 3. RAG over her uploaded cours
**Why:** Right now she can upload docs but the coaches don't see them. Fixing this makes Oracle + coaches + fiches all smarter with her personal material.
**What:** Vectorize her uploaded docs (per-profile) → `searchPersonalDocs(query, profileId)` tool the Oracle can call. Also available to coaches for "based on your cours on topic X..." grounding.
**Reuse:** The existing legal-search infra (HF embedding + Vectorize). Need a per-user index or metadata-filtered shared index. BGE-M3 client-side embedding already wired in `src/ai/tools/legalSearchTool.ts`.
**Decision point at start:** per-user Vectorize namespace vs shared index with `userId` metadata filter (cost vs simplicity).
**Estimate:** 2-3 days.

#### 4. AI fiches de révision on demand
**Why:** Daily-use tool. She picks a thème and gets a CRFPA-grade summary. Much better with #3 (uses her cours).
**What:** User flow — she picks a thème (dropdown of CRFPA themes OR free-text OR "from my cours on X"). AI generates a structured fiche: Définitions · Règles et articles-clés · Grands arrêts · Pièges classiques · Mnémotechniques.
**Reuse:** `fichePrompts.ts` exists but is topic-scoped (CPGE). Needs a CRFPA-specific builder that takes a theme (or theme + retrieved chunks) instead of topic+course-chunks.
**Storage:** new `fichesRevision` table scoped by profile (or reuse `revisionFiches` with a CRFPA flavor).
**Entry point:** `/legal/fiches` (new tab) OR inside Atelier as a card.
**Estimate:** 1-2 days.

### Tier C — standalone utilities
Build when we have bandwidth, not blocking daily use.

#### 5. Carnet d'arrêts
**Why:** Every morning she'll want to revise 10-20 grands arrêts. Physical notebooks don't have search, tags, or cross-linking.
**What:** Curated DB of ~200-300 must-know decisions. Each with: visa / formule de principe / portée / articulation / tags. Plus her personal additions + annotations + "I keep forgetting this one" pins.
**Reuse:** 9k Judilibre decisions already in Vectorize — we can seed by picking the most-cited "grands arrêts" list. Manual curation for the canonical top 300 is the slow part.
**Entry point:** `/legal/carnet-arrets` (new sidebar item? or sub-tab of Oracle?).
**Estimate:** 2-3 days (curation is the bottleneck).

#### 6. Grand oral trainer
**Why:** 15-min prep + 15-min Q&A on libertés fondamentales. Only relevant last 2-3 months before orals.
**What:** AI presents a topic (article DDHC, question actualité, scenario), gives her 15 min prep time (she takes notes), then runs an interactive Q&A as an examinateur might.
**Reuse:** `grandOralGeneration.ts` + `grandOralPrompts.ts` exist. Need a Q&A chat mode rather than one-shot generation.
**Entry point:** `/legal/grand-oral`.
**Estimate:** 2-3 days. **Defer** unless exam date within 3 months.

#### 7. Annales library
**Why:** Real past papers from IEJs = killer practice material.
**What:** Curated index of 5-10 years of sujets zéro / sujets CRFPA, with correction if available. Filterable by year, matière, type (synthèse / cas pratique).
**Reuse:** Generic document upload infra exists. Would need ingestion of ~50-100 real PDFs + manual metadata tagging.
**Entry point:** `/legal/annales`.
**Estimate:** Ingestion-heavy. Weekend project. **Defer.**

#### 8. Legal style coach
**Why:** CRFPA is partly about writing like a jurist.
**What:** Standalone mode — she pastes a paragraph (from one of her own writings) and gets feedback on lexique juridique (verbes canoniques, archaïsmes à éviter, anglicismes, précision des formulations "il convient de / au visa de / sur le fondement de").
**Reuse:** Just `coachingCallJson` with a new prompt. No new infra.
**Entry point:** Small card in Atelier or sub-tab under Entraînement.
**Estimate:** 1 day.

#### 9. PDF export
**Why:** She'll want to review corrections on paper.
**What:** Export a graded coaching session (syllogisme / plan / fiche / commentaire / synthèse / cas pratique) as a clean PDF with rubric + her submission + model.
**Reuse:** Browser print-to-PDF or a client-side PDF lib. No LLM involved.
**Estimate:** 1-2 days (styling the print view is the annoying part).

---

## Explicitly out of scope (user rejected)

- **Daily plan / "Aujourd'hui" view** — no suggested daily exercises, no "here's what to do today."
- **Progress dashboard / score trending / coverage map** — no "you've improved 3 points on problématique this week" charts.
- **Score reference bands / thresholds** — no "17/30 = passable" labels superimposed on the rubric.
- **Streaks, XP, gamification of any kind**.
- **Anything that looks like a productivity nanny**.

Rationale (direct quote from the user): *"I don't want anything that looks like 'you're late' or 'do this queue' shit. That's bad UX and doesn't serve any purpose."*

The app is a **tool**, not a coach/nanny. She opens it to do work, she closes it when done. No guilt, no dashboard, no pressure.

---

## Standing constraints (honor every time)

These come from earlier sessions and should not need re-asking.

### Prompt validation gate
**Before writing ANY code** for quality-sensitive AI features (new coaches, new grading prompts):
1. Draft the prompt (system + user template)
2. Run it against 2-3 test scenarios with weak + strong fake submissions
3. Show expected JSON outputs
4. User approves OR iterates
5. Only then code

This is non-negotiable. Skipping it has bitten us before.

### No emojis in AI output
All grading prompts, all generation prompts, all Oracle prompts forbid emojis. Never slip this.

### Hardcoded French on CRFPA surfaces
No i18n keys. Match the existing pattern from Syllogisme/Plan/Fiche/Commentaire components. French is authoritative — English variants only if we specifically want a bilingual surface (rare).

### Coaching stores use `coachingSessions` table
Every new coach type extends the `CoachingType` union in `src/db/schema.ts`. Type values so far: `'syllogisme' | 'fiche-arret' | 'plan-detaille' | 'commentaire-arret'`. Store files follow the pattern in `src/ai/coaching/*Store.ts`. No new tables for per-coach data unless genuinely needed.

### Atelier + Historique + LegalPageTabs integration
Every new coach requires updates to:
- `src/components/legal/LegalPageTabs.tsx` — add a tab
- `src/pages/CRFPAAtelier.tsx` — add action card, include in recent strip + resume banner
- `src/pages/CRFPAHistorique.tsx` — add filter tab + toRow converter
- `src/components/Layout.tsx` — include route in "Entraînement" active state
- `src/App.tsx` — lazy import + route

Pattern is mechanical — don't skip or the new coach feels orphaned.

### coachingCallJson over workflow orchestrator
The orchestrator (`src/ai/orchestrator/`) is for resumable multi-step background jobs. Coaches are synchronous — student waits. Use `coachingCallJson<T>()` from `src/ai/coaching/coachingClient.ts`.

### Draft auto-save + deep-linking + error classification
All four existing coaches have these. New coaches MUST have them too:
- `localStorage` draft per session, cleared on submit/delete/reset
- `?session=ID` deep-link handled in the page with `useSearchParams` + `loadSession()`
- `classifyCoachingError() + formatCoachingError()` on error paths

### Hook + page + editor + results pattern
Every new coach has 5 files that mirror the existing pattern exactly:
- `src/ai/prompts/{name}Prompts.ts`
- `src/ai/coaching/{name}Coach.ts`
- `src/ai/coaching/{name}Store.ts`
- `src/hooks/use{Name}Coach.ts`
- `src/pages/{Name}Coach.tsx`
- `src/components/legal/{Name}Editor.tsx`
- `src/components/legal/{Name}Results.tsx`

Total ~7 files per coach. Look at Commentaire (the most recent) for the canonical shape.

---

## Recommended order for the next implementation session

In my opinion, going 1 → 2 → 3 → 4 in order maximizes shipped value:

1. **Note de synthèse coach** (Tier A #1) — single biggest unlocked value
2. **Full cas pratique coach** (Tier A #2) — completes the écrit coverage
3. **RAG over her cours** (Tier B #3) — compounds everything else
4. **AI fiches de révision** (Tier B #4) — daily-use tool, benefits from #3

After those four, she has a complete CRFPA daily-use product. Tier C items can be picked up opportunistically.

Alternative framings I considered and rejected:
- "Carnet d'arrêts first" — nice surface but standalone; doesn't unlock anything else.
- "RAG first" — tempting because it compounds, but Note de synthèse is half her exam grade, which trumps compounding.
- "AI fiches first" — she can already chat with Oracle for informal summaries; fiches are better WITH RAG.

## One thing to verify before starting

**The `/api/random-decision` endpoint has never been tested in production.** If Vectorize metadata keys differ from my assumptions (`codeName: "Jurisprudence — Chambre ..."`), both Fiche d'arrêt and Commentaire d'arrêt coaches return empty results. **Test this first** — `/legal/fiche`, click "Tirer une décision." If it fails, fixing the metadata filter is a 15-minute unblock.

## Files touched by this roadmap (for quick orientation)

- Docs: `docs/crfpa-coaching-features-plan.md` (original 5-phase plan), `docs/crfpa-roadmap.md` (this file)
- Memory: `~/.claude/projects/-Users-chedlyboukhris-Desktop-studykit/memory/project_crfpa_coaching_phases.md` (status tracker)
- The whole `src/ai/coaching/`, `src/ai/prompts/` (the coaches-related subset), `src/hooks/use*Coach.ts`, `src/pages/{SyllogismeCoach,PlanCoach,FicheArretCoach,CommentaireCoach,CRFPAAtelier,CRFPAHistorique,Onboarding}.tsx`, `src/components/legal/*`, `src/components/onboarding/*` trees.
