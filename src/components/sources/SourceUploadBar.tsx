import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, ClipboardPaste, PenLine } from 'lucide-react'

interface Props {
  onUploadPdfs: (files: File[]) => void
  onPasteText: () => void
  onWriteNote: () => void
  disabled?: boolean
}

export function SourceUploadBar({ onUploadPdfs, onPasteText, onWriteNote, disabled }: Props) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf')
    if (pdfs.length > 0) {
      onUploadPdfs(pdfs)
    }
    // Reset so the same file can be re-uploaded
    e.target.value = ''
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40"
        >
          <Upload className="w-4 h-4" />
          {t('sources.upload')}
        </button>
        <button
          onClick={onPasteText}
          disabled={disabled}
          className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40"
        >
          <ClipboardPaste className="w-4 h-4" />
          {t('sources.paste')}
        </button>
        <button
          onClick={onWriteNote}
          disabled={disabled}
          className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40"
        >
          <PenLine className="w-4 h-4" />
          {t('sources.addUrl')}
        </button>
      </div>
      <p className="text-xs text-[var(--text-faint)] mt-1.5">{t('sources.fileSizeHint')}</p>
    </div>
  )
}
