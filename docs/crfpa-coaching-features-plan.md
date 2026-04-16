# CRFPA Coaching Features — Implementation Plan

## Context

StudiesKit now has:
- 60,630 vectors in Cloudflare Vectorize (intfloat/multilingual-e5-large, 1024-dim):
  - 51,554 chunks from 15 French legal codes (Code civil, pénal, travail, etc.)
  - 8,960 Cour de Cassation decisions (Judilibre API)
  - 105 constitutional/CEDH/RGPD/TFUE/adages chunks
- `/legal` chat page powered by Claude Sonnet 4.6 with streaming + tool calling
- `searchLegalCodes` tool (vector search via HuggingFace Inference API → Vectorize)
- Full CRFPA exam infrastructure: cas pratique, note de synthèse, grand oral generation + grading workflows
- Citation verification already built into grading (regex extraction + Vectorize lookup)
- Conversation persistence via `src/ai/messageStore.ts`

**Pedagogical philosophy**: AI must TEACH, not do the work for students. No generators that produce exam answers. Instead: graders, coaches, and trainers that correct student work and explain methodology.

**User is building these for his wife who is starting CRFPA prep.**

---

## Feature 1: Syllogisme Juridique Coach

### What it does
Student writes their legal reasoning for a problem in three parts:
1. **Majeure** (the rule: article + interpretation)
2. **Mineure** (applying the rule to facts)
3. **Conclusion** (legal answer)

AI grades EACH part separately and explains what's wrong methodologically, not just factually.

