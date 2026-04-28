/**
 * WebRTC client for the Grand Oral voice session.
 * Connects directly to OpenAI Realtime API using the ephemeral client_secret
 * minted by /api/grand-oral/session. Browser ↔ OpenAI is peer-to-peer;
 * our server never touches audio.
 *
 * Responsibilities:
 *  - getUserMedia → add mic track to RTCPeerConnection
 *  - Receive jury audio, pipe to <audio> element
 *  - Data channel ("oai-events") for server events (transcripts, tool calls)
 *  - On function_call for `get_next_jury_question`, invoke the tool handler
 *    (which calls Claude via /api/legal-chat) and reply with function_call_output
 *  - Track transcript (student + jury), interruption count, avg reply latency
 *
 * The consuming component decides when to call disconnect() — this hook
 * doesn't time out on its own. A simple wall-clock timer in the UI layer
 * handles the 15/30 min phase boundaries.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  JuryQuestionToolArgs,
  JuryQuestionToolResult,
} from '../ai/coaching/types'

export type GrandOralConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed'

export interface GrandOralTranscriptTurn {
  role: 'student' | 'jury'
  text: string
  // Timestamps are relative to the call to `connect()` (ms).
  startedAt: number
  completedAt: number
}

export interface GrandOralMetrics {
  durationSec: number
  interruptionCount: number      // jury cut student off mid-speech
  avgLatencySec: number           // mean latency between jury question end and student reply start
  juryQuestions: string[]         // concatenated jury questions
}

export interface UseGrandOralWebRTCOptions {
  clientSecret: string
  model: string
  toolHandler: (args: JuryQuestionToolArgs) => Promise<JuryQuestionToolResult>
  /** Optional: called when the connection transitions to an error/closed state. */
  onClose?: (reason: string) => void
}

export interface UseGrandOralWebRTCApi {
  state: GrandOralConnectionState
  error: string | null
  transcript: GrandOralTranscriptTurn[]
  metrics: GrandOralMetrics
  isMuted: boolean
  audioRef: React.RefObject<HTMLAudioElement | null>
  connect: () => Promise<void>
  disconnect: () => void
  toggleMute: () => void
}

const OPENAI_REALTIME_BASE = 'https://api.openai.com/v1/realtime'

