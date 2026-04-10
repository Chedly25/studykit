/**
 * Audio recording + transcription via Cloudflare Whisper.
 * Uses MediaRecorder API for capture, /api/transcribe for STT.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { track } from '../lib/analytics'

const DEFAULT_MAX_DURATION_MS = 60_000 // 60 seconds max recording

export function useVoiceInput(maxDurationMs: number = DEFAULT_MAX_DURATION_MS) {
  const { getToken } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordingMs, setRecordingMs] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Tick every 100ms while recording to update duration
  useEffect(() => {
    if (!isRecording) return
    tickRef.current = setInterval(() => {
      setRecordingMs(Date.now() - startTimeRef.current)
    }, 100)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [isRecording])

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
    setRecordingMs(0)
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Prefer webm, fall back to whatever browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start(250) // Collect chunks every 250ms
      startTimeRef.current = Date.now()
      setRecordingMs(0)
      setIsRecording(true)

      // Auto-stop after max duration
      timerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, maxDurationMs)
    } catch (err) {
      cleanup()
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone in your browser settings.')
      } else {
        setError('Failed to start recording')
      }
    }
  }, [cleanup, maxDurationMs])

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state !== 'recording') {
        cleanup()
        setIsRecording(false)
        resolve('')
        return
      }

      recorder.onstop = async () => {
        setIsRecording(false)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        cleanup()

        if (blob.size < 100) {
          setError('Recording too short')
          resolve('')
          return
        }

        // Transcribe
        setIsTranscribing(true)
        try {
          const token = await getToken()
          if (!token) { setError('Not authenticated'); resolve(''); return }

          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
          })

          if (res.status === 403) {
            setError('Voice mode requires Pro plan')
            resolve('')
            return
          }

          if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Transcription failed' })) as { error?: string }
            setError(data.error ?? 'Transcription failed')
            resolve('')
            return
          }

          const data = await res.json() as { text?: string; error?: string }
          if (data.error) { setError(data.error); resolve(''); return }

          track('voice_used')
          resolve(data.text ?? '')
        } catch {
          setError('Transcription failed')
          resolve('')
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.stop()
    })
  }, [cleanup, getToken])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    cleanup()
    setIsRecording(false)
  }, [cleanup])

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
    recordingMs,
    maxDurationMs,
  }
}
