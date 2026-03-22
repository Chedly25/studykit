/**
 * Browser SpeechSynthesis TTS — reads AI responses aloud.
 * Strips markdown, LaTeX, and markers before speaking.
 */
import { useState, useCallback, useRef, useEffect } from 'react'

const VOICE_ENABLED_KEY = 'studieskit_voice_output_enabled'

function cleanTextForSpeech(text: string): string {
  return text
    // Remove LaTeX display math
    .replace(/\$\$[\s\S]+?\$\$/g, ' math expression ')
    // Remove LaTeX inline math
    .replace(/\$[^\$]+?\$/g, ' math ')
    // Remove markdown headers
    .replace(/#{1,6}\s+/g, '')
    // Remove markdown bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Remove markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, ' code block ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove card/quiz/canvas markers
    .replace(/\[(card|quiz|code|canvas):[^\]]+\]/g, '')
    // Remove citation markers
    .replace(/\[Source:[^\]]+\]/g, '')
    .replace(/\[Attachment:[^\]]+\]/g, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

export function useVoiceOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabledState] = useState(
    () => localStorage.getItem(VOICE_ENABLED_KEY) === 'true'
  )
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const setVoiceEnabled = useCallback((v: boolean) => {
    setVoiceEnabledState(v)
    localStorage.setItem(VOICE_ENABLED_KEY, String(v))
    if (!v) window.speechSynthesis?.cancel()
  }, [])

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const cleaned = cleanTextForSpeech(text)
    if (!cleaned) return

    const utterance = new SpeechSynthesisUtterance(cleaned)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  return { speak, stop, isSpeaking, voiceEnabled, setVoiceEnabled }
}
