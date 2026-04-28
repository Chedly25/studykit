import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, CloudRain, Coffee, Music } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('ambient-sound-generator')!

type SoundType = 'white' | 'rain' | 'coffee' | 'lofi'

interface SoundState {
  enabled: boolean
  volume: number
}

interface SoundConfig {
  id: SoundType
  label: string
  icon: typeof Volume2
  color: string
  activeColor: string
  audioFile?: string // undefined = synthesized white noise
}

const SOUND_CONFIGS: SoundConfig[] = [
  { id: 'white', label: 'White Noise', icon: Volume2, color: 'text-[var(--text-muted)]', activeColor: 'text-[var(--accent-text)]' },
  { id: 'rain', label: 'Rain', icon: CloudRain, color: 'text-[var(--text-muted)]', activeColor: 'text-[var(--color-info)]', audioFile: '/sounds/rain.mp3' },
  { id: 'coffee', label: 'Coffee Shop', icon: Coffee, color: 'text-[var(--text-muted)]', activeColor: 'text-[var(--color-warning)]', audioFile: '/sounds/cafe.mp3' },
  { id: 'lofi', label: 'Lo-fi', icon: Music, color: 'text-[var(--text-muted)]', activeColor: 'text-[var(--color-tag-flashcard)]', audioFile: '/sounds/lofi.mp3' },
]

function generateWhiteNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = sampleRate * duration
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

interface SourceRef {
  type: 'synthesized' | 'audio-file'
  // Synthesized (white noise)
  source?: AudioBufferSourceNode
  // Audio file
  mediaElement?: HTMLAudioElement
  mediaSource?: MediaElementAudioSourceNode
  // Shared
  gain: GainNode
}

