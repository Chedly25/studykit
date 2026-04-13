# StudyKit — Pain Points & Treatments

**Date:** 2026-04-10
**Scope:** Full-app audit from a student's perspective, with concrete treatment plans per pain point.
**Status:** Implementation complete (2026-04-13). See completion status below.

---

## Completion Status (as of 2026-04-13)

| # | Pain point | Status | Commits |
|---|---|---|---|
| 1 | Chat is the center of gravity | DONE | d25c338, f90eaac |
| 2 | Decision fatigue everywhere | DONE | 9999713 |
| 3 | Documents are second-class citizens | DONE | 2fe49a6, cc48576 |
| 4 | AI content quality has cracks | DONE | 242445e, 27ef4fa |
| 5 | No escape hatch when AI fails | DONE | b625750 |
| 6 | Fragmented session loop | SKIPPED | User decided not worth the risk/effort |
| 7 | Thin emotional / motivational layer | DEFERRED | Future work |
| 8 | Mobile compromised for real studying | DEFERRED | Future work (partially addressed by PP1-3) |
| 9 | Swarm invisible in the wrong way | DONE | db0988e |
| 10 | Smaller cleanup items | DONE | See below |

**PP10 sub-items:** 10a Home redirect (fixed), 10b quiz persistence (fixed in PP1), 10c AI feedback (already existed), 10d i18n (already clean), 10e service worker (already handled).

---

## Original Index (for reference)

| # | Pain point | Severity | Effort | Prompt-first |
|---|---|---|---|---|
| 1 | Chat is the center of gravity | High | M | No |
| 2 | Decision fatigue everywhere | High | S–M | No |
| 3 | Documents are second-class citizens | Critical | M–L | Partial |
| 4 | AI content quality has cracks | Critical | L | Yes |
| 5 | No escape hatch when AI fails | Medium | S–M | Partial |
| 6 | Fragmented session loop | Medium | L | No |
| 7 | Thin emotional / motivational layer | Medium | M | No |
| 8 | Mobile compromised for real studying | High | M | No |
| 9 | Swarm invisible in the wrong way | Medium | S–M | Partial |
| 10 | Smaller cleanup items | Low–Medium | S each | No |

---

## Pain Point 1 — Chat is the center of gravity

**Severity:** High | **Effort:** Medium | **Prompt-first:** No

### The problem

The v4 vision states: *"AI as invisible swarm. Chat is ONE feature, not THE product."* The reality contradicts this. Chat is the gravitational center of every interactive flow:

- **StudySession** (`src/pages/StudySession.tsx:277-298`) has 6 tabs — Course, Cards, Exercises, Review, Map, Chat — but the non-chat tabs are read-only satellites. The interactive actions eventually route into chat.
- **Concept card "Quiz me" button** (`src/pages/StudySession.tsx:404`) dumps `Quiz me on X` into chat rather than opening a quiz widget.
- **SessionSuggestions chips** (`src/components/session/SessionSuggestions.tsx:74`) send prompts to chat. Every suggestion is a chat prompt, not a structured action.
- **Reader "Quiz on highlights"** (`src/pages/DocumentReader.tsx:50-56`) constructs a prompt and injects it into the reader chat pane.
- **Onboarding** (`src/pages/Onboarding.tsx` + `src/ai/workflows/onboardingAgent.ts`) is a ~1400-line chat flow.
- **Dashboard empty state** (`src/components/dashboard/ActiveDashboard.tsx:113`) fires a custom event `open-chat-panel` as its CTA.

Every "do something" path eventually hands the student to a text box.

### Student impact

- Friction: typing a sentence is slower than clicking a button.
- Inconsistency: the same intent ("quiz me") produces different results depending on how the chat interprets it.
- Loss of structured state: chat messages don't have the affordances of proper UI (progress, completion, restart, persistence).
- Conceptual confusion: students open a "learning app" and find themselves talking to a chatbot. They don't trust that anything is happening because everything is text.

### Treatment

Chat becomes a **side panel reserved for open-ended follow-up questions only**. Every current chat-as-action flow becomes a structured component with proper UI state.

### Implementation checklist

- [ ] Inventory every current `onSend(prompt)` call site across the codebase and classify each as "action" or "question":
  - SessionSuggestions chips
  - Concept card strip "Quiz me" buttons
  - Fiche viewer "Test me" actions
  - Reader highlights "Quiz me"
  - Empty states
- [ ] For each "action" classification, design the structured UI replacement:
  - `Explain X from basics` → inline streaming explanation card with source citations, "follow-up" button opens chat
  - `Quiz me on X` → inline 5-question quiz widget (reuses `InlineQuiz.tsx` but properly persisted)
  - `Common mistakes on X` → card listing past errors from `questionResults` + LLM summary
  - `Key concepts for X` → concept cards strip
  - `Review my flashcards` → inline flashcard review widget
  - `What's important for my exam?` → opens the recommender insights panel
- [ ] **StudySession restructure**: reduce tabs to Learn / Practice (see Pain Point 2 for tab-collapse details). Chat becomes a slide-in side panel from either mode.
- [ ] **DocumentReader**: add a "Quick actions" strip at the top of the chat pane or as a floating toolbar:
  - Summarize this page
  - Explain selection
  - Test me on this section
  - Find related docs in my library
  - Generate flashcards from this section
- [ ] **Onboarding**: keep as a chat flow (it genuinely is a conversation) but stop treating it as the *model* for the rest of the app. Consider replacing the AI-first default with an AI-assisted wizard where each step has a structured form with AI suggestions — the `ManualSetupForm` already exists as evidence this pattern works.
- [ ] **Dashboard empty-state CTAs**: replace chat-panel triggers with direct routes (Upload, Start session, Browse tutors).
- [ ] Remove the `open-chat-panel` custom event pattern or make it explicit when used.

### Dependencies

- Pair with Pain Point 2 (StudySession tab collapse). Both restructure the same pages.
- Depends on Pain Point 10 quiz persistence fix — structured quiz widgets need to survive refresh.

### Open questions

- Should the chat panel be available globally (sidebar on every page) or only on pages where it makes sense (Session, Reader)?
- For onboarding, is the chat flow actually the right model, or should it become a wizard with AI-assisted steps?
- Full inventory of structured actions: I listed ~6 above. Are there others we're missing? (e.g., "find past exam questions on this")
- Should the chat side panel share conversation across pages, or be scoped per-page?

---

## Pain Point 2 — Decision fatigue everywhere