export function useGrandOralWebRTC(opts: UseGrandOralWebRTCOptions): UseGrandOralWebRTCApi {
  const [state, setState] = useState<GrandOralConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<GrandOralTranscriptTurn[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [metrics, setMetrics] = useState<GrandOralMetrics>({
    durationSec: 0,
    interruptionCount: 0,
    avgLatencySec: 0,
    juryQuestions: [],
  })

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const startedAtRef = useRef<number>(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Rolling transcript buffers so partial deltas can be coalesced into a single turn
  // before pushing to state.
  const juryCurrentRef = useRef<{ text: string; startedAt: number } | null>(null)
  const studentCurrentRef = useRef<{ text: string; startedAt: number } | null>(null)
  // Latency: record when the LAST jury utterance ended, then diff with the next
  // student speech start.
  const lastJuryEndRef = useRef<number | null>(null)
  const latenciesRef = useRef<number[]>([])
  const interruptionsRef = useRef(0)
  const studentSpeakingRef = useRef(false)

  const now = () => Date.now() - startedAtRef.current

  const commitJuryTurn = useCallback(() => {
    const cur = juryCurrentRef.current
    if (!cur || !cur.text.trim()) {
      juryCurrentRef.current = null
      return
    }
    const completedAt = now()
    setTranscript(prev => [...prev, { role: 'jury', text: cur.text.trim(), startedAt: cur.startedAt, completedAt }])
    lastJuryEndRef.current = completedAt
    juryCurrentRef.current = null
  }, [])

  const commitStudentTurn = useCallback(() => {
    const cur = studentCurrentRef.current
    if (!cur || !cur.text.trim()) {
      studentCurrentRef.current = null
      return
    }
    const completedAt = now()
    setTranscript(prev => [...prev, { role: 'student', text: cur.text.trim(), startedAt: cur.startedAt, completedAt }])
    studentCurrentRef.current = null
  }, [])

  const sendDC = useCallback((obj: unknown) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    dc.send(JSON.stringify(obj))
  }, [])

  const handleServerEvent = useCallback(
    async (ev: Record<string, unknown>) => {
      const type = ev.type as string
      switch (type) {
        case 'input_audio_buffer.speech_started': {
          // Student started speaking. If jury was mid-speech, this is an
          // interruption by the user (not counted as jury interrupting student).
          if (juryCurrentRef.current) {
            // Student cut jury off — not an interruption we grade, but we should flush the jury buffer.
            commitJuryTurn()
          }
          // Otherwise, this is a student turn start. Record latency if jury just finished.
          if (lastJuryEndRef.current !== null) {
            latenciesRef.current.push((now() - lastJuryEndRef.current) / 1000)
            lastJuryEndRef.current = null
          }
          studentCurrentRef.current = { text: studentCurrentRef.current?.text ?? '', startedAt: now() }
          studentSpeakingRef.current = true
          break
        }
        case 'input_audio_buffer.speech_stopped': {
          studentSpeakingRef.current = false
          break
        }
        case 'conversation.item.input_audio_transcription.completed': {
          // Final transcript for a student utterance
          const t = (ev.transcript as string | undefined) ?? ''
          if (!studentCurrentRef.current) {
            studentCurrentRef.current = { text: '', startedAt: now() }
          }
          studentCurrentRef.current.text = (studentCurrentRef.current.text + ' ' + t).trim()
          commitStudentTurn()
          break
        }
        case 'response.audio_transcript.delta': {
          // Jury text streaming in
          const d = (ev.delta as string | undefined) ?? ''
          if (!juryCurrentRef.current) {
            juryCurrentRef.current = { text: '', startedAt: now() }
          }
          juryCurrentRef.current.text += d
          // If jury starts speaking while student was speaking, count interruption
          if (studentSpeakingRef.current) {
            interruptionsRef.current++
            studentSpeakingRef.current = false
            commitStudentTurn()
          }
          break
        }
        case 'response.audio_transcript.done': {
          commitJuryTurn()
          break
        }
        case 'response.function_call_arguments.done': {
          // Jury requested a question from the tool
          const callId = ev.call_id as string
          const name = ev.name as string
          const argsStr = (ev.arguments as string | undefined) ?? '{}'
          if (name === 'get_next_jury_question') {
            let result: JuryQuestionToolResult
            try {
              const args = JSON.parse(argsStr) as JuryQuestionToolArgs
              result = await opts.toolHandler(args)
              setMetrics(m => ({ ...m, juryQuestions: [...m.juryQuestions, result.question] }))
            } catch (e) {
              result = {
                question: 'Pouvez-vous préciser votre argumentation sur ce point ?',
                targetGap: 'fallback on tool error: ' + String((e as Error).message).slice(0, 200),
                refIndex: null,
                followUpHint: '',
              }
            }
            // Reply with function_call_output and trigger a response
            sendDC({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(result),
              },
            })
            sendDC({ type: 'response.create' })
          }
          break
        }
        case 'error': {
          const msg = (ev.error as { message?: string } | undefined)?.message ?? 'Unknown OpenAI error'
          setError(msg)
          setState('error')
          opts.onClose?.(msg)
          break
        }
        default:
          // Many event types we don't need. Silent.
          break
      }
    },
    [commitJuryTurn, commitStudentTurn, opts, sendDC],
  )

  const disconnect = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
    try { dcRef.current?.close() } catch { /* ignore */ }
    dcRef.current = null
    try { pcRef.current?.close() } catch { /* ignore */ }
    pcRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (state !== 'error') setState('closed')
  }, [state])

  const connect = useCallback(async () => {
    if (state !== 'idle') return
    setState('connecting')
    setError(null)
    setTranscript([])
    latenciesRef.current = []
    interruptionsRef.current = 0
    lastJuryEndRef.current = null
    juryCurrentRef.current = null
    studentCurrentRef.current = null
    studentSpeakingRef.current = false

    try {
      // 1. Mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // 2. Peer connection
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // 3. Attach jury audio to a playback element
      pc.ontrack = (e) => {
        if (audioRef.current && e.streams[0]) {
          audioRef.current.srcObject = e.streams[0]
          void audioRef.current.play().catch(() => { /* autoplay may need user gesture on some browsers */ })
        }
      }

      // 4. Data channel for events
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as Record<string, unknown>
          void handleServerEvent(ev)
        } catch {
          // malformed event — skip
        }
      }
      dc.onopen = () => {
        // Connection fully live.
        startedAtRef.current = Date.now()
        setState('connected')
        tickRef.current = setInterval(() => {
          const avg = latenciesRef.current.length > 0
            ? latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length
            : 0
          setMetrics(m => ({
            ...m,
            durationSec: (Date.now() - startedAtRef.current) / 1000,
            interruptionCount: interruptionsRef.current,
            avgLatencySec: avg,
          }))
        }, 500)
      }

      // 5. Add mic
      pc.addTrack(stream.getAudioTracks()[0], stream)

      // 6. SDP negotiation with OpenAI Realtime
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpRes = await fetch(`${OPENAI_REALTIME_BASE}?model=${encodeURIComponent(opts.model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })
      if (!sdpRes.ok) {
        const text = await sdpRes.text().catch(() => '')
        throw new Error(`OpenAI SDP exchange failed: ${sdpRes.status} ${text.slice(0, 200)}`)
      }
      const answer = { type: 'answer' as RTCSdpType, sdp: await sdpRes.text() }
      await pc.setRemoteDescription(answer)

      // Connection completes when dc.onopen fires.
    } catch (e) {
      const msg = String((e as Error).message ?? e)
      setError(msg)
      setState('error')
      opts.onClose?.(msg)
      disconnect()
    }
  }, [state, opts, handleServerEvent, disconnect])

  const toggleMute = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMuted(!track.enabled)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      try { dcRef.current?.close() } catch { /* ignore */ }
      try { pcRef.current?.close() } catch { /* ignore */ }
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return { state, error, transcript, metrics, isMuted, audioRef, connect, disconnect, toggleMute }
}
