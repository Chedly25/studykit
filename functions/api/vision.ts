/**
 * Vision endpoint — uses Anthropic Haiku to extract text from images.
 * Pro only. Rate limited. Accepts image via FormData.
 */
import type { Env } from '../env'
import { verifyClerkJWT } from '../lib/auth'
import { corsHeaders } from '../lib/cors'
import { checkCostLimits } from '../lib/costProtection'

const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 3600
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_PROMPT = 'Extract all text from this image. Preserve formatting, equations (use LaTeX $...$ notation), and structure. Return only the extracted text, no commentary.'

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

    const jwt = await verifyClerkJWT(authHeader.slice(7), env.CLERK_ISSUER_URL)

    // Pro only
    if (jwt.metadata?.plan !== 'pro') {
      return new Response(JSON.stringify({ error: 'Photo scan requires Pro plan' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit
    if (env.USAGE_KV) {
      const rateLimitKey = `vision_rate:${jwt.sub}:${Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000))}`
      const currentCount = parseInt((await env.USAGE_KV.get(rateLimitKey)) ?? '0', 10)
      if (currentCount >= RATE_LIMIT) {
        return new Response(JSON.stringify({ error: 'Vision rate limit exceeded' }), {
          status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' },
        })
      }
      await env.USAGE_KV.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_WINDOW_SECONDS })
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

    const prompt = DEFAULT_PROMPT

    // Convert to base64
    const imageBuffer = await imageFile.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))

    // Detect media type
    const mediaType = imageFile.type || 'image/jpeg'
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      return new Response(JSON.stringify({ error: 'Unsupported image format. Use JPEG, PNG, GIF, or WebP.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Call Anthropic Vision API
    const anthropicBody = {
      model: MODEL,
      max_tokens: 4096,
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
