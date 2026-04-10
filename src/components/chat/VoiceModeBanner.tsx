/**
 * Voice Mode Banner — sticky indicator when the chat is in voice conversation mode.
 * Shows mic state, recording timer, and a clear "end voice mode" button.
 */
import { Mic, MicOff, Volume2, X } from 'lucide-react'

interface Props {
  isRecording: boolean
  isTranscribing: boolean
  isSpeaking: boolean
  recordingMs: number
  maxDurationMs: number
  onToggleMic: () => void
  onExit: () => void
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VoiceModeBanner({
  isRecording,
  isTranscribing,
  isSpeaking,
  recordingMs,
  maxDurationMs,
  onToggleMic,
  onExit,
}: Props) {
  const progress = Math.min(100, (recordingMs / maxDurationMs) * 100)

  const status = isRecording
    ? 'En écoute...'
    : isTranscribing
      ? 'Transcription...'
      : isSpeaking
        ? 'Le tuteur parle...'
        : 'Appuyez sur le micro ou sur Espace pour parler'

  return (
    <div className="sticky top-0 z-10 px-4 py-2 bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 border-b border-[var(--accent)]/20 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onToggleMic}
            aria-label={isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement'}
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                : 'bg-[var(--accent)] text-white hover:scale-105'
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              {isSpeaking && <Volume2 className="w-3 h-3 text-[var(--accent)] animate-pulse" />}
              <span className="text-[var(--text-body)] font-medium truncate">{status}</span>
            </div>
            {isRecording && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                  {formatDuration(recordingMs)} / {formatDuration(maxDurationMs)}
                </span>
                <div className="h-0.5 w-20 bg-[var(--bg-card)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onExit}
          aria-label="Quitter le mode vocal"
          className="shrink-0 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] px-2 py-1 rounded hover:bg-[var(--bg-card)]/50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Quitter
        </button>
      </div>
      {isRecording && (
        <div className="sr-only" aria-live="polite">
          Enregistrement en cours
        </div>
      )}
    </div>
  )
}
