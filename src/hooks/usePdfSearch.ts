import { useState, useCallback, useMemo } from 'react'

export interface SearchMatch {
  pageNumber: number
  spanIndex: number
}

/**
 * Manages Ctrl+F search state for the PDF reader.
 * Takes pre-extracted page texts and finds all matches.
 */
export function usePdfSearch(pageTexts: string[]) {
  const [query, setQuery] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  const matches = useMemo(() => {
    if (!query || query.length < 2) return []
    const q = query.toLowerCase()
    const results: SearchMatch[] = []
    for (let page = 0; page < pageTexts.length; page++) {
      const text = pageTexts[page].toLowerCase()
      let pos = 0
      let spanIdx = 0
      while ((pos = text.indexOf(q, pos)) !== -1) {
        results.push({ pageNumber: page + 1, spanIndex: spanIdx++ })
        pos += q.length
      }
    }
    return results
  }, [query, pageTexts])

  const currentMatch = matches.length > 0 ? matches[currentIndex] : null

  const goToNext = useCallback(() => {
    if (matches.length === 0) return null
    const next = (currentIndex + 1) % matches.length
    setCurrentIndex(next)
    return matches[next]
  }, [matches, currentIndex])

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return null
    const prev = (currentIndex - 1 + matches.length) % matches.length
    setCurrentIndex(prev)
    return matches[prev]
  }, [matches, currentIndex])

  const updateQuery = useCallback((q: string) => {
    setQuery(q)
    setCurrentIndex(0)
  }, [])

  const clear = useCallback(() => {
    setQuery('')
    setCurrentIndex(0)
  }, [])

  return {
    query,
    setQuery: updateQuery,
    matches,
    matchCount: matches.length,
    currentIndex,
    currentMatch,
    goToNext,
    goToPrev,
    clear,
  }
}
