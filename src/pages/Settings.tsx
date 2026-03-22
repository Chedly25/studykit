/**
 * Settings page — Data Management (export/import/progress report).
 * Route: /settings
 */
import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Bell, Cloud, Trash2, Mail } from 'lucide-react'
import { requestPermission, getNotificationStatus, registerServiceWorker } from '../lib/pushNotifications'
import { useExamProfile } from '../hooks/useExamProfile'
import { useCloudSync } from '../hooks/useCloudSync'
import { db } from '../db'
import { exportProfileData, importProfileData, generateProgressReport, downloadBlob } from '../lib/dataExport'

export default function Settings() {
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

  const profileId = activeProfile?.id

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

  const handleExport = async () => {
    if (!profileId) return
    setExporting(true)
    setMessage(null)
    try {
      const blob = await exportProfileData(profileId)
      const name = activeProfile?.name?.replace(/\s+/g, '-').toLowerCase() ?? 'profile'
      downloadBlob(blob, `studieskit-${name}-${new Date().toISOString().slice(0, 10)}.json`)
      setMessage({ type: 'success', text: 'Data exported successfully!' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' })
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
        setMessage({ type: 'success', text: 'Data imported successfully! Refresh to see changes.' })
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Import failed' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Import failed' })
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
      setMessage({ type: 'success', text: 'Progress report downloaded!' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Report generation failed' })
    } finally {
      setGeneratingReport(false)
    }
  }

  if (!activeProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">Settings</h1>
        <p className="text-[var(--text-muted)]">Create a profile to access settings.</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6">Settings</h1>

      {/* Data Management */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">Data Management</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Export your study data for backup, import from a previous export, or download a progress report.
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
              <p className="text-sm font-medium text-[var(--text-heading)]">Export All Data</p>
              <p className="text-xs text-[var(--text-muted)]">Download your complete profile data as JSON</p>
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
              <p className="text-sm font-medium text-[var(--text-heading)]">Import Data</p>
              <p className="text-xs text-[var(--text-muted)]">Restore from a previous export file</p>
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
              <p className="text-sm font-medium text-[var(--text-heading)]">Download Progress Report</p>
              <p className="text-xs text-[var(--text-muted)]">Get a markdown summary of your study progress</p>
            </div>
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-5 space-y-4 mt-4">
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">Notifications</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Get browser notifications for study reminders and queue updates.
        </p>

        <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">Browser Notifications</p>
              <p className="text-xs text-[var(--text-muted)]">
                Status: {notifStatus === 'granted' ? 'Enabled' : notifStatus === 'denied' ? 'Blocked' : notifStatus === 'unsupported' ? 'Not supported' : 'Not requested'}
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
              Enable
            </button>
          )}
          {notifStatus === 'denied' && (
            <span className="text-xs text-red-500">Blocked in browser settings</span>
          )}
          {notifStatus === 'granted' && (
            <span className="text-xs text-emerald-500 font-medium">Active</span>
          )}
        </div>

        {/* Weekly digest toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">Weekly Email Digest</p>
              <p className="text-xs text-[var(--text-muted)]">Receive a summary of your study progress every week</p>
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
            {digestEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Cloud Sync */}
      <div className="glass-card p-5 space-y-4 mt-4">
        <h2 className="text-lg font-semibold text-[var(--text-heading)]">Cloud Sync</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Sync your study data to the cloud for backup and multi-device access.
        </p>

        {!cloudSync.isPro ? (
          <div className="p-4 rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)]/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--bg-input)] flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-[var(--text-muted)]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-muted)]">Cloud Sync</p>
                <p className="text-xs text-[var(--text-faint)]">Upgrade to Pro to enable cloud sync</p>
              </div>
              <Link to="/pricing" className="btn-primary px-4 py-1.5 text-sm">Upgrade</Link>
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
                  <p className="text-sm font-medium text-[var(--text-heading)]">Auto Sync</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {cloudSync.isEnabled
                      ? cloudSync.lastSyncedAt
                        ? `Last synced: ${new Date(cloudSync.lastSyncedAt).toLocaleString()}`
                        : 'Enabled — syncing...'
                      : 'Sync every 5 minutes when active'}
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
                {cloudSync.isEnabled ? 'Enabled' : 'Enable'}
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
                  <p className="text-sm font-medium text-[var(--text-heading)]">Sync Now</p>
                  <p className="text-xs text-[var(--text-muted)]">Push your latest data to the cloud</p>
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
                    <Trash2 className="w-3.5 h-3.5" /> Delete cloud data
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-red-500">Delete all cloud data?</span>
                    <button
                      onClick={async () => { await cloudSync.deleteCloud(); setConfirmDelete(false) }}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
