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
    img.onload = () => {
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
    img.onerror = () => resolve(blob)
    img.src = URL.createObjectURL(blob)
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

  return {
    selectFromFiles,
    extractText,
    isExtracting,
    error,
  }
}
