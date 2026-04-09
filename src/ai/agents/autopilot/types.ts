/**
 * Autopilot Mode — shared type definitions.
 *
 * Config, budget, briefing, and engagement types used across
 * the autopilot orchestrator, budget tracker, and UI hooks.
 */

// ─── Configuration ───────────────────────────────────────────

export interface AutopilotConfig {
  enabled: boolean
  tier: 'free' | 'pro'
  /** Max LLM calls the autopilot may consume per day */
  maxDailyLlmCalls: number
  enabledPhases: {
    scout: boolean
    forge: boolean
    eval: boolean
    plan: boolean
    pulse: boolean
  }
}

export const DEFAULT_AUTOPILOT_CONFIG: AutopilotConfig = {
  enabled: false,
  tier: 'free',
  maxDailyLlmCalls: 8,
  enabledPhases: { scout: true, forge: true, eval: true, plan: true, pulse: true },
}

/** Pro tier gets a bigger autopilot budget (25 of 65 daily calls). */
export const AUTOPILOT_BUDGET_PRO = 25
/** Free tier: 8 of 15. */
export const AUTOPILOT_BUDGET_FREE = 8

// ─── Budget Tracking ─────────────────────────────────────────

export interface AutopilotBudget {
  date: string // YYYY-MM-DD — resets daily
  callsUsed: number
  callsByPhase: Record<string, number>
  lastRunByPhase: Record<string, string> // phase → ISO timestamp
}

export const EMPTY_BUDGET: AutopilotBudget = {
  date: '',
  callsUsed: 0,
  callsByPhase: {},
  lastRunByPhase: {},
}

// ─── Phase Cooldowns (ms) ────────────────────────────────────

export const PHASE_COOLDOWNS: Record<string, number> = {
  scout: 60 * 60 * 1000,       // 1 hour
  forge: 2 * 60 * 60 * 1000,   // 2 hours
  eval: 60 * 60 * 1000,        // 1 hour
  plan: 6 * 60 * 60 * 1000,    // 6 hours
  pulse: 30 * 60 * 1000,       // 30 min
  briefing: 24 * 60 * 60 * 1000, // 24 hours
}

// ─── Morning Briefing ────────────────────────────────────────

export interface MorningBriefing {
  date: string
  readinessScore: number
  readinessTrend: 'improving' | 'stable' | 'declining'
  topActions: Array<{
    action: string
    priority: 'critical' | 'high' | 'normal'
    route: string
  }>
  overnightSummary: string
  contentGenerated: {
    conceptCards: number
    flashcards: number
    exercises: number
  }
  focusRecommendation: string
  engagementStatus: string
  daysUntilExam: number | null
  generatedAt: string
  dismissed: boolean
}

// ─── Engagement Insights (PULSE) ─────────────────────────────

export type EngagementInsightType =
  | 'burnout-risk'
  | 'overconfidence'
  | 'optimal-window'
  | 'break-needed'
  | 'momentum'
  | 'study-gap'

export interface EngagementInsight {
  type: EngagementInsightType
  urgency: 'info' | 'attention' | 'urgent'
  title: string
  message: string
  action?: { label: string; route: string }
}

export interface EngagementReport {
  insights: EngagementInsight[]
  burnoutRisk: number   // 0-1
  momentum: number      // 0-1
  optimalHours: string[] // e.g., ["09:00-11:00", "14:00-16:00"]
  avgSessionMinutes: number
  sessionTrend: 'increasing' | 'stable' | 'decreasing'
  analyzedAt: string
}