**Severity:** High | **Effort:** Small–Medium | **Prompt-first:** No

### The problem

A stressed student opening the app is forced to make too many micro-decisions before they can study:

- **StudySession tabs** (`src/pages/StudySession.tsx:277-298`): 6 view modes (Course, Cards, Exercises, Review, Map, Chat). No "start here" default.
- **Exam types**: Types A/B/C (MCQ, document exam, note de synthèse) each have different renderers, flows, results pages. Students studying mixed subjects context-switch between them.
- **Dashboard zombie cards**: ~13 card components defined in `src/components/dashboard/` that are imported nowhere in the codebase (verified via grep, requires re-verification before deletion):
  - HeroFocusCard, DecisionConsoleCard, TodaysPriorityCard, NextStepsCard, MilestoneTrackerCard
  - ExamCountdownCard, HabitGoalsCard, LearningProfileCard, StudyPlanCard, TodaysPlanCard
  - WeeklyScheduleCard, AchievementsCard, AttentionCard
- **Analytics page** (`src/pages/Analytics.tsx`, 607 lines): renders 10+ cards in a single page — StudyStreakCard, InsightCard, IntelligenceBriefCard, LandscapeCard, CalibrationChart, ErrorPatternChart, MasteryTrendChart, ExamPatternsCard, MisconceptionCard, GapAnalysisCard, etc. No hierarchy.
- **MegaMenu**: shows 8-9 items with several Pro-only branded. Half the menu is disabled for free users.
- **Navigation redundancy**: Dashboard "Start session" button and "Today" bottom nav go to the same route, with no indicator they're equivalent.

### Student impact

- Decision paralysis. Every click burns willpower that should be spent studying.
- Zombie code signals abandoned experiments and reduces trust in the product.
- Analytics page is "here are all your stats" instead of "here's what to do next" — useless at 3am when grinding.

### Treatment

Aggressively collapse surface area. Halve the number of decisions a student has to make between "open app" and "start studying."

### Implementation checklist

**StudySession — collapse 6 tabs to 2:**
- [ ] Merge Course + Cards + Map + Review into a single **Learn** mode (Map becomes an "Explore concept graph" button inside Learn)
- [ ] Merge Exercises + chat follow-ups into a single **Practice** mode
- [ ] Chat becomes a slide-in side panel from either mode (see Pain Point 1)
- [ ] Default tab on session start: determined by mastery — low mastery → Learn, high mastery → Practice
- [ ] Preserve view state across tab switches within a session

**Dashboard — delete zombies:**
- [ ] Re-verify the 13 zombie components have zero imports across the entire codebase (including dynamic imports, lazy loads, and admin routes) before deletion
- [ ] Delete confirmed zombies
- [ ] Document why each was deleted (in commit message) so they can be resurrected if needed
- [ ] Final `ActiveDashboard` shape (4 sections, nothing else):
  1. Hero: greeting + readiness bar + primary CTA
  2. Today's Focus: top 3 weakest topics with inline quick-starts (not links that leave the page — buttons that start immediately)
  3. Agents at work: compact narrative strip (see Pain Point 9)
  4. Tutors / subjects grid

**Analytics — stat dump → actionable cards:**
- [ ] Reduce top-level to 3 cards:
  1. **This week**: minutes studied, items completed, mastery delta — one card with small sparkline
  2. **Your 3 weakest topics**: with a "Start 15 min" button next to each
  3. **Recommended next actions**: 2–3 concrete CTAs from the recommender agent
- [ ] Move everything else (CalibrationChart, ErrorPatternChart, MisconceptionCard, etc.) under a "Show full analytics" expander, default collapsed
- [ ] Full analytics expander can be split into sub-tabs (Trends, Errors, Patterns) for power users

**Exam types — unified entry:**
- [ ] `/practice-exam` detects the active profile's exam type and routes internally to the right renderer
- [ ] Unified results schema across A/B/C: score, breakdown by topic, recovery plan, export
- [ ] Post-exam screen has the same shape regardless of exam type, so students don't context-switch visually

**MegaMenu cleanup:**
- [ ] Audit which items are actually needed in the top nav
- [ ] Move Pro-only items to a separate section or show them clearly as "Pro features"
- [ ] Remove items duplicated in the sidebar

### Dependencies

- StudySession tab collapse pairs with Pain Point 1 (chat-as-side-panel).
- Analytics simplification can be done independently.
- Zombie deletion must be preceded by a re-verification pass.

### Open questions

- For StudySession, is "Learn" vs "Practice" the right binary? Or should it be "Study" (everything) with sub-modes revealed as needed?
- Analytics: should the 3 cards be configurable (power users might want to pin different cards to the top)?
- MegaMenu: is the desktop sidebar sufficient, or do we need the MegaMenu at all?
- Should we preserve navigation to the old Analytics views via admin flag for power users?

---

## Pain Point 3 — Documents are second-class citizens

**Severity:** Critical | **Effort:** Medium–Large | **Prompt-first:** Partial (semantic search ranking may need prompt iteration)

### The problem

The vision says "document-first, AI has complete context on all documents." The reality treats documents as inert storage:

- **No within-document search** (`src/pages/DocumentReader.tsx`, `src/components/reader/PdfScrollViewer.tsx`). No Ctrl+F. Students scroll to find text.
- **No table of contents / outline.** The `scrollToPage` API exists on the viewer ref but is only invoked when chat cites a page.
- **No semantic search across the corpus.** Sources page search is title-only (`src/components/sources/SourceList.tsx:37-41`). Can't search document content.
- **No tags, folders, or categories.** Documents are a flat list of cards. At 30+ documents, unmanageable.
- **No highlight summary view.** Highlights are saved per-document but there's no "show me all yellow highlights" aggregation.
- **Mobile reader broken** (`src/pages/DocumentReader.tsx:307-326`): chat opens as a full-screen modal; PDF disappears entirely. Cannot read a question and see the AI's explanation at the same time.
- **Upload fragility** (`src/hooks/useSources.ts:79-186`):
  - No file size pre-validation (50MB limit in `src/lib/pdfParser.ts:7` but student learns after the upload fails)
  - No cancel button during batch upload
  - No resume on network failure
  - Sequential processing — 5 files = 50-150 seconds on slow network
  - Error messages are generic ("Upload failed")
- **Zoom resets per page load** (`src/pages/DocumentReader.tsx:35`).

### Student impact