### Why it matters
This is THE core skill CRFPA tests in every cas pratique. No other tool teaches it systematically. Students typically struggle with:
- Incomplete majeure (cites article but doesn't unpack its elements)
- Mineure that lists facts without mapping to the majeure
- Missing or implicit conclusion

### UX flow
1. Dedicated page `/legal/syllogisme-coach` (or a mode toggle in `/legal`)
2. Student picks a difficulty / theme (or uses "random" mode)
3. AI presents a mini-scenario (1-2 sentences of facts + a legal question)
4. Student fills 3 text areas: Majeure / Mineure / Conclusion
5. Submit → AI grades each section with specific rubric:
   - Majeure: article cited (✓/✗), article correctly interpreted (✓/✗), elements identified (list what's missing)
   - Mineure: each fact mapped to a majeure element (✓/✗ per element)
   - Conclusion: explicit (✓/✗), logically derived (✓/✗), nuanced (✓/✗)
6. Shows a model syllogisme side-by-side with explanations

### Files to create
- `src/pages/SyllogismeCoach.tsx` — Page component
- `src/components/legal/SyllogismeEditor.tsx` — 3-panel editor for majeure/mineure/conclusion
- `src/components/legal/SyllogismeGrading.tsx` — Grading display with rubric
- `src/ai/prompts/syllogismePrompts.ts` — Two prompts:
  - `buildScenarioPrompt`: generates a mini-scenario with hidden model syllogisme
  - `gradeSyllogismePrompt`: grades student's work against the model
- `src/ai/workflows/syllogismeCoach.ts` — Workflow: generate → wait for student → grade

### Tech approach
- Scenario generation: call `/api/legal-chat` (Claude Sonnet 4.6) with `searchLegalCodes` to ground the scenario in a real article
- Store the "model syllogisme" server-side only (don't show to student)
- Grading: Claude compares student's 3 sections to the model, returns structured JSON:
  ```json
  {
    "majeure": { "score": 0-10, "articleCorrect": bool, "elementsComplete": bool, "missingElements": ["..."], "feedback": "..." },
    "mineure": { "score": 0-10, "mapping": [{"element": "...", "mapped": bool, "feedback": "..."}], "feedback": "..." },
    "conclusion": { "score": 0-10, "explicit": bool, "justified": bool, "feedback": "..." },
    "overall": { "score": 0-30, "topMistake": "...", "strength": "..." }
  }
  ```
- Save attempts to IndexedDB (new table `SyllogismeAttempt` or reuse `QuestionResult`)

### Routing
- Add route `/legal/syllogisme` to `src/App.tsx`
- Add nav link in legal chat sidebar or a "Entraînement" dropdown

---

## Feature 2: Fiche d'arrêt Trainer

### What it does
AI picks a real Cour de Cassation decision from our 9,000+ corpus → student writes a proper fiche d'arrêt → AI grades against the 5-part format.

### Why it matters
The fiche d'arrêt is a core CRFPA skill tested in cas pratique ("commentez l'arrêt…"). Students need to practice distinguishing:
- Faits matériels vs procédure
- Moyens du pourvoi vs question de droit
- Attendu de principe vs motivation
- Solution de la Cour vs portée

Our 9,000-decision corpus means the student can practice indefinitely with real decisions.

### UX flow
1. Page `/legal/fiche-arret`
2. Student picks: chamber (social, civil, pénal...) + difficulty + date range, or "random"
3. AI fetches a decision from Vectorize metadata filter (chamber + published)
4. Student sees the raw decision text
5. Student writes 5 sections:
   - Faits
   - Procédure
   - Moyens du pourvoi
   - Question de droit
   - Solution & portée
6. Submit → AI grades each section separately

### Grading criteria per section
- **Faits**: only material facts, chronological, no procedure mixed in
- **Procédure**: 1ère instance → appel → cassation, concise
- **Moyens**: reformulation claire, pas recopié mot pour mot
- **Question de droit**: abstraite, formulation interrogative, vise la règle
- **Solution & portée**: résume le dispositif + explique l'innovation/confirmation

### Files to create
- `src/pages/FicheArretTrainer.tsx`
- `src/components/legal/DecisionViewer.tsx` — Displays the raw Cour de Cassation decision
- `src/components/legal/FicheEditor.tsx` — 5-section editor
- `src/ai/prompts/ficheArretPrompts.ts` — Grading rubric prompt
- `src/ai/workflows/ficheArretCoach.ts` — Picks decision + grades fiche
- Optional: `functions/api/random-decision.ts` — Backend endpoint to pick a decision matching filters (queries Vectorize with metadata filter)

### Tech approach
- Vectorize stores decisions with metadata: `codeName: "Jurisprudence — [chamber]"`. Filter by `codeName` to get decisions from specific chamber.
- For random selection: query Vectorize with a random vector + metadata filter, take top 1 with score < threshold (random-ish).
  - Alternative: maintain a separate KV list of decision IDs and random-pick.
- Grading: Claude Sonnet 4.6 with the full decision text as context, comparing student's 5 sections to what a proper fiche would contain.
- Cache the selected decision by ID so reloads don't change mid-practice.

### Difficulty levels
- **Beginner**: Assemblée plénière or published Civ. 3ème decisions (clearer structure)
- **Intermediate**: Regular Civ. 1/2/3, Soc, Com chambers
- **Advanced**: Mixed chamber decisions, complex moyens

---

## Feature 3: Plan Détaillé Coach

### What it does
Student drafts an exam plan (I/A, I/B, II/A, II/B) for a legal question → AI critiques structure, coherence, article choice, transitions.

### Why it matters
CRFPA cas pratique and synthèse demand a problematized 2-part plan. Students struggle with:
- Descriptive vs problematized structure
- Logical flow between I and II
- Balance between parts (I shouldn't be 80% of the analysis)
- Missing the key articles that anchor each part
- Overlap between I/A and II/A

### UX flow
1. Page `/legal/plan-coach`
2. AI presents a legal question (or student pastes their own)
3. Student fills 5 inputs:
   - Problématique (the legal question reformulated)
   - I (title)
   - I/A and I/B (subtitles)
   - II (title)
   - II/A and II/B (subtitles)
4. Optional: short justification for each part
5. Submit → AI grades with detailed critique

### Grading dimensions
- **Problématique**: captures the real legal tension (not descriptive)
- **Binary structure**: I vs II reflects a real opposition/progression
- **Balance**: I/A, I/B, II/A, II/B are roughly equal in scope
- **No overlap**: I/A and II/A treat different issues
- **Coverage**: the plan addresses the full question
- **Article anchoring**: each subpart has a clear textual basis
- **Transitions**: logical flow between parts

### Files to create
- `src/pages/PlanCoach.tsx`
- `src/components/legal/PlanEditor.tsx` — Structured plan input
- `src/components/legal/PlanCritique.tsx` — Grading display
- `src/ai/prompts/planCoachPrompts.ts`
- `src/ai/workflows/planCoach.ts`

### Grading prompt structure
```
You are a CRFPA commission member evaluating a student's exam plan.

LEGAL QUESTION: {question}
STUDENT'S PLAN:
Problématique: {problematique}
I. {I_title}
  A. {IA_title}
  B. {IB_title}
II. {II_title}
  A. {IIA_title}
  B. {IIB_title}

Evaluate along these axes (1-5 each):
- Problématique quality
- Binary opposition (I vs II)
- Balance across subparts
- No-overlap guarantee
- Full coverage of the question
- Article/jurisprudence anchoring (use searchLegalCodes to check)
- Transition logic

For each axis: score + 1-sentence feedback + specific fix suggestion.
Then give the ONE most important improvement.
```

---

## Shared Infrastructure

### Common components to build once, reuse

**`src/components/legal/GradedRubric.tsx`** — Generic rubric display:
- Shows each criterion with score (bar or stars)
- Expandable feedback per criterion
- Color-coded (green/amber/red)
- Used by all 3 features

**`src/ai/workflows/coachWorkflow.ts`** — Generic coach workflow pattern:
```typescript
createCoachWorkflow({
  generateTask: () => Promise<Task>,
  gradeSubmission: (task, submission) => Promise<Grading>,
  sessionId: string,
})
```

**`src/db/schema.ts`** — Add:
```typescript
interface CoachingSession {
  id: string
  type: 'syllogisme' | 'fiche-arret' | 'plan-detaille'
  task: string            // JSON: the task data
  submission?: string     // JSON: student's submission
  grading?: string        // JSON: grading result
  createdAt: string
  completedAt?: string
}
```

### Integration with existing features
- Each coach feeds into a unified **progress tracking** — track which methodology skills the student has mastered
- Link to the main tutor: when tutor detects a student struggling with methodology, suggest the relevant coach
- Spaced repetition: resurface past incorrect answers for review

---

## Build Order (Recommended)

### Phase 1 — Foundation (shared components)
- `CoachingSession` DB schema
- `GradedRubric.tsx` component
- Generic coach workflow pattern

### Phase 2 — Syllogisme Coach (simplest, highest ROI)
- Scenario generation prompt
- Grading prompt with JSON rubric
- Page + editor + results display
- Route `/legal/syllogisme`

### Phase 3 — Plan Détaillé Coach
- Plan grading prompt
- Page + editor
- Route `/legal/plan`

### Phase 4 — Fiche d'arrêt Trainer
- Decision picker (Vectorize metadata filter)
- Fiche grading prompt
- Page + decision viewer + fiche editor
- Route `/legal/fiche-arret`

### Phase 5 — Progress tracking
- Aggregate skills mastery from all 3 coaches
- Dashboard view of weak areas
- Personalized daily practice recommendation

---

## Key Technical Notes

### Claude Sonnet 4.6 for grading
- All grading uses `/api/legal-chat` endpoint (already built, uses Sonnet 4.6)
- Model is excellent at structured JSON output with rubric scoring
- Request max_tokens: ~4000 for grading (allow detailed per-criterion feedback)
- Set `tool_choice: "none"` for grading calls (we just want the text response, not tool calls)

### Searching the legal corpus
- `searchLegalCodes(query, topK)` tool is already wired
- For decision selection in Fiche Trainer: use Vectorize metadata filter `{ codeName: "Jurisprudence — Chambre sociale" }` etc.
- For plan coach: let Claude call searchLegalCodes to verify the student's article citations

### Persistence
- All student attempts saved to `CoachingSession` table
- Enables: history, progress tracking, revisiting past mistakes, spaced repetition

### Rate limiting
- `/api/legal-chat` already has 30/hr per user limit
- Grading calls are heavier than chat — consider separate quota (e.g. 10 gradings/hour)
- Admin users (with `role: admin` JWT metadata) bypass limits

---

## Non-Goals (Do NOT Build)

- **Plan generators** (that produce the plan FOR the student) — anti-pedagogical
- **Syllogisme generators** — same
- **Fiche d'arrêt generators** — same
- Auto-completion of legal reasoning — only correction, not generation
- "Do my homework" style features

---

## Success Metrics

- Student engagement: daily active use of at least one coach
- Skill improvement: grading scores trend upward over time on repeat attempts
- Coverage: student practices all 3 methodologies, not just the easiest one
- Exam success: students using the coaches pass CRFPA at higher rates
