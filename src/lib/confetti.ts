/**
 * Thin wrapper around canvas-confetti with lazy loading.
 * Zero bundle cost until first celebration fires.
 */

export async function fireConfetti(preset: 'celebration' | 'subtle' | 'achievement') {
  const confetti = (await import('canvas-confetti')).default

  switch (preset) {
    case 'celebration':
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
      break
    case 'subtle':
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.5 }, gravity: 1.2, scalar: 0.8 })
      break
    case 'achievement':
      confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#f59e0b', '#fbbf24', '#fcd34d'] })
      confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#f59e0b', '#fbbf24', '#fcd34d'] })
      break
  }
}