A student with 30+ documents cannot find anything. A student on the subway trying to upload notes before class loses the upload on network glitches. A student reading a 200-page textbook cannot jump to chapter 5 or search for a term. A student on mobile cannot read the PDF and the AI explanation at the same time.

This is the single biggest gap between the vision and the reality.

### Treatment

Make documents first-class. Students can find anything in seconds, read on any device, and trust uploads to complete.

### Implementation checklist

**3a. Global semantic search (Cmd+K, highest impact)**
- [ ] Cmd+K opens a search overlay with a single input (existing `SearchModal.tsx` is a starting point)
- [ ] As student types, query `documentChunks` via embedding similarity (embeddings already exist)
- [ ] Results grouped by document, each showing the matching snippet with highlight + page number
- [ ] Click a result → jumps into the reader at that page with the snippet highlighted
- [ ] Also indexes: subject/topic names, past exam attempts, flashcards, fiches
- [ ] Keyboard navigation (up/down arrow, enter)
- [ ] Recent searches shown when input is empty
- **Prompt-first:** ranking / re-ranking of results may benefit from an LLM re-rank pass for natural-language queries; test on real queries first

**3b. Within-document search (Ctrl+F)**
- [ ] Use pdfjs `findController` — integrate with existing `PdfScrollViewer`
- [ ] Show match count, next/prev buttons, case-sensitivity toggle
- [ ] Highlight matches in the text layer
- [ ] Mobile-friendly search bar

**3c. Auto-generated table of contents**
- [ ] On document upload, extract PDF bookmarks if present via pdfjs's outline API
- [ ] If no bookmarks, infer from heading sizes in the text layer (largest font + bold → level 1, next → level 2, etc.)
- [ ] Store as `documentOutline` on the document record
- [ ] Render as a collapsible left sidebar in the reader
- [ ] Clicking a heading jumps to that page
- [ ] Mobile: accessible via a "TOC" button in the toolbar
- **Heuristic caveat:** inferred TOC will be imperfect for some documents; show a "report incorrect TOC" button

**3d. Content search on Sources page**
- [ ] Extend the existing search box to query `documentChunks.content` (fuzzy match or embedding similarity)
- [ ] Show matching snippet under the document card when search is active
- [ ] Highlight matched terms in the snippet
- [ ] Fall back to title search if content search is too slow or times out

**3e. Tags + basic organization**
- [ ] Add `tags: string[]` field to documents schema (migration needed)
- [ ] Auto-tag on upload using the existing classifier (Course, Exam, Notes, Reference)
- [ ] Manual tag add/remove on each document card
- [ ] Tag filter chip bar on Sources page
- [ ] Keep it simple: no nested folders, just flat tags
- [ ] Bulk tag operations (select multiple documents, add/remove tag)

**3f. Highlight aggregation**
- [ ] New route `/highlights` or a tab on Sources
- [ ] Shows all highlights grouped by document, then by page
- [ ] Filter by color, search within highlight text
- [ ] "Quiz me on these highlights" button (uses structured quiz widget, not chat injection)
- [ ] Export highlights as markdown or PDF

**3g. Upload resilience**
- [ ] Pre-validate file size before parse: inline error with "Max 50MB, your file is 62MB"
- [ ] Chunked upload with progress persistence — if the tab reloads mid-upload, resume from where it stopped (store chunk state in IndexedDB)
- [ ] Background upload queue component visible from any page (header indicator)
- [ ] Cancel button per file
- [ ] Better error messages: distinguish "file too big", "scanned PDF (no text)", "network error", "corrupted file"
- [ ] Retry queue — failed uploads sit in a "retry" state rather than being lost
- [ ] Progress bar per file (not just status text)

**3h. Mobile reader split-view**
- [ ] Replace full-screen chat modal with a draggable bottom sheet
  - Collapsed: PDF fills screen, small "chat" handle at bottom
  - Mid: PDF 50%, chat 50%
  - Full: chat fills screen (current behavior)
- [ ] User can drag the handle to resize
- [ ] On landscape, go back to side-by-side layout
- [ ] Zoom persistence in localStorage per document
- [ ] Larger hit targets on toolbar buttons (48px min)

### Dependencies

- 3a (semantic search) depends on embeddings being reliably populated on existing documents — may need a migration to re-embed docs without embeddings.
- 3c (TOC) depends on pdfjs outline API support across PDF versions.
- 3g (upload resilience) is a significant refactor of the upload pipeline.

### Open questions

- Should semantic search return full snippets with context, or just titles? (Trade-off: relevance vs. snappiness)
- For tags, should we have system tags (auto-applied) separate from user tags, or merge them?
- TOC inference heuristic: how much effort to spend on edge cases vs. "works for 80% of documents"?
- Mobile reader bottom sheet: use a library (react-spring) or build custom?
- Should content search use embeddings (slower, better relevance) or BM25/fuzzy (faster, simpler)?

---

## Pain Point 4 — AI content quality has cracks

**Severity:** Critical | **Effort:** Large (iterative) | **Prompt-first:** YES for every sub-item

### The problem

Multiple cracks in AI-generated content that a real student will notice and that will destroy trust:

**4a. Fiche truncation** (`src/ai/workflows/ficheGeneration.ts:88`): `courseContent.slice(0, 40000)` — truncates to 40k characters. On multi-part topics, the fiche cuts off mid-way.

**4b. Topic extraction bias** (`src/ai/topicExtractor.ts:58`): samples only the first 8k characters per document. For a 500-page textbook, extracted topics are biased toward chapter 1.

**4c. MCQ grading fragility** (`src/ai/workflows/practiceExamGrading.ts:68-75`): uses case-insensitive string matching for option comparison. Special characters (H₂O vs H2O), punctuation, or trailing whitespace can cause correct answers to be marked wrong.

**4d. Grounding not enforced.** The system prompt (`src/ai/systemPrompt.ts`) treats `searchSources` as an optional enrichment tool, not as a mandatory first step. Students who uploaded their professor's definition of a concept get generic Wikipedia-style explanations instead. This destroys the core value proposition of a document-first app.

**4e. Chat context window** (`src/ai/agents/chatRouter.ts:36-39`): only ~6 prior messages retained. In a 20-message tutoring session, the AI loses earlier context and can contradict itself.

**4f. Insight generator threshold** (`src/ai/insightGenerator.ts:16-18`): requires 4+ user messages. Focused 2-3 message sessions leave no trace on the student's model.

**4g. Rule 20 forces immediate quiz** (`src/ai/systemPrompt.ts:155`): when a student says "quiz me", AI immediately calls `renderQuiz` without assessing readiness. A low-mastery student gets pummeled by advanced questions.

