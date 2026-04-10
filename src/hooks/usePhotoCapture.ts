/**
 * Photo capture + vision text extraction via Anthropic Haiku.
 * Supports camera capture and file selection.
 */
import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { track } from '../lib/analytics'

const MAX_IMAGE_DIMENSION = 2048

/**
 * Resize an image blob to max dimension, returns JPEG blob.
 */
async function resizeImage(blob: Blob): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
        // Already small enough — convert to JPEG
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0)
        canvas.toBlob(b => resolve(b || blob), 'image/jpeg', 0.85)
        return
      }
      // Scale down
      const scale = MAX_IMAGE_DIMENSION / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(b => resolve(b || blob), 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(blob) }
    img.src = objectUrl
  })
}

export function usePhotoCapture() {
  const { getToken } = useAuth()
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectFromFiles = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.capture = 'environment' // Opens camera on mobile
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { resolve(null); return }
        try {
          const resized = await resizeImage(file)
          resolve(resized)
        } catch {
          resolve(file)
        }
      }
      input.click()
    })
  }, [])

  const extractText = useCallback(async (
    image: Blob,
    prompt?: string,
  ): Promise<string> => {
    setError(null)
    setIsExtracting(true)
    try {
      const token = await getToken()
      if (!token) { setError('Not authenticated'); return '' }

      const formData = new FormData()
      formData.append('image', image, 'photo.jpg')
      if (prompt) formData.append('prompt', prompt)

      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })

      if (res.status === 403) {
        setError('Photo scan requires Pro plan')
        return ''
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Vision failed' })) as { error?: string }
        setError(data.error ?? 'Text extraction failed')
        return ''
      }

      const data = await res.json() as { text?: string; error?: string }
      if (data.error) { setError(data.error); return '' }
      track('photo_used')
      return data.text ?? ''
    } catch {
      setError('Text extraction failed')
      return ''
    } finally {
      setIsExtracting(false)
    }
  }, [getToken])

  /** Grade a handwritten solution. Returns parsed GradingResult or null on failure. */
  const gradeWork = useCallback(async (image: Blob): Promise<GradingResult | null> => {
    setError(null)
    setIsExtracting(true)
    try {
      const token = await getToken()
      if (!token) { setError('Not authenticated'); return null }

      const formData = new FormData()
      formData.append('image', image, 'photo.jpg')
      formData.append('mode', 'grade')

      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })

      if (res.status === 403) {
        setError('La correction de copie nécessite Pro')
        return null
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Grading failed' })) as { error?: string }
        setError(data.error ?? 'Correction failed')
        return null
      }

      const data = await res.json() as { text?: string; error?: string }
      if (data.error) { setError(data.error); return null }

      // Parse JSON from the response (may be wrapped in markdown code fence)
      const raw = data.text ?? ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        setError('Impossible de parser la correction')
        return null
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]) as GradingResult
        track('photo_graded')
        return parsed
      } catch {
        setError('Format de réponse invalide')
        return null
      }
    } catch {
      setError('La correction a échoué')
      return null
    } finally {
      setIsExtracting(false)
    }
  }, [getToken])

  return {
    selectFromFiles,
    extractText,
    gradeWork,
    isExtracting,
    error,
  }
}

export interface GradingStep {
  line: number
  content: string
  status: 'correct' | 'partial' | 'error'
  feedback: string
}

export interface GradingResult {
  transcription: string
  problemStatement: string
  steps: GradingStep[]
  overallScore: number
  maxScore: number
  summary: string
  suggestions: string[]
}
