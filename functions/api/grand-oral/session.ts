/**
 * POST /api/grand-oral/session
 * Mints an OpenAI Realtime API ephemeral client secret so the browser
 * can connect WebRTC directly to OpenAI. The server never touches audio —
 * it only builds the jury system prompt, configures tools + VAD, and
 * returns the short-lived token.
 *
 * Access: Pro plan only. 1/day (per costProtection) + 2/month (here).
 *
 * Request body:
 *   { task: GrandOralTask }
 *
 * Response:
 *   { clientSecret, expiresAt, model, voice }
 */
import type { Env } from '../../env'
import { verifyClerkJWT } from '../../lib/auth'
import { corsHeaders } from '../../lib/cors'
import { checkRateLimit } from '../../lib/rateLimiter'
import { checkCostLimits } from '../../lib/costProtection'

const OPENAI_SESSIONS_URL = 'https://api.openai.com/v1/realtime/sessions'
const DEFAULT_MODEL = 'gpt-4o-mini-realtime-preview'
const DEFAULT_VOICE = 'verse'
const MONTHLY_CAP_PRO = 2

interface GrandOralTaskInput {
  sujet: {
    id: string
    text: string
    type: 'question' | 'case' | 'article'
  }
  problematique: string
  expectedPlan: { I: string; IA: string; IB: string; II: string; IIA: string; IIB: string }
}