**4h. Opaque tool calls** (`src/components/chat/ToolCallIndicator.tsx`): "Searching sources..." with no indication of what's being searched, what was found, or whether results were zero.

**4i. Citations not validated** (`src/ai/systemPrompt.ts:185-186`): the AI is instructed to cite in a specific format but there's no check that cited chunks actually exist in the `documentChunks` table.

**4j. Subjective grading lacks rubric** (`src/ai/workflows/practiceExamGrading.ts:96+`): LLM is asked to grade written answers with minimal rubric context, leading to inconsistent scoring.

### Student impact

- Incomplete fiches → "this fiche is missing half the topic" → loss of trust
- Wrong topics extracted → study plan biased toward chapter 1 → real weaknesses missed
- Correct answers marked wrong → rage after a 90-minute exam
- Generic explanations → "why did I upload my textbook if the AI isn't using it?" → value proposition broken
- Long sessions degrade → AI repeats itself or contradicts earlier points → frustration
- Immediate quiz at wrong difficulty → student gets discouraged
- Invisible tool failures → student thinks AI knows things it doesn't

### Treatment

Every item in this section needs **prompt iteration with user approval BEFORE coding**. The pattern for each:

1. Draft the new prompt
2. Run on 3-5 real test cases (from user's actual content)
3. Show user the output
4. Iterate until approved
5. Then code

### Implementation checklist

**4a. Fiche truncation**
- [ ] Redesign fiche generation to handle full course content
- [ ] Approach A (map-reduce): chunk course content, summarize each chunk, synthesize into final fiche
- [ ] Approach B (single-pass): use a long-context model if budget allows
- [ ] Approach C (subtopic-first): identify subtopics first, generate a section per subtopic, stitch
- **Validate first:** pick one real topic with lots of content. Draft prompts for A, B, C. Show all three outputs. User picks the winner.

**4b. Topic extraction bias**
- [ ] Sample evenly across the document (e.g., 5 chunks spread across the document: start, 25%, 50%, 75%, end)
- [ ] Extract topics from each sample
- [ ] Merge topic lists with deduplication and conflict resolution
- **Validate first:** test on a 500-page textbook. Compare old topic list vs new. User judges whether the new list is more complete.

**4c. MCQ grading fragility**
- [ ] Fix data model: store option INDEX on student answer, not option TEXT
- [ ] Fix renderer to record index on click
- [ ] Fix grader to compare indices, not strings
- [ ] For free-form MCQ (rare), use embedding similarity between student text and each option with a threshold, LLM judge as fallback
- [ ] Add "dispute this grade" button on results page → modal where student explains → LLM re-runs with the student's argument as context
- **Validate first:** the grade-dispute re-judge prompt needs user approval before coding

**4d. Grounding in user materials (THE BIG ONE)**
- [ ] Rewrite system prompt to require `searchSources` before any conceptual answer
- [ ] If no relevant chunks found, AI prefixes response with: "I don't see this in your uploaded materials — here's a general explanation:"
- [ ] Add structural enforcement: `requireSourceGrounding` flag on `useAgent` that forces a tool call before text output on conceptual questions
- [ ] Pedagogical rewrite: include actual tutoring theory (scaffolding, zone of proximal development, formative assessment) in the system prompt
- **Validate first:** draft the new system prompt. Prepare 5 test scenarios:
  1. Concept with strong source match
  2. Concept with partial source match
  3. Concept with no source match (AI should be honest)
  4. Ambiguous question requiring clarification
  5. Edge case (student asks about something tangential)
  Run all 5 with old and new prompt. User judges each one before we touch code.

**4e. Chat context window**
- [ ] Raise retained verbatim messages from 6 to 20
- [ ] For messages beyond 20, auto-summarize into a rolling summary kept in context
- [ ] Verify token budget on worst case (long messages, tool calls, attachments)
- **Validate first:** minor — just confirm summarization prompt quality on a long real session

**4f. Insight generator threshold**
- [ ] Lower threshold from 4 to 2 messages
- [ ] Change prompt to be opportunistic: generate insight only if there's something concrete to say, don't force output on trivial exchanges
- [ ] Add a "no insight to generate" return path
- **Validate first:** test on real short sessions. Verify the LLM doesn't hallucinate insights when there's nothing useful to record.

**4g. Rule 20 renderQuiz rewrite**
- [ ] Rewrite Rule 20 in system prompt: AI decides based on mastery signal
  - Low mastery → explain first, then quiz
  - High mastery → quiz at appropriate difficulty
  - Ambiguous → diagnose with 1 probing question first
- [ ] Pass mastery as structured context to the LLM
- **Validate first:** test on 3 scenarios (low/high/ambiguous mastery with "quiz me"). User judges whether behavior matches pedagogy.

**4h. Opaque tool calls**
- [ ] `ToolCallIndicator` shows query + result count while searching
- [ ] On zero results, surface visible message: "Searched 3 documents, nothing matched 'X'"
- [ ] Optional: click-to-expand to see which documents were searched
- [ ] Applies to all tools: `searchSources`, `searchConceptCards`, `searchExerciseBank`, etc.

**4i. Citation validation**
- [ ] Before rendering assistant message, parse citations
- [ ] Check each cited chunk exists in `documentChunks` table
- [ ] Strip invalid citations (with optional warning log)
- [ ] Render only validated citations as clickable links

**4j. Subjective grading rubric**
- [ ] Generate an explicit rubric per exam type (CPGE proof, CRFPA synthèse, MCQ explanation, etc.)
- [ ] Pass rubric as structured input to the grader prompt
- [ ] Store rubric with exam so grades are reproducible
- **Validate first:** draft rubrics for each exam type, run grading on real student answers, user judges consistency

### Dependencies

- 4d (grounding) is the most important item in this document. Everything else in Pain Point 4 is secondary to this.
- 4c depends on a schema/data model fix that affects the renderer, grader, and stored results.
- 4j depends on having rubric templates defined.

### Open questions

- For 4d, how strict should source grounding be? 100% of conceptual answers, or only when the student explicitly asks "according to my notes"?
- For 4c, how to handle existing graded exams with text-based answers? Migrate or leave as-is?
- For 4a, is the budget available for long-context models, or do we need to stick with map-reduce?
- For 4i, what happens if EVERY citation is invalid? Do we still render the response or refuse?
- Should we add a "the AI was wrong here" feedback button so users can flag issues (ties into Pain Point 10 feedback loop)?

---

## Pain Point 5 — No escape hatch when AI fails

**Severity:** Medium | **Effort:** Small–Medium | **Prompt-first:** Partial (dispute flow needs prompt validation)

### The problem

When AI-driven flows fail, the student has no useful next action — just a retry button that often hits the same failure:

- **Onboarding error banner** (`src/pages/Onboarding.tsx:789-791`): only has "Retry" button. The `useFallback` flag exists in `onboardingAgent.ts` but isn't surfaced as a user-facing "Use manual setup" button.
- **Upload failures** (`src/hooks/useSources.ts:116`): generic "Upload failed" toast. Student can't tell if it's file size, network, corruption, or scanned PDF.
- **Subjective grading**: no way for student to dispute a grade they think is wrong.
- **Topic resolution silent-switch** (`src/pages/StudySession.tsx:91-113`): if no topic in URL, `computeDailyRecommendations` silently picks one. Student may think they're studying topic A when the app switched them to topic B.
- **Chat tool call failures**: silent fallback; student doesn't know the AI failed to find sources.

### Student impact

- Students give up instead of retrying smartly.
- Correct-but-marked-wrong grades destroy trust and can't be corrected.
- Silent topic switches confuse the study session.

### Treatment

Every AI failure surfaces a useful next action. Manual paths are always available.

### Implementation checklist

**5a. Onboarding escape hatch**
- [ ] Add "Use manual setup instead" secondary button to the error banner alongside Retry
- [ ] Auto-fall to manual after 2 consecutive failures (the `useFallback` flag already exists, just expose)
- [ ] Make the `ManualSetupForm` discoverable from the start — add a "Skip to manual setup" link in the welcome screen
- [ ] Manual setup should support adding topics by typing/pasting (currently relies on AI extraction)

**5b. Upload failure diagnostics**
- [ ] Distinguish error types and show specific messages:
  - File too big: "File is 62MB, max is 50MB. Compress it or split into parts."
  - Scanned PDF: "No text found — this looks scanned. Try OCR first, or upload a text version."
  - Network error: "Connection dropped. Retry?" with retry preserving progress
  - Corrupted file: "This file appears damaged. Try re-downloading the original."
- [ ] Show the diagnostic in a persistent panel (not just a dismissible toast)
- [ ] Provide retry-with-fix actions where applicable

**5c. Grade dispute flow**
- [ ] Add "I think this grade is wrong" button on the exam results page for any subjective question
- [ ] Opens a modal: student explains why they disagree (free text)
- [ ] LLM re-judges with the student's argument as explicit evidence
- [ ] If grade changes, update and show the new grade with explanation
- [ ] If grade stays, show a detailed reason so the student understands
- [ ] Log disputes for admin review (flag for human review if dispute rate is high)
- **Validate first:** draft the re-judge prompt. Test on 3 real disputes (real or simulated). User approves before coding.

**5d. Topic resolution banner**
- [ ] If `StudySession` auto-picks a different topic than the URL param (or no URL param at all), show a small inline banner at the top of the session:
  - "Studying: **[topic name]** · Switch to another topic?"
- [ ] Banner is dismissible
- [ ] The "switch" action opens a topic picker modal with search

**5e. Tool call failure visibility**
- [ ] Tied to Pain Point 4h — when a tool call returns zero results or errors, the student sees it
- [ ] The AI response should not pretend the tool didn't run

### Dependencies

- 5c (grade dispute) ties into Pain Point 4j (subjective grading rubrics). Both should be designed together.
- 5e overlaps with 4h.

### Open questions

- For 5b, is there existing error taxonomy in the codebase we can reuse, or do we need to define it?
- For 5c, should disputes be rate-limited? (A student could dispute every question in bad faith.)
- For 5c, what's the cost budget for re-judge LLM calls? (If every student disputes 10 questions, that's 10x the grading cost.)
- For 5a, should we measure how often onboarding fails currently to know if this is urgent?

