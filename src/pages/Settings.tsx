/**
 * Settings page — Data Management (export/import/progress report).
 * Route: /settings
 */
import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Bell, Cloud, Trash2, Mail, Globe, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { requestPermission, getNotificationStatus, registerServiceWorker } from '../lib/pushNotifications'
import { useExamProfile } from '../hooks/useExamProfile'
import { useCloudSync } from '../hooks/useCloudSync'
import { db } from '../db'
import { exportProfileData, importProfileData, generateProgressReport, downloadBlob } from '../lib/dataExport'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [notifStatus, setNotifStatus] = useState(() => getNotificationStatus())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [digestEnabled, setDigestEnabled] = useState(true)
  const cloudSync = useCloudSync()
  const [searchParams, setSearchParams] = useSearchParams()

  // GDPR consent state
  const [analyticsConsent, setAnalyticsConsent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gdpr_consent') ?? '{}').analytics === true } catch { return false }
  })
  const [errorTrackingConsent, setErrorTrackingConsent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gdpr_consent') ?? '{}').errorTracking === true } catch { return false }
  })
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  const profileId = activeProfile?.id

  // Storage info
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null)
  const [isPersisted, setIsPersisted] = useState(false)
  const [docCount, setDocCount] = useState(0)

  useEffect(() => {
    navigator.storage?.estimate?.().then(est => {
      setStorageInfo({ usage: est.usage ?? 0, quota: est.quota ?? 0 })
    }).catch(() => {})
    navigator.storage?.persisted?.().then(setIsPersisted).catch(() => {})
    if (profileId) {
      db.documentFiles.where('examProfileId').equals(profileId).count().then(setDocCount).catch(() => {})
    }
  }, [profileId])

  // Handle unsubscribe URL param
  useEffect(() => {
    if (searchParams.get('unsubscribe') === 'weekly' && profileId) {
      db.notificationPreferences.where('examProfileId').equals(profileId).first().then(prefs => {
        if (prefs) {
          db.notificationPreferences.update(prefs.id, { weeklyDigest: false })
        }
        setDigestEnabled(false)
        setSearchParams({}, { replace: true })
      })
    }
  }, [searchParams, profileId, setSearchParams])

  // Load digest preference
  useEffect(() => {
    if (!profileId) return
    db.notificationPreferences.where('examProfileId').equals(profileId).first().then(prefs => {
      setDigestEnabled(prefs?.weeklyDigest !== false) // default true
    })
  }, [profileId])

  const updateConsent = (key: 'analytics' | 'errorTracking', value: boolean) => {
    try {
      const existing = JSON.parse(localStorage.getItem('gdpr_consent') ?? '{}')
      const updated = { ...existing, [key]: value, timestamp: new Date().toISOString() }
      localStorage.setItem('gdpr_consent', JSON.stringify(updated))
      if (key === 'analytics') setAnalyticsConsent(value)
      if (key === 'errorTracking') setErrorTrackingConsent(value)
      window.dispatchEvent(new CustomEvent('gdpr-consent-changed'))
    } catch { /* ignore */ }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeletingAccount(true)
    try {
      const token = await getToken()
      const profileIds = activeProfile ? [activeProfile.id] : []
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: 'DELETE', profileIds }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error || 'Deletion failed')
      }
      // Clear all local data
      const dbs = await indexedDB.databases?.() ?? []
      for (const dbInfo of dbs) {
        if (dbInfo.name) indexedDB.deleteDatabase(dbInfo.name)
      }
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/'
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Account deletion failed' })
      setDeletingAccount(false)
    }
  }

  const handleExport = async () => {
    if (!profileId) return
    setExporting(true)
    setMessage(null)
    try {
      const blob = await exportProfileData(profileId)
      const name = activeProfile?.name?.replace(/\s+/g, '-').toLowerCase() ?? 'profile'
      downloadBlob(blob, `studieskit-${name}-${new Date().toISOString().slice(0, 10)}.json`)
      setMessage({ type: 'success', text: t('settings.exportSuccess') })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('settings.exportFailed') })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMessage(null)
    try {
      const result = await importProfileData(file)
      if (result.success) {
        setMessage({ type: 'success', text: t('settings.importSuccess') })
      } else {
        setMessage({ type: 'error', text: result.error ?? t('settings.importFailed') })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('settings.importFailed') })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleProgressReport = async () => {
    if (!profileId) return
    setGeneratingReport(true)
    setMessage(null)
    try {
      const blob = await generateProgressReport(profileId)
      const name = activeProfile?.name?.replace(/\s+/g, '-').toLowerCase() ?? 'profile'
      downloadBlob(blob, `progress-report-${name}-${new Date().toISOString().slice(0, 10)}.md`)
      setMessage({ type: 'success', text: t('settings.reportSuccess') })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('settings.reportFailed') })
    } finally {
      setGeneratingReport(false)
    }
  }

  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('settings.title')}</h1>
        <p className="text-[var(--text-muted)]">{t('settings.createProfilePrompt')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">{t('settings.createProfile')}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6">{t('settings.title')}</h1>

      {/* Data Management */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">{t('settings.dataManagement')}</h2>
        <p className="text-sm text-[var(--text-muted)]">
          {t('settings.dataManagementDesc')}
        </p>

        {/* Status message */}
        {message && (
          <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        <div className="space-y-3">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-card)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-50 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              {exporting ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : <Download className="w-5 h-5 text-blue-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.exportAllData')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('settings.exportAllDataDesc')}</p>
            </div>
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-card)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-50 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              {importing ? <Loader2 className="w-5 h-5 text-purple-500 animate-spin" /> : <Upload className="w-5 h-5 text-purple-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.importData')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('settings.importDataDesc')}</p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />

          {/* Progress Report */}
          <button
            onClick={handleProgressReport}
            disabled={generatingReport}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-card)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-50 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              {generatingReport ? <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" /> : <FileText className="w-5 h-5 text-emerald-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.downloadReport')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('settings.downloadReportDesc')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Storage */}
      <div className="glass-card p-5 space-y-4 mt-4">
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">{t('settings.storage')}</h2>
        {storageInfo && storageInfo.quota > 0 && (
          <>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--text-body)]">
                  {formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}
                </span>
                <span className="text-[var(--text-muted)]">
                  {Math.round((storageInfo.usage / storageInfo.quota) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--border-card)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    storageInfo.usage / storageInfo.quota > 0.8 ? 'bg-red-500' : 'bg-[var(--accent-text)]'
                  }`}
                  style={{ width: `${Math.min(100, (storageInfo.usage / storageInfo.quota) * 100)}%` }}
                />
              </div>
            </div>
            {docCount > 0 && (
              <p className="text-xs text-[var(--text-muted)]">
                {t('settings.docFilesStored', '{{count}} document files stored locally', { count: docCount })}
              </p>
            )}
            {storageInfo.usage / storageInfo.quota > 0.8 && (
              <p className="text-xs text-amber-600">
                {t('settings.storageFull')}
              </p>
            )}
          </>
        )}
        {!isPersisted && navigator.storage?.persist && (
          <button
            onClick={async () => {
              const granted = await navigator.storage.persist()
              setIsPersisted(granted)
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-card)] hover:bg-[var(--bg-input)] transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.protectData')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('settings.protectDataDesc')}</p>
            </div>
          </button>
        )}
        {isPersisted && (
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <Shield className="w-3.5 h-3.5" /> {t('settings.storageProtected')}
          </div>
        )}
      </div>

      {/* Language */}
      <div className="glass-card p-5 space-y-4 mt-4">
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">{t('settings.language')}</h2>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border-card)]">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.displayLanguage')}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('settings.languageDesc')}</p>
          </div>
          <select
            value={i18n.language?.startsWith('fr') ? 'fr' : 'en'}
            onChange={e => i18n.changeLanguage(e.target.value)}
            className="text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-1.5 text-[var(--text-body)]"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-5 space-y-4 mt-4">
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">{t('settings.notifications')}</h2>
        <p className="text-sm text-[var(--text-muted)]">
          {t('settings.notificationsDesc')}
        </p>

        <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.browserNotifications')}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {t('settings.status')}: {notifStatus === 'granted' ? t('settings.enabled') : notifStatus === 'denied' ? t('settings.blocked') : notifStatus === 'unsupported' ? t('settings.notSupported') : t('settings.notRequested')}
              </p>
            </div>
          </div>
          {notifStatus !== 'granted' && notifStatus !== 'denied' && notifStatus !== 'unsupported' && (
            <button
              onClick={async () => {
                const granted = await requestPermission()
                if (granted) await registerServiceWorker()
                setNotifStatus(getNotificationStatus())
              }}
              className="btn-primary px-4 py-1.5 text-sm"
            >
              {t('settings.enable')}
            </button>
          )}
          {notifStatus === 'denied' && (
            <span className="text-xs text-red-500">{t('settings.blockedInBrowser')}</span>
          )}
          {notifStatus === 'granted' && (
            <span className="text-xs text-emerald-500 font-medium">{t('settings.active')}</span>
          )}
        </div>

        {/* Weekly digest toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.weeklyDigest')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('settings.weeklyDigestDesc')}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!profileId) return
              const newValue = !digestEnabled
              setDigestEnabled(newValue)
              const prefs = await db.notificationPreferences.where('examProfileId').equals(profileId).first()
              if (prefs) {
                await db.notificationPreferences.update(prefs.id, { weeklyDigest: newValue })
              } else {
                await db.notificationPreferences.put({
                  id: profileId,
                  examProfileId: profileId,
                  studyReminders: true,
                  reviewDue: true,
                  streakWarnings: true,
                  planSuggestions: true,
                  milestones: true,
                  weeklyDigest: newValue,
                })
              }
            }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              digestEnabled
                ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
            }`}
          >
            {digestEnabled ? t('settings.enabled') : t('settings.disabled')}
          </button>
        </div>
      </div>

      {/* Cloud Sync */}
      <div className="glass-card p-5 space-y-4 mt-4">
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">{t('settings.cloudSync')}</h2>
        <p className="text-sm text-[var(--text-muted)]">
          {t('settings.cloudSyncDesc')}
        </p>

        {!cloudSync.isPro ? (
          <div className="p-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)]/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--bg-input)] flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-[var(--text-muted)]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-muted)]">{t('settings.cloudSync')}</p>
                <p className="text-xs text-[var(--text-faint)]">{t('settings.upgradeToPro')}</p>
              </div>
              <Link to="/pricing" className="btn-primary px-4 py-1.5 text-sm">{t('settings.upgrade')}</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Enable/Disable toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-card)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.autoSync')}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {cloudSync.isEnabled
                      ? cloudSync.lastSyncedAt
                        ? t('settings.lastSynced', { date: new Date(cloudSync.lastSyncedAt).toLocaleString() })
                        : t('settings.enabledSyncing')
                      : t('settings.syncInterval')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => cloudSync.isEnabled ? cloudSync.disable() : cloudSync.enable()}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  cloudSync.isEnabled
                    ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25'
                    : 'btn-primary'
                }`}
              >
                {cloudSync.isEnabled ? t('settings.enabled') : t('settings.enable')}
              </button>
            </div>

            {/* Sync Now */}
            {cloudSync.isEnabled && (
              <button
                onClick={() => cloudSync.sync()}
                disabled={cloudSync.status === 'syncing'}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-card)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-50 text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  {cloudSync.status === 'syncing'
                    ? <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                    : <Cloud className="w-5 h-5 text-emerald-500" />
                  }
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-heading)]">{t('settings.syncNow')}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t('settings.syncNowDesc')}</p>
                </div>
              </button>
            )}

            {/* Error */}
            {cloudSync.error && (
              <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-red-500/10 text-red-500">
                <AlertTriangle className="w-4 h-4" />
                {cloudSync.error}
              </div>
            )}

            {/* Delete Cloud Data */}
            {cloudSync.lastSyncedAt && (
              <div className="pt-2 border-t border-[var(--border-card)]">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('settings.deleteCloudData')}
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-red-500">{t('settings.confirmDeleteCloud')}</span>
                    <button
                      onClick={async () => { await cloudSync.deleteCloud(); setConfirmDelete(false) }}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      {t('settings.confirm')}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]"
                    >
                      {t('settings.cancel')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Privacy & Data ─────────────────────────────────────── */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-[var(--text-heading)]">
          <Shield className="w-5 h-5" /> Privacy & Data
        </h2>

        {/* Consent toggles */}
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-body)]">Analytics (PostHog)</span>
            <input
              type="checkbox"
              checked={analyticsConsent}
              onChange={(e) => updateConsent('analytics', e.target.checked)}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-body)]">Error tracking (Sentry)</span>
            <input
              type="checkbox"
              checked={errorTrackingConsent}
              onChange={(e) => updateConsent('errorTracking', e.target.checked)}
              className="rounded"
            />
          </label>
          <p className="text-xs text-[var(--text-muted)]">
            Essential cookies (authentication) are always active.{' '}
            <Link to="/privacy" className="underline hover:text-[var(--accent-text)]">Privacy Policy</Link>
          </p>
        </div>

        {/* Danger zone — Delete Account */}
        <div className="pt-4 border-t border-[var(--border-card)]">
          <h3 className="text-sm font-medium text-red-500 mb-2">Danger Zone</h3>
          {!showDeleteAccount ? (
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete my account and all data
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-500">
                This will permanently delete your account, cloud data, and sign you out. Local data will be erased. This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder='Type "DELETE" to confirm'
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="text-xs px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)] w-40"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                  className="text-xs font-medium text-white bg-red-500 px-3 py-1 rounded hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deletingAccount ? 'Deleting...' : 'Delete Account'}
                </button>
                <button
                  onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText('') }}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
