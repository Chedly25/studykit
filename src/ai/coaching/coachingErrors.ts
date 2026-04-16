/**
 * User-friendly error classification for coaching LLM calls.
 * Distinguishes quota / rate-limit / network / JSON parse / other so the
 * coach can show an actionable French message and suggest a next step.
 */
import { QuotaExceededError } from '../client'

export interface CoachingUserError {
  message: string     // French, user-facing
  hint?: string       // optional action suggestion
  kind: 'quota' | 'rate-limit' | 'auth' | 'network' | 'parse' | 'unknown'
}

export function classifyCoachingError(err: unknown): CoachingUserError {
  if (err instanceof QuotaExceededError) {
    return {
      kind: 'quota',
      message: 'Limite quotidienne atteinte.',
      hint: 'Réessaie demain, ou passe à un plan supérieur pour lever la limite.',
    }
  }

  const anyErr = err as { name?: string; message?: string; status?: number } | null | undefined
  const msg = anyErr?.message ?? ''

  // Aborts aren't really errors — the hook already filters these, but be safe
  if (anyErr?.name === 'AbortError') {
    return { kind: 'unknown', message: 'Opération annulée.' }
  }

  // 429 rate limiting from /api/legal-chat
  if (/429|rate.?limit|too many/i.test(msg)) {
    return {
      kind: 'rate-limit',
      message: 'Trop de requêtes en peu de temps.',
      hint: 'Patiente une minute avant de réessayer.',
    }
  }

  // 401 / auth failures
  if (/401|unauthor|invalid token/i.test(msg)) {
    return {
      kind: 'auth',
      message: 'Session expirée.',
      hint: 'Recharge la page pour te reconnecter.',
    }
  }

  // Fetch / network failures
  if (
    anyErr?.name === 'TypeError'
    && /fetch|network|failed to fetch/i.test(msg)
  ) {
    return {
      kind: 'network',
      message: 'Connexion interrompue.',
      hint: 'Vérifie ta connexion et réessaie.',
    }
  }

  // JSON extraction failures from coachingCallJson
  if (/no JSON|failed to parse JSON|unexpected token|SyntaxError/i.test(msg)) {
    return {
      kind: 'parse',
      message: 'Réponse inattendue du modèle.',
      hint: 'Réessaie — c\'est généralement aléatoire.',
    }
  }

  // Fallback
  return {
    kind: 'unknown',
    message: msg || 'Une erreur est survenue.',
    hint: 'Réessaie dans quelques instants.',
  }
}

/** Format a CoachingUserError as a single string for the error banner. */
export function formatCoachingError(err: CoachingUserError): string {
  return err.hint ? `${err.message} ${err.hint}` : err.message
}