---

## Pain Point 6 — Fragmented session loop

**Severity:** Medium | **Effort:** Large (schema changes) | **Prompt-first:** No

### The problem

The app has three separate "study loops" that compete and don't talk to each other:

- **DailyQueue** (`src/pages/DailyQueue.tsx`, 739 lines): flashcards + exercises + concept quizzes, unified queue
- **StudySession** (`src/pages/StudySession.tsx`, 456 lines): topic-scoped, 6 views, chat-centered
- **PracticeExam** (`src/pages/PracticeExam.tsx`, 473 lines): exam simulation with 3 sub-types

Each has its own session tracking, completion UI, celebration, results. A student who does 20 min of queue + 30 min of study session + 60 min of practice exam has **three separate session entries** with no unified "today I studied for 110 minutes" view.

The `/study-time-tracker` tool is a separate page entirely — redundant with proper session tracking.

### Student impact

- No unified picture of today's studying
- Celebration is fragmented across three surfaces
- Session data is split across tables, making it hard to compute accurate metrics
- Students lose the "one coherent effort" feeling that's motivationally important

### Treatment

One session = one chunk of time, regardless of activities inside it. DailyQueue items, StudySession exchanges, and PracticeExam attempts all log as activities under the current session.

### Implementation checklist

**6a. Unified schema**
- [ ] Design a new session schema: `StudySession { id, profileId, startedAt, endedAt, activities: [...] }`
- [ ] Activity types: `queue-item`, `chat-turn`, `exam-attempt`, `reader-view`, `quiz-completion`
- [ ] Each activity has: `type`, `targetId` (topic, exam, document), `duration`, `outcome` (correct, incorrect, skipped, etc.)
- [ ] Migration plan for existing session data
- **Decision needed:** does the old data stay as-is (archive) or get migrated into the new schema?

**6b. Session lifecycle**
- [ ] Auto-start a session on first activity (first queue item, first chat message, first exam start)
- [ ] Auto-end after N minutes of idle (e.g., 20 min)
- [ ] Explicit "End session" button available
- [ ] Session survives tab close and reloads (IndexedDB persistence)
- [ ] Multiple sessions per day allowed

**6c. Unified "Today" view**
- [ ] Show total minutes studied today across all activities
- [ ] Timeline of today's activities (morning queue, afternoon session, evening exam)
- [ ] What's next: recommended activities based on current session state

**6d. Celebration at session end**
- [ ] Replace per-activity celebrations with a session-end summary
- [ ] "You studied for 47 minutes across 3 activities. Here's what you learned: [mastery deltas, topics touched, achievements]"
- [ ] Confetti or milestone animation for meaningful sessions
- [ ] Share option if student wants to post their session stats

