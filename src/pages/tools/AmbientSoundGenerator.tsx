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
}

const SOUND_CONFIGS: SoundConfig[] = [
  { id: 'white', label: 'White Noise', icon: Volume2, color: 'text-[var(--text-muted)]', activeColor: 'text-emerald-400' },
  { id: 'rain', label: 'Rain', icon: CloudRain, color: 'text-[var(--text-muted)]', activeColor: 'text-blue-400' },
  { id: 'coffee', label: 'Coffee Shop', icon: Coffee, color: 'text-[var(--text-muted)]', activeColor: 'text-orange-400' },
  { id: 'lofi', label: 'Lo-fi', icon: Music, color: 'text-[var(--text-muted)]', activeColor: 'text-purple-400' },
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

function generateBrownNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = sampleRate * duration
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)

  let lastSample = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    lastSample = lastSample * 0.99 + white * 0.02
    data[i] = lastSample
  }

  let max = 0
  for (let i = 0; i < length; i++) {
    const abs = Math.abs(data[i])
    if (abs > max) max = abs
  }
  if (max > 0) {
    for (let i = 0; i < length; i++) {
      data[i] /= max
    }
  }

  return buffer
}

interface SourceRef {
  source: AudioBufferSourceNode
  gain: GainNode
  filter?: BiquadFilterNode
  lfo?: OscillatorNode
  lfoGain?: GainNode
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
  const brownBufferRef = useRef<AudioBuffer | null>(null)

  useEffect(() => {
    return () => {
      const ctx = audioCtxRef.current
      if (ctx) {
        Object.values(sourcesRef.current).forEach(ref => {
          if (ref) {
            try { ref.source.stop() } catch { /* already stopped */ }
            if (ref.lfo) {
              try { ref.lfo.stop() } catch { /* already stopped */ }
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
    brownBufferRef.current = generateBrownNoiseBuffer(ctx, 2)

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
    if (!ctx || !masterGain || !whiteBufferRef.current || !brownBufferRef.current) return

    const existing = sourcesRef.current[type]
    if (existing) {
      try { existing.source.stop() } catch { /* already stopped */ }
      if (existing.lfo) {
        try { existing.lfo.stop() } catch { /* already stopped */ }
      }
    }

    const gainNode = ctx.createGain()
    gainNode.gain.value = volume / 100

    let source: AudioBufferSourceNode
    let filter: BiquadFilterNode | undefined
    let lfo: OscillatorNode | undefined
    let lfoGain: GainNode | undefined

    switch (type) {
      case 'white': {
        source = ctx.createBufferSource()
        source.buffer = whiteBufferRef.current
        source.loop = true
        source.connect(gainNode)
        gainNode.connect(masterGain)
        break
      }
      case 'rain': {
        source = ctx.createBufferSource()
        source.buffer = whiteBufferRef.current
        source.loop = true
        filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 800
        filter.Q.value = 0.5
        source.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(masterGain)
        break
      }
      case 'coffee': {
        source = ctx.createBufferSource()
        source.buffer = whiteBufferRef.current
        source.loop = true
        filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 1000
        filter.Q.value = 0.7
        const filter2 = ctx.createBiquadFilter()
        filter2.type = 'lowpass'
        filter2.frequency.value = 500
        filter2.Q.value = 0.5
        source.connect(filter)
        filter.connect(filter2)
        filter2.connect(gainNode)
        gainNode.connect(masterGain)
        break
      }
      case 'lofi': {
        source = ctx.createBufferSource()
        source.buffer = brownBufferRef.current
        source.loop = true
        lfo = ctx.createOscillator()
        lfo.type = 'sine'
        lfo.frequency.value = 0.15
        lfoGain = ctx.createGain()
        lfoGain.gain.value = 0.15
        lfo.connect(lfoGain)
        lfoGain.connect(gainNode.gain)
        lfo.start()
        source.connect(gainNode)
        gainNode.connect(masterGain)
        break
      }
    }

    source.start()
    sourcesRef.current[type] = { source, gain: gainNode, filter, lfo, lfoGain }
  }, [])

  const stopSound = useCallback((type: SoundType) => {
    const ctx = audioCtxRef.current
    const ref = sourcesRef.current[type]
    if (!ctx || !ref) return

    ref.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05)
    setTimeout(() => {
      try { ref.source.stop() } catch { /* already stopped */ }
      if (ref.lfo) {
        try { ref.lfo.stop() } catch { /* already stopped */ }
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
                <li>All sounds are synthesized in the browser — no downloads needed.</li>
              </ul>
            </div>
          </div>
        )}
      </FormToolPage>
    </>
  )
}
