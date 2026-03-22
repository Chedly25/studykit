import { MessageCircle } from 'lucide-react'

interface Props {
  subjectId: string
  subjectName: string
}

export function SubjectTutorLauncher({ subjectId, subjectName }: Props) {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('open-chat-panel', {
      detail: { subjectId, subjectName },
    }))
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:underline"
    >
      <MessageCircle className="w-3.5 h-3.5" />
      Ask tutor
    </button>
  )
}