**6e. Delete StudyTimeTracker**
- [ ] Remove the `/study-time-tracker` route and page
- [ ] Remove from navigation
- [ ] Redirect old URLs to the new unified "Today" view

**6f. Backward compatibility**
- [ ] Decide: keep old data as read-only archive or migrate?
- [ ] If migrate, write a migration script with dry-run support
- [ ] Preserve session streaks across the migration

### Dependencies

- None internally. This is a foundational refactor.
- Pain Point 7 (emotional layer) benefits directly from this (session-end celebrations, pick-up-where-you-left-off).

### Open questions

- What's the idle threshold for auto-ending a session? 20 min? 30 min?
- Should sessions span across routes (dashboard → queue → exam) or end when you navigate away from a "studying" surface?
- How should we handle the case where a student starts the queue, abandons, and then starts a different activity 10 min later? Same session or new?
- Backward compatibility: migrate or archive old data?
- If we migrate, what about legacy streak calculations that might break?

---

## Pain Point 7 — Thin emotional / motivational layer

**Severity:** Medium | **Effort:** Medium | **Prompt-first:** No

### The problem

Studying is emotionally brutal. The app has some motivational elements (streaks, readiness bar, level-up banner, confetti, achievement toasts) but misses the moments that matter most to a stressed student:

- **No micro-wins inside the flow**: when a student finally nails a flashcard they've been failing, no meaningful celebration. Just "next."
- **No personal progress narrative**: there's a line chart in analytics but no sentence that says "3 weeks ago you were at 20%, now 47%."
- **No "pick up where you left off"** across the whole app. `queueInProgress` exists on dashboard (`src/pages/Dashboard.tsx:52-60`) but nothing global.
- **Cold post-failure**: bomb a practice exam and you get a score breakdown. No "here's a 15-minute recovery plan, start now."
- **Weak spot nudges buried**: `progress-monitor` insights are in a dashboard card, not ambient or proactive.
- **Streak at risk** (`StreakAtRiskBanner.tsx`) exists but visibility varies by page.

### Student impact

- Progress feels invisible. Students don't see their growth.
- Failure feels final. No recovery path creates learned helplessness.
- Interruptions are lossy. Students forget they had an unfinished session.
- Small wins go uncelebrated, reducing intrinsic motivation.

### Treatment

Bake emotional wins into the existing loops. Every failure has a recovery path. Every session has a pickup point. Progress is narrated, not just charted.

### Implementation checklist

**7a. Micro-wins in queue**
- [ ] Detect "previously failed flashcard now succeeded" via `lapses` counter
- [ ] Inline animation + text: "You just got one you were struggling with"
- [ ] Similar for exercises that were wrong before and now right
- [ ] Don't celebrate every success — only the meaningful ones (first pass, lapse recovery, first attempt at a new concept)

**7b. Personal progress sentence**
- [ ] On Dashboard, add a one-sentence progress narrative above the readiness bar:
  - "3 weeks ago you were at 20%, now at 47%. On pace for 68% by exam day."
- [ ] Computed from historical mastery snapshots (need to ensure snapshots exist)
- [ ] Fallback if insufficient data: "Just getting started — check back next week"
- [ ] Include a tiny sparkline showing the last 4 weeks

**7c. Global "pick up where you left off"**
- [ ] Add a dismissible banner at the top of any page when there's an unfinished session:
  - "You have an unfinished session from 23 min ago. Continue?"
- [ ] Works for queue, study session, practice exam
- [ ] Dismissible per session
- [ ] Tied to Pain Point 6 (unified session tracking)

**7d. Post-failure recovery**
- [ ] Every exam/practice results page ends with a "Recover now" section:
  - "Here's a 15-minute recovery plan for your 3 weakest answers"
  - Auto-generates a mini-queue targeting those weaknesses
  - "Start now" button starts the mini-queue immediately
- [ ] Also on DailyQueue bad rating: "Review this concept now?" inline card (partially exists as inline explanation)

**7e. Ambient weak-spot nudges**
- [ ] Move `progress-monitor` insights out of the buried dashboard card and into a small top strip on relevant pages
- [ ] Format: "You haven't touched X in 14 days. 10 min to recover?" with a direct start button
- [ ] Auto-dismiss after action or after N views
- [ ] Rate-limit: max 1 nudge per page

**7f. Streak protection**
- [ ] Ensure `StreakAtRiskBanner` is visible on all pages when streak is at risk (not just dashboard)
- [ ] Add a "save streak now — 5 min" quick action that creates a minimal queue

**7g. Session-end celebrations (depends on Pain Point 6)**
- [ ] When a session ends, show a celebration screen with:
  - Minutes studied
  - Activities completed
  - Mastery deltas
  - Achievements unlocked
  - "Share" option
- [ ] Confetti for meaningful sessions (new achievements, big mastery gains)

### Dependencies

- 7c and 7g depend on Pain Point 6 (unified session tracking).
- 7b depends on mastery snapshots being reliably stored over time.

### Open questions

- For 7b, what's "on pace" mean mathematically? Linear extrapolation? Weighted by recent trend?
- For 7d, the "recovery plan" generation needs to be good enough — if the plan is bad, this becomes a negative experience. Should it be prompt-first?
- For 7e, how many nudges per day is too many? Need a cap to avoid notification fatigue.
- For 7a, should micro-wins be configurable? Some students find them annoying.
- Is there a risk of the emotional layer feeling "gamified" in a way that CPGE/CRFPA students reject as infantilizing?

---

## Pain Point 8 — Mobile compromised for real studying

**Severity:** High | **Effort:** Medium | **Prompt-first:** No

### The problem

Mobile is desktop-first with mobile polish, not mobile-native. Specific failures:

- **Reader full-screen chat modal** (`src/pages/DocumentReader.tsx:307-326`): when chat opens, PDF disappears. Can't read a question and see the AI's explanation at the same time.
- **No within-document search** on mobile — even worse than desktop because there's no Ctrl+F.
- **Upload fragility** on spotty networks (covered in Pain Point 3g).
- **Zoom resets per page** — annoying with small text.
- **Sources upload buttons** wrap awkwardly at 320px width.
- **DailyQueue inline explanations** can push content off-screen.
- **SessionStart overlay and other modals** sometimes don't fit small viewports.
- **Hit targets** are inconsistent — some icons are below 44px minimum.
- **Landscape mode** is rarely optimized.