function buildJurySystemPrompt(task: GrandOralTaskInput): string {
  const planResume = `I. ${task.expectedPlan.I} (A. ${task.expectedPlan.IA} ; B. ${task.expectedPlan.IB}) / II. ${task.expectedPlan.II} (A. ${task.expectedPlan.IIA} ; B. ${task.expectedPlan.IIB})`

  return `Tu es membre du jury du Grand Oral CRFPA. Tu fais passer un candidat qui vient de tirer son sujet il y a une heure.

## CADRE
- 15 min d'exposé (intro + plan I/A I/B II/A II/B + conclusion)
- 30 min de questions-réponses
- Total 45 min

## TON PERSONNAGE
Universitaire ou avocat expérimenté. Français soutenu, précis, sans familiarité. Bienveillant mais exigeant. Pas de tics verbaux.

## PHASE 1 — EXPOSÉ (15 min)
Tu ne dis RIEN, sauf un cas : le candidat cite une décision ou un article qui sonne inventé. Tu l'interromps : "Un instant, Maître — pouvez-vous me redonner la référence exacte ?"
À 14 min : "Il vous reste une minute."
À 15 min : "Je vous remercie. Passons aux questions."

## PHASE 2 — QUESTIONS (30 min)
Tu INTERROMPS mid-phrase quand :
- Le candidat tourne en rond depuis plus de 30 secondes
- Il cite une référence inventée
- Il se contredit par rapport à son exposé
- Il noie le poisson

Pour poser une question de fond, tu APPELLES L'OUTIL get_next_jury_question. L'outil te renvoie une question calibrée sur les vraies références du sujet. Tu la reformules oralement avec ton propre phrasé, mais tu ne changes JAMAIS le contenu juridique.

Tu varies : questions fermées (oui/non), ouvertes, devil's advocate, questions de culture. Tu ne donnes JAMAIS la bonne réponse. Si le candidat se trompe, tu relances ("Êtes-vous certain ?").

## RÈGLE ABSOLUE
Tu ne cites aucune décision, article, auteur en dehors de ce que get_next_jury_question te fournit. Jamais.

## VOIX
Débit normal, posé. Phrases courtes quand tu interromps, plus construites quand tu relances.

## CONTEXTE DE CE CANDIDAT
Sujet tiré : ${task.sujet.text}
Type : ${task.sujet.type}
Plan attendu (ton usage interne, à ne pas révéler) : ${planResume}

Démarre l'épreuve en disant uniquement : "Vous pouvez commencer, Maître."`
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7) // "2026-04"
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cors = corsHeaders(env)
  const jsonH = { ...cors, 'Content-Type': 'application/json' }

  try {
    // Feature flag
    if (env.GRAND_ORAL_ENABLED === 'false') {
      return new Response(JSON.stringify({ error: 'Grand Oral temporarily disabled' }), { status: 503, headers: jsonH })
    }

    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Grand Oral not configured (missing OPENAI_API_KEY)' }), { status: 503, headers: jsonH })
    }

    // Auth
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonH })
    }
    let userId: string
    let plan = 'free'
    try {
      const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)
      userId = jwt.sub
      plan = (jwt.metadata as { plan?: string })?.plan ?? 'free'
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: jsonH })
    }

    if (plan !== 'pro') {
      return new Response(JSON.stringify({ error: 'Grand Oral is a Pro feature', upgradeRequired: true }), { status: 402, headers: jsonH })
    }

    // Rate limit (burst protection: 5/hour)
    if (env.USAGE_KV) {
      const rl = await checkRateLimit(env.USAGE_KV, 'grand-oral-session', userId, 5, 3600)
      if (!rl.allowed) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: jsonH })
    }

    // Daily + global cost cap
    const cost = await checkCostLimits(env, userId, 'grand-oral', plan)
    if (!cost.allowed) return new Response(JSON.stringify({ error: cost.reason ?? 'Daily limit reached' }), { status: 429, headers: jsonH })

    // Monthly cap (2/month for pro — additional to daily cap)
    if (env.USAGE_KV) {
      const monthKv = `monthly:grand-oral:${userId}:${monthKey()}`
      const monthCount = parseInt((await env.USAGE_KV.get(monthKv)) ?? '0', 10)
      if (monthCount >= MONTHLY_CAP_PRO) {
        return new Response(JSON.stringify({ error: `Monthly limit reached (${MONTHLY_CAP_PRO} sessions/month). Resets on the 1st.` }), { status: 429, headers: jsonH })
      }
      await env.USAGE_KV.put(monthKv, String(monthCount + 1), { expirationTtl: 60 * 60 * 24 * 62 })
    }

    // Parse body
    let body: { task: GrandOralTaskInput }
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: jsonH })
    }
    if (!body.task?.sujet?.text || !body.task.expectedPlan) {
      return new Response(JSON.stringify({ error: 'Invalid task payload' }), { status: 400, headers: jsonH })
    }

    // Build jury system prompt + tool definition
    const instructions = buildJurySystemPrompt(body.task)
    const tools = [{
      type: 'function',
      name: 'get_next_jury_question',
      description: 'Appelle cet outil quand tu as besoin de poser une question de fond au candidat pendant la phase de questions-réponses. L\'outil renvoie une question calibrée sur les vraies références du sujet. Tu la reformules oralement, sans changer le contenu juridique.',
      parameters: {
        type: 'object',
        properties: {
          exposeTranscript: { type: 'string', description: 'La transcription complète de l\'exposé de 15 min du candidat' },
          qaSoFar: { type: 'string', description: 'Les échanges question-réponse déjà eus depuis le début de la phase 2' },
          alreadyAsked: { type: 'array', items: { type: 'string' }, description: 'Liste des questions déjà posées, pour ne pas les répéter' },
          difficulty: { type: 'string', enum: ['facile', 'moyen', 'difficile'], description: 'facile = culture générale, moyen = précision, difficile = déstabilisation' },
        },
        required: ['exposeTranscript', 'difficulty'],
      },
    }]

    // Mint ephemeral session
    const model = env.OPENAI_REALTIME_MODEL ?? DEFAULT_MODEL
    const sessionRes = await fetch(OPENAI_SESSIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice: DEFAULT_VOICE,
        modalities: ['audio', 'text'],
        instructions,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
          interrupt_response: true,
        },
        tools,
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 4000,
      }),
    })

    if (!sessionRes.ok) {
      const errText = await sessionRes.text().catch(() => '')
      return new Response(JSON.stringify({ error: `OpenAI sessions: ${sessionRes.status} ${errText.slice(0, 300)}` }), { status: 502, headers: jsonH })
    }

    const session = await sessionRes.json() as {
      id: string
      client_secret: { value: string; expires_at: number }
    }

    return new Response(JSON.stringify({
      sessionId: session.id,
      clientSecret: session.client_secret.value,
      expiresAt: session.client_secret.expires_at,
      model,
      voice: DEFAULT_VOICE,
    }), { status: 200, headers: jsonH })
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders(context.env), 'Content-Type': 'application/json' } },
    )
  }
}
