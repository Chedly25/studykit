import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, User, BarChart3 } from 'lucide-react'

interface DemoMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  delay: number
}

export function InteractiveDemo() {
  const { t } = useTranslation()
  const [visibleMessages, setVisibleMessages] = useState<DemoMessage[]>([])
  const [typing, setTyping] = useState(false)
  const [started, setStarted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const demoMessages: DemoMessage[] = [
    { role: 'user', content: t('home.demo.user1'), delay: 0 },
    { role: 'assistant', content: t('home.demo.ai1'), delay: 1500 },
    { role: 'user', content: t('home.demo.user2'), delay: 2500 },
    { role: 'assistant', content: t('home.demo.ai2'), delay: 1500 },
    { role: 'system', content: t('home.demo.mastery'), delay: 1000 },
  ]

  useEffect(() => {
    if (!started) return
    let timeoutId: ReturnType<typeof setTimeout>
    let currentIndex = 0
    let totalDelay = 0

    const showNext = () => {
      if (currentIndex >= demoMessages.length) return
      const msg = demoMessages[currentIndex]
      totalDelay += msg.delay

      timeoutId = setTimeout(() => {
        if (msg.role === 'assistant') {
          setTyping(true)
          timeoutId = setTimeout(() => {
            setTyping(false)
            setVisibleMessages(prev => [...prev, msg])
            currentIndex++
            showNext()
          }, 1200)
        } else {
          setVisibleMessages(prev => [...prev, msg])
          currentIndex++
          showNext()
        }
      }, msg.delay)
    }

    showNext()
    return () => clearTimeout(timeoutId)
  }, [started])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleMessages, typing])

  // Auto-start when visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true)
      },
      { threshold: 0.3 }
    )
    if (scrollRef.current) observer.observe(scrollRef.current)
    return () => observer.disconnect()
  }, [started])

  return (
    <div className="max-w-lg mx-auto">
      {/* Phone frame */}
      <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-lg overflow-hidden">
        {/* App header */}
        <div className="px-4 py-2.5 border-b border-[var(--border-card)] flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="text-sm font-medium text-[var(--text-heading)]">StudiesKit AI</span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="p-4 space-y-3 h-[380px] overflow-y-auto">
          {visibleMessages.map((msg, i) => {
            if (msg.role === 'system') {
              return (
                <div key={i} className="flex items-center justify-center gap-2 py-1">
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span className="text-xs text-[var(--accent-text)] font-medium">{msg.content}</span>
                </div>
              )
            }

            const isUser = msg.role === 'user'
            return (
              <div key={i} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0">
                    <Brain className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  isUser
                    ? 'bg-[var(--accent-text)] text-white'
                    : 'bg-[var(--bg-input)] text-[var(--text-body)]'
                }`}>
                  <div className="whitespace-pre-line">{msg.content}</div>
                </div>
                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                )}
              </div>
            )
          })}

          {typing && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0">
                <Brain className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              </div>
              <div className="bg-[var(--bg-input)] rounded-xl px-4 py-2.5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