### Student impact

A student trying to study on the subway for 30 minutes will hit multiple friction points every session and abandon the app for PDF viewers.

### Treatment

Mobile is a first-class citizen. Subway-test every flow. The core study loops (queue, reader, practice) must work on a phone.

### Implementation checklist

**8a. Reader: bottom-sheet chat**
- [ ] Replace full-screen modal with a draggable bottom sheet:
  - Collapsed (default on PDF open): small handle at bottom, PDF full-height
  - Mid (default when user opens chat): PDF 50%, chat 50%
  - Full (swipe up): chat full-screen, PDF hidden
- [ ] User can drag the handle to resize
- [ ] On landscape, use side-by-side layout
- [ ] Smooth animations

**8b. Reader: zoom persistence**
- [ ] Store current zoom in localStorage per document
- [ ] Restore on reload
- [ ] Also store current page for "continue reading"

**8c. Reader: larger hit targets**
- [ ] Audit all toolbar buttons — minimum 48x48px tap area
- [ ] Close button, zoom buttons, chat toggle, highlight color picker
- [ ] Icon buttons get padding, not just the icon size

**8d. Sources: mobile upload UX**
- [ ] Collapse the 3 upload buttons (Upload, Paste, Note) into a single FAB on mobile
- [ ] FAB opens a sheet with the 3 options
- [ ] Or: single primary "Add source" button that opens a type picker
- [ ] Upload button remains visible while scrolling

**8e. DailyQueue: inline explanation sizing**
- [ ] Ensure inline explanations expand in-place without pushing the queue item off-screen
- [ ] Collapse-by-default on mobile
- [ ] Scroll-into-view on expand

**8f. Modals and overlays: mobile viewport**
- [ ] Audit all modals for small-screen fit
- [ ] SessionStartOverlay, SessionCompletionOverlay, AchievementUnlockModal, etc.
- [ ] Ensure dismissal is thumb-reachable (close buttons in top-right, not top-left)
- [ ] Prevent body scroll when modal is open

**8g. Landscape support**
- [ ] Test and fix critical pages in landscape
- [ ] Reader: side-by-side PDF + chat
- [ ] Dashboard: 2-column layout
- [ ] Session: horizontal tabs instead of stacked

**8h. Background upload queue indicator**
- [ ] Small header indicator when uploads are in progress
- [ ] Click to see upload queue with progress per file
- [ ] Works across route navigation (student can start an upload and browse)

**8i. Navigation: BottomNav audit**
- [ ] Verify BottomNav tabs are all reachable with thumb
- [ ] Active state is clearly visible
- [ ] No tab overlap with system home indicator on iOS

### Dependencies

- 8a and 8b overlap with Pain Point 3h.
- 8h depends on the upload resilience work in Pain Point 3g.

### Open questions

- Should we build a native-feeling app (PWA with service worker) or keep it as responsive web?
- For landscape, how much effort to spend vs. telling users to use portrait?
- Is there analytics data on mobile vs desktop usage split? (Guides priority.)
- For 8h, does the service worker already handle background uploads or do we need to build that?

---

## Pain Point 9 — Swarm is invisible in the wrong way

**Severity:** Medium | **Effort:** Small–Medium | **Prompt-first:** Partial (narrative strings need validation)

### The problem

"Invisible" should mean "doesn't get in the way," not "you can't see what's being done for you." Current reality:

- **ActiveDashboard "Working for you" card** (`src/components/dashboard/ActiveDashboard.tsx:124-148`) is a flat string joined by `·`. It's a vibe, not information.
- **Document upload**: progress status shows "Parsing... Chunking... Embedding..." but doesn't show what the agents do AFTER upload (fiche generation, topic extraction, exam matching).
- **BackgroundJobsIndicator** exists but is a count, not a narrative.
- **Agent insights** are stored in `agentInsights` table but surfacing is inconsistent.
- **Sources page document cards**: no visible agent status per document.

Students can't see what's being done for them, so they don't trust that it's being done.

### Treatment

Make agent work narratively visible without being interruptive. The student sees concrete actions with timestamps and outcomes.

### Implementation checklist

**9a. Document upload cascade**
- [ ] On upload completion, show a progress narrative:
  - "Parsing document... ✓"
  - "Extracting topics... found 12 ✓"
  - "Generating fiches... 2 of 5 ready"
  - "Scanning for past exam questions on these topics..."
  - "Ready"
- [ ] Stays visible for N seconds after completion, then minimizes to a status chip on the document card
- [ ] Click a stage to see details (e.g., which topics were found)

**9b. Agents-at-work header strip**
- [ ] Small indicator in the app header: "3 agents working"
- [ ] Click opens a panel showing:
  - Agent name (human-friendly: "Fiche generator" not "ficheGenerationAgent")
  - What it's doing now
  - ETA
  - Recent completions
- [ ] `BackgroundJobsIndicator` is the starting point — extend with narrative

**9c. "Working for you" card rewrite**
- [ ] Show 2-3 concrete recent actions with timestamps and links:
  - "Generated a fiche on **Integration by parts** — 2h ago" [View]
  - "Found 3 similar **Mines 2019** questions on this topic" [Browse]
  - "Flagged an error pattern in your **conic sections** practice" [Review]
- [ ] No generic "I'm analyzing your progress" strings
- [ ] Narrative strings generated by agents, validated for concreteness
- **Prompt-first:** activity log entry prompts need to be tested — they must be concrete and never generic

**9d. Document card agent status chips**
- [ ] Each document card on Sources shows status:
  - "Topics extracted ✓"
  - "Fiche ready"
  - "4 related exams found"
- [ ] Chips are clickable where they lead somewhere
- [ ] Gray chips for "in progress", colored for complete

**9e. Topic card agent status**
- [ ] Similar chips on topic detail pages:
  - "Recent practice: X correct / Y wrong"
  - "Last studied: 3 days ago"
  - "Fiche version: 2025-11"

### Dependencies

- 9a overlaps with Pain Point 3g (upload resilience) — both change the upload UI.
- 9c depends on agents actually writing useful activity log entries.

### Open questions

- How often do agents actually write to `agentInsights`? Is the data there to power this, or does the pipeline need fixes first?
- For 9a, should the cascade block further uploads or allow the student to browse while it finishes?
- For 9b, should the agents panel show historical agent runs or only active?
- Concrete narrative strings vs templated — how much LLM generation is involved in log entries?

---

## Pain Point 10 — Smaller cleanup items

