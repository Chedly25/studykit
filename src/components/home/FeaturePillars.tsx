import { useTranslation } from 'react-i18next'
import { Brain, Target, BarChart3 } from 'lucide-react'

export function FeaturePillars() {
  const { t } = useTranslation()

  const features = [
    {
      icon: Brain,
      title: t('home.features.tutor'),
      description: t('home.features.tutorDesc'),
    },
    {
      icon: Target,
      title: t('home.features.knowledge'),
      description: t('home.features.knowledgeDesc'),
    },
    {
      icon: BarChart3,
      title: t('home.features.practice'),
      description: t('home.features.practiceDesc'),
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {features.map((f, i) => (
        <div key={i} className="glass-card p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-bg)] flex items-center justify-center mx-auto mb-4">
            <f.icon className="w-6 h-6 text-[var(--accent-text)]" />
          </div>
          <h3 className="font-[family-name:var(--font-display)] font-semibold text-lg text-[var(--text-heading)] mb-2">
            {f.title}
          </h3>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            {f.description}
          </p>
        </div>
      ))}
    </div>
  )
}
