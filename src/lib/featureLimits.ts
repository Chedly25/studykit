/**
 * Shared free-tier feature limits.
 * Single source of truth for client-side limit enforcement.
 * Server-side daily caps are in functions/lib/costProtection.ts (separate deployment).
 *
 * NOTE: These limits are enforced client-side only (via IndexedDB counts).
 * A determined user could bypass them by clearing storage or using DevTools.
 * However, the actual LLM API calls behind these features are gated server-side
 * via costProtection.ts daily caps (free: 0 for /api/fast).
 * True server-side enforcement of these specific counts would require
 * server-side job queuing — tracked as a future improvement.
 */

export const FREE_MONTHLY_EXAM_LIMIT = 2
export const FREE_PROCESSING_LIMIT = 3
