/**
 * Audio transcription endpoint — uses Cloudflare Whisper for speech-to-text.
 * Pro only. Rate limited. Accepts audio blob via FormData.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkCostLimits } from '../lib/costProtection'

const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 3600
const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB

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
      return new Response(JSON.stringify({ error: 'Voice mode requires Pro plan' }), {
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
      const rateLimitKey = `transcribe_rate:${jwt.sub}:${Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000))}`
      const currentCount = parseInt((await env.USAGE_KV.get(rateLimitKey)) ?? '0', 10)
      if (currentCount >= RATE_LIMIT) {
        return new Response(JSON.stringify({ error: 'Transcription rate limit exceeded' }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
        })
      }
      await env.USAGE_KV.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_WINDOW_SECONDS })
    }

    // Cost protection
    const costCheck = await checkCostLimits(env, jwt.sub, 'transcribe', jwt.metadata?.plan)
    if (!costCheck.allowed) {
      return new Response(JSON.stringify({ error: costCheck.reason }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Parse FormData
    const formData = await context.request.formData()
    const audioFile = formData.get('audio')
    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Missing audio file in form data' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (audioFile.size > MAX_AUDIO_SIZE) {
      return new Response(JSON.stringify({ error: 'Audio file too large (max 10MB)' }), {
        status: 413, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Transcribe via Cloudflare Workers AI (Whisper)
    const audioBuffer = await audioFile.arrayBuffer()
    const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo' as any, {
      audio: [...new Uint8Array(audioBuffer)],
    }) as { text?: string }

    return new Response(JSON.stringify({ text: result.text ?? '' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[transcribe] Error:', err instanceof Error ? err.message : err)
    return new Response(JSON.stringify({ error: 'Transcription failed' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
}
