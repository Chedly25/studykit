import type { QueueItem } from '../../lib/dailyQueueEngine'
import type { VoiceInputState } from '../chat/ChatInput'

export interface VoicePropsForAnswer {
  initialValue?: string
  onInitialValueConsumed: () => void
  voiceInput?: VoiceInputState
}

export interface QueueItemHandlerProps {
  item: QueueItem
  profileId: string | undefined
  onComplete: (itemId: string) => void
  onRated: (topicName: string, type: string, rating: 'struggled' | 'ok' | 'good') => void
  onRetry?: (item: QueueItem) => void
  examProfileId?: string
  isPro: boolean
  voiceProps: VoicePropsForAnswer
}