**Severity:** Low–Medium | **Effort:** Small each | **Prompt-first:** No

### The problem

A collection of smaller issues that don't rise to pain-point status individually but add up:

- **Home renders Dashboard inside itself** (`src/pages/Home.tsx:17-18`): weird coupling, SEO `<Helmet>` is missing the auth branch.
- **Quiz data in transient store** (`src/components/chat/InlineQuiz.tsx:26-28`): refresh loses quiz data, progress not logged via `logQuestionResult`.
- **Citations not validated**: covered in Pain Point 4i.
- **No AI feedback loop**: no way for students to mark an AI response as wrong.
- **i18n fragmentation**: several pages mix English fallbacks, key naming is inconsistent.
- **Context window hardcoded**: covered in Pain Point 4e.
- **Stale memory / agent assumptions**: some agents cache results too aggressively.
- **Service worker cache issues**: stale chunk errors are handled (`src/App.tsx:16-33`) but indicate a deeper issue.

### Student impact

Individually small, collectively signal lack of polish.

### Treatment

Fix each individually as time permits. Most are 1-2 hour tasks.

### Implementation checklist

**10a. Home/Dashboard coupling**
- [ ] Change `/` route: if signed in with profile, redirect to `/dashboard` instead of rendering Dashboard inside Home
- [ ] Home becomes marketing-only for signed-out users
- [ ] Fix SEO meta tags for both branches

**10b. Quiz persistence**
- [ ] Move quiz data from transient store to IndexedDB keyed by message ID
- [ ] On mount, restore quiz state from IndexedDB
- [ ] On completion, log each answer via `logQuestionResult`
- [ ] On abandonment, preserve partial state

**10c. AI feedback loop**
- [ ] Add thumbs up/down buttons on every assistant message
- [ ] Optional text field on thumbs-down: "what was wrong?"
- [ ] Store to a new `aiFeedback` table: { messageId, rating, reason, context, timestamp }
- [ ] Surface in admin analytics for quality monitoring
- [ ] Use as signal for prompt iteration

**10d. i18n cleanup**
- [ ] Audit all pages for hardcoded English strings
- [ ] Standardize key naming conventions (dot.notation.consistent)
- [ ] Move fallback English text into the default locale file
- [ ] Add missing keys for queue, session, reader, etc.

**10e. Service worker / chunk staleness**
- [ ] Investigate why chunk errors happen (are they from stale deploys or something else?)
- [ ] Improve the cache-busting strategy if needed
- [ ] Consider aggressive cache invalidation on version bump

**10f. Topic resolution banner (duplicate of 5d but listed here for completeness)**
- [ ] Already covered in Pain Point 5d

**10g. Analytics cleanup**
- [ ] Verify analytics events are still meaningful post-refactor
- [ ] Remove dead event types
- [ ] Add new events for new features (semantic search usage, dispute submissions, etc.)

### Dependencies

- 10b could be done after Pain Point 1 (structured quiz widgets).
- 10c is independent and valuable to ship early.

### Open questions

- For 10c, should we share feedback data with the tutor agent to self-improve? (Agent self-reflection pattern.)
- For 10e, are stale chunk errors frequent enough to warrant a deeper fix?

---

## Suggested order of operations

From the earlier conversation, here's the phased sequence. This is a recommendation, not a commitment — we'll plan each pain point individually before starting.

### Phase 1 — The grounding fix (highest impact per unit of work)
- Pain Point 4d: Grounding in user materials (prompt-first)
- Pain Point 4h: Tool call transparency
- Pain Point 3b: Ctrl+F in reader
- Pain Point 5: Escape hatches (onboarding, upload diagnostics)

Phase 1 transforms what the AI *actually says* and gives students control when things fail. Nothing else matters if the AI is still ungrounded.

### Phase 2 — The Cmd+K moment
- Pain Point 3a: Global semantic search
- Pain Point 3c: Auto-generated TOC
- Pain Point 3d: Content search on Sources
- Pain Point 2: Decision fatigue cleanup (delete zombies, collapse tabs, simplify Analytics)

Phase 2 delivers the "wow" that makes the app feel like a command center. Pairs naturally with navigation cleanup.

### Phase 3 — Content quality remaining
- Pain Point 4a: Fiche truncation
- Pain Point 4b: Topic extraction bias
- Pain Point 4c: MCQ grading fragility
- Pain Points 4e, 4f, 4g, 4i, 4j: context window, insight threshold, Rule 20, citation validation, subjective rubrics

All prompt-first. One at a time, not batched.

### Phase 4 — Mobile and emotional layer
- Pain Point 8: Mobile reader, upload resilience, layout
- Pain Point 3e, 3f, 3g: Tags, highlights view, upload background queue
- Pain Point 7: Emotional / motivational layer

Makes the product usable everywhere and pleasant to use over time.

### Phase 5 — Infrastructure (last, biggest shifts)
- Pain Point 6: Session unification
- Pain Point 1: Chat-as-side-panel restructure
- Pain Point 9: Narrative swarm visibility

The biggest architectural shifts. Do these only after Phase 1-4 prove the product is worth the refactor.

### Ongoing
- Pain Point 10: Cleanup items mixed in between phases when convenient

---

## Open questions to decide together (before we start planning individual pain points)

1. **Are all 10 pain points in scope, or do we want to drop some?**
2. **Is the phased order correct, or do we want a different sequence?**
3. **For AI-quality items (Pain Point 4), what's our iteration cycle?** (I draft prompt → you review → I iterate → you approve → code.)
4. **Budget questions:**
   - Long-context models for fiche generation (4a)?
   - LLM re-ranking for semantic search (3a)?
   - Grade dispute re-judges (5c)?
5. **Migration strategy for Pain Point 6** (unified sessions): migrate old data or archive?
6. **Mobile strategy**: PWA-first or keep as responsive web?
7. **Zombie deletion policy**: delete outright or keep with `@deprecated` for N months?
8. **Analytics/telemetry**: do we want to instrument the changes to measure impact, or ship and iterate?

---

## Next steps

1. Review this document. Flag anything that's wrong, missing, or unclear.
2. Pick the first pain point to plan in detail. I suggest Pain Point 4d (grounding) as the highest-leverage starting point.
3. For that first pain point, I'll write a detailed scoped plan with prompts (if applicable) for user approval before any code.
4. Iterate until approved.
5. Implement.
6. Move to the next pain point.

No code changes until each pain point has been planned, scoped, and approved individually.