export default function AmbientSoundGenerator() {
  const [audioReady, setAudioReady] = useState(false)
  const [sounds, setSounds] = useState<Record<SoundType, SoundState>>({
    white: { enabled: false, volume: 50 },
    rain: { enabled: false, volume: 50 },
    coffee: { enabled: false, volume: 50 },
    lofi: { enabled: false, volume: 50 },
  })
  const [masterVolume, setMasterVolume] = useState(75)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const sourcesRef = useRef<Partial<Record<SoundType, SourceRef>>>({})
  const whiteBufferRef = useRef<AudioBuffer | null>(null)

  useEffect(() => {
    return () => {
      const ctx = audioCtxRef.current
      if (ctx) {
        Object.values(sourcesRef.current).forEach(ref => {
          if (ref) {
            if (ref.source) {
              try { ref.source.stop() } catch { /* already stopped */ }
            }
            if (ref.mediaElement) {
              ref.mediaElement.pause()
              ref.mediaElement.src = ''
            }
          }
        })
        ctx.close()
        audioCtxRef.current = null
      }
    }
  }, [])

  const initAudio = useCallback(async () => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
      setAudioReady(true)
      return
    }

    const ctx = new AudioContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const masterGain = ctx.createGain()
    masterGain.gain.value = masterVolume / 100
    masterGain.connect(ctx.destination)

    audioCtxRef.current = ctx
    masterGainRef.current = masterGain

    whiteBufferRef.current = generateWhiteNoiseBuffer(ctx, 2)

    setAudioReady(true)
  }, [masterVolume])

  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        masterVolume / 100,
        audioCtxRef.current.currentTime
      )
    }
  }, [masterVolume])

  const startSound = useCallback((type: SoundType, volume: number) => {
    const ctx = audioCtxRef.current
    const masterGain = masterGainRef.current
    if (!ctx || !masterGain) return

    // Stop existing
    const existing = sourcesRef.current[type]
    if (existing) {
      if (existing.source) {
        try { existing.source.stop() } catch { /* already stopped */ }
      }
      if (existing.mediaElement) {
        existing.mediaElement.pause()
        existing.mediaElement.src = ''
      }
    }

    const gainNode = ctx.createGain()
    gainNode.gain.value = volume / 100

    const config = SOUND_CONFIGS.find(c => c.id === type)

    if (config?.audioFile) {
      // Play real audio file
      const audio = new Audio(config.audioFile)
      audio.loop = true
      audio.crossOrigin = 'anonymous'
      const mediaSource = ctx.createMediaElementSource(audio)
      mediaSource.connect(gainNode)
      gainNode.connect(masterGain)
      audio.play().catch(() => { /* autoplay blocked — user gesture already handled via initAudio */ })
      sourcesRef.current[type] = { type: 'audio-file', mediaElement: audio, mediaSource, gain: gainNode }
    } else {
      // Synthesize white noise
      if (!whiteBufferRef.current) return
      const source = ctx.createBufferSource()
      source.buffer = whiteBufferRef.current
      source.loop = true
      source.connect(gainNode)
      gainNode.connect(masterGain)
      source.start()
      sourcesRef.current[type] = { type: 'synthesized', source, gain: gainNode }
    }
  }, [])

  const stopSound = useCallback((type: SoundType) => {
    const ctx = audioCtxRef.current
    const ref = sourcesRef.current[type]
    if (!ctx || !ref) return

    ref.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05)
    setTimeout(() => {
      if (ref.source) {
        try { ref.source.stop() } catch { /* already stopped */ }
      }
      if (ref.mediaElement) {
        ref.mediaElement.pause()
        ref.mediaElement.src = ''
      }
      delete sourcesRef.current[type]
    }, 60)
  }, [])

  const toggleSound = useCallback((type: SoundType) => {
    setSounds(prev => {
      const next = { ...prev, [type]: { ...prev[type], enabled: !prev[type].enabled } }
      if (next[type].enabled) {
        startSound(type, next[type].volume)
      } else {
        stopSound(type)
      }
      return next
    })
  }, [startSound, stopSound])

  const handleVolumeChange = useCallback((type: SoundType, volume: number) => {
    setSounds(prev => {
      const next = { ...prev, [type]: { ...prev[type], volume } }
      const ref = sourcesRef.current[type]
      const ctx = audioCtxRef.current
      if (ref && ctx) {
        ref.gain.gain.setValueAtTime(volume / 100, ctx.currentTime)
      }
      return next
    })
  }, [])

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {!audioReady ? (
          <div className="flex justify-center py-16">
            <button
              onClick={initAudio}
              className="btn-primary px-10 py-4 rounded-xl text-lg font-medium flex items-center gap-3"
            >
              <Volume2 size={24} />
              Start Audio Engine
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Master Volume */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-4">
                <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider whitespace-nowrap">
                  Master Volume
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={masterVolume}
                  onChange={e => setMasterVolume(Number(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none bg-[var(--border-card)] cursor-pointer accent-primary-500"
                />
                <span className="font-[family-name:var(--font-display)] text-[var(--text-body)] text-sm w-10 text-right">
                  {masterVolume}%
                </span>
              </div>
            </div>

            {/* Sound Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SOUND_CONFIGS.map(config => {
                const state = sounds[config.id]
                const Icon = config.icon
                return (
                  <div
                    key={config.id}
                    className={`glass-card glass-card-hover p-5 transition-all ${
                      state.enabled ? 'ring-1 ring-primary-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${state.enabled ? 'bg-[var(--accent-bg)]' : 'bg-[var(--bg-input)]'}`}>
                        <Icon
                          size={20}
                          className={state.enabled ? config.activeColor : config.color}
                        />
                      </div>
                      <span className="font-[family-name:var(--font-display)] text-[var(--text-heading)] font-medium">
                        {config.label}
                      </span>
                      <button
                        onClick={() => toggleSound(config.id)}
                        className={`ml-auto px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          state.enabled ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        {state.enabled ? 'On' : 'Off'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider">
                        Vol
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={state.volume}
                        onChange={e => handleVolumeChange(config.id, Number(e.target.value))}
                        className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--border-card)] cursor-pointer accent-primary-500"
                        disabled={!state.enabled}
                      />
                      <span className="text-[var(--text-muted)] text-xs w-8 text-right">
                        {state.volume}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Tips */}
            <div className="glass-card p-4">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Tips</p>
              <ul className="text-[var(--text-muted)] text-sm space-y-1">
                <li>Mix multiple sounds for your ideal study atmosphere.</li>
                <li>Lower the master volume and adjust individual levels for a subtle background.</li>
                <li>Rain, Coffee Shop, and Lo-fi use real audio recordings. White Noise is synthesized in the browser.</li>
              </ul>
            </div>
          </div>
        )}
      </FormToolPage>
    </>
  )
}
