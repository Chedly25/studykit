/**
 * React hook for autopilot mode — reads config, briefing, engagement insights.
 * Provides toggle and dismiss functions.
 */
import { useState, useEffect, useCallback } from 'react'
import { db } from '../db'
import { loadConfig, saveConfig, getRemainingBudget } from '../ai/agents/autopilot/budgetTracker'
import type { AutopilotConfig, MorningBriefing, EngagementReport } from '../ai/agents/autopilot/types'
import { DEFAULT_AUTOPILOT_CONFIG, AUTOPILOT_BUDGET_PRO, AUTOPILOT_BUDGET_FREE } from '../ai/agents/autopilot/types'

interface UseAutopilotReturn {
  enabled: boolean
  config: AutopilotConfig
  briefing: MorningBriefing | null
  engagement: EngagementReport | null
  budgetUsed: number
  budgetLimit: number
  budgetIsLow: boolean
  toggleAutopilot: (enabled: boolean) => Promise<void>
  updateConfig: (partial: Partial<AutopilotConfig>) => Promise<void>
  dismissBriefing: () => Promise<void>
  loading: boolean
}

export function useAutopilot(examProfileId: string | undefined): UseAutopilotReturn {
  const [config, setConfig] = useState<AutopilotConfig>(DEFAULT_AUTOPILOT_CONFIG)
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null)
  const [engagement, setEngagement] = useState<EngagementReport | null>(null)
  const [budgetUsed, setBudgetUsed] = useState(0)
  const [budgetIsLow, setBudgetIsLow] = useState(false)
  const [loading, setLoading] = useState(true)

  const budgetLimit = config.tier === 'pro' ? AUTOPILOT_BUDGET_PRO : AUTOPILOT_BUDGET_FREE

  // Load all autopilot state
  useEffect(() => {
    if (!examProfileId) return
    let cancelled = false

    async function load() {
      const [cfg, briefingRow, engagementRow, budget] = await Promise.all([
        loadConfig(examProfileId!),
        db.agentInsights.get(`autopilot-briefing:${examProfileId}`),
        db.agentInsights.get(`engagement-monitor:${examProfileId}`),
        getRemainingBudget(examProfileId!),
      ])

      if (cancelled) return

      setConfig(cfg ?? DEFAULT_AUTOPILOT_CONFIG)

      if (briefingRow?.data) {
        try { setBriefing(JSON.parse(briefingRow.data)) } catch { setBriefing(null) }
      }

      if (engagementRow?.data) {
        try { setEngagement(JSON.parse(engagementRow.data)) } catch { setEngagement(null) }
      }

      const limit = cfg?.tier === 'pro' ? AUTOPILOT_BUDGET_PRO : AUTOPILOT_BUDGET_FREE
      setBudgetUsed(limit - budget.calls)
      setBudgetIsLow(budget.isLow)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [examProfileId])

  const toggleAutopilot = useCallback(async (enabled: boolean) => {
    if (!examProfileId) return
    const newConfig = { ...config, enabled }
    setConfig(newConfig)
    await saveConfig(examProfileId, newConfig)
  }, [examProfileId, config])

  const updateConfig = useCallback(async (partial: Partial<AutopilotConfig>) => {
    if (!examProfileId) return
    const newConfig = { ...config, ...partial }
    setConfig(newConfig)
    await saveConfig(examProfileId, newConfig)
  }, [examProfileId, config])

  const dismissBriefing = useCallback(async () => {
    if (!examProfileId || !briefing) return
    const dismissed = { ...briefing, dismissed: true }
    setBriefing(dismissed)
    const key = `autopilot-briefing:${examProfileId}`
    const row = await db.agentInsights.get(key)
    if (row) {
      await db.agentInsights.update(key, { data: JSON.stringify(dismissed) })
    }
  }, [examProfileId, briefing])

  return {
    enabled: config.enabled,
    config,
    briefing,
    engagement,
    budgetUsed,
    budgetLimit,
    budgetIsLow,
    toggleAutopilot,
    updateConfig,
    dismissBriefing,
    loading,
  }
}
