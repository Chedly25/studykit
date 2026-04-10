/**
 * Vision endpoint — uses Anthropic Haiku to extract text from images.
 * Pro only. Rate limited. Accepts image via FormData.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkCostLimits } from '../lib/costProtection'
import { checkRateLimit } from '../lib/rateLimiter'

const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 3600
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_PROMPT = 'Extract all text from this image. Preserve formatting, equations (use LaTeX $...$ notation), and structure. Return only the extracted text, no commentary.'

const GRADING_PROMPT = `Tu es un professeur agrégé de prépa MP/MP* qui corrige une copie manuscrite d'étudiant.

**Étape 1 — Transcription** : lis l'image et transcris fidèlement le travail de l'étudiant. Utilise LaTeX pour toutes les formules mathématiques ($...$ pour inline, $$...$$ pour display).

**Étape 2 — Analyse** : identifie ce que l'étudiant essaie de démontrer ou calculer.

**Étape 3 — Correction ligne par ligne** : évalue chaque étape du raisonnement :
- ✅ correcte (rigoureuse, juste)
- ⚠️ partielle (résultat correct mais justification incomplète, ou hypothèses non vérifiées)
- ❌ erronée (erreur de calcul, raisonnement faux, contre-sens)

**Étape 4 — Feedback** : pour chaque erreur, explique clairement :
- Ce qui est faux
- Pourquoi c'est faux
- Comment corriger

**Format de sortie** : retourne UNIQUEMENT un JSON strict (pas de markdown, pas de texte autour) :
\`\`\`json
{
  "transcription": "la transcription complète en LaTeX markdown",
  "problemStatement": "l'énoncé ou le but de l'exercice (1 phrase)",
  "steps": [
    { "line": 1, "content": "contenu de la ligne", "status": "correct" | "partial" | "error", "feedback": "commentaire précis (vide si correct)" }
  ],
  "overallScore": 12,
  "maxScore": 20,
  "summary": "bilan général en 2-3 phrases (points forts, points faibles)",
  "suggestions": ["amélioration 1", "amélioration 2"]
}
\`\`\`

Sois honnête et rigoureux. Un étudiant de prépa préfère une correction sévère et juste à une correction complaisante.`

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.env) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context
  const cors = corsHeaders(env)

  try {
    if (!env.CLERK_ISSUER_URL) {
      return new Response(JSON.stringify({ error: 'Auth not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Vision not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Auth
    const authHeader = context.request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL, env.CLERK_JWT_AUDIENCE)

    // Pro only
    if (jwt.metadata?.plan !== 'pro') {
      return new Response(JSON.stringify({ error: 'Photo scan requires Pro plan' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit
    if (!env.USAGE_KV) {
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
        status: 503, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    {
      const rl = await checkRateLimit(env.USAGE_KV, 'vision', jwt.sub, RATE_LIMIT, RATE_WINDOW_SECONDS)
      if (!rl.allowed) {
        return new Response(JSON.stringify({ error: 'Vision rate limit exceeded' }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
        })
      }
    }

    // Cost protection
    const costCheck = await checkCostLimits(env, jwt.sub, 'vision', jwt.metadata?.plan)
    if (!costCheck.allowed) {
      return new Response(JSON.stringify({ error: costCheck.reason }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Parse FormData
    const formData = await context.request.formData()
    const imageFile = formData.get('image')
    if (!imageFile || !(imageFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Missing image file in form data' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (imageFile.size > MAX_IMAGE_SIZE) {
      return new Response(JSON.stringify({ error: 'Image too large (max 5MB)' }), {
        status: 413, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const mode = formData.get('mode')
    const prompt = mode === 'grade' ? GRADING_PROMPT : DEFAULT_PROMPT
    const maxTokens = mode === 'grade' ? 8192 : 4096

    // Convert to base64 using chunked encoding (avoids call stack overflow on large files)
    const imageBuffer = await imageFile.arrayBuffer()
    const bytes = new Uint8Array(imageBuffer)
    let base64 = ''
    const CHUNK = 8192
    for (let i = 0; i < bytes.length; i += CHUNK) {
      base64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    base64 = btoa(base64)

    // Detect media type via magic bytes (don't trust client-provided type)
    const MAGIC: Array<[string, number[]]> = [
      ['image/jpeg', [0xFF, 0xD8, 0xFF]],
      ['image/png',  [0x89, 0x50, 0x4E, 0x47]],
      ['image/gif',  [0x47, 0x49, 0x46]],
      ['image/webp', [0x52, 0x49, 0x46, 0x46]], // RIFF header; full check includes WEBP at offset 8
    ]
    let mediaType: string | null = null
    for (const [mime, sig] of MAGIC) {
      if (sig.every((b, i) => bytes[i] === b)) {
        if (mime === 'image/webp' && !(bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)) continue
        mediaType = mime
        break
      }
    }
    if (!mediaType) {
      return new Response(JSON.stringify({ error: 'Unsupported image format. Use JPEG, PNG, GIF, or WebP.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Call Anthropic Vision API
    const anthropicBody = {
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }

    const llmResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    })

    if (!llmResponse.ok) {
      const errText = await llmResponse.text()
      console.error('[vision] Anthropic error:', llmResponse.status, errText.slice(0, 500))
      return new Response(JSON.stringify({ error: 'Vision processing failed. Please try again.' }), {
        status: 502, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const result = await llmResponse.json() as {
      content: Array<{ type: string; text?: string }>
    }

    const text = result.content
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text)
      .join('')

    return new Response(JSON.stringify({ text }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[vision] Error:', err instanceof Error ? err.message : err)
    return new Response(JSON.stringify({ error: 'Vision processing failed' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
