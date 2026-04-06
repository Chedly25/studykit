import { Helmet } from 'react-helmet-async'

interface ToolSEOProps {
  title: string
  description: string
  slug: string
  keywords?: string[]
}

export function ToolSEO({ title, description, slug, keywords }: ToolSEOProps) {
  const BASE_URL = import.meta.env.VITE_PUBLIC_URL || 'https://studieskit.com'
  const url = `${BASE_URL}/${slug}`

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(', ')} />
      )}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={`${BASE_URL}/og-image.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${BASE_URL}/twitter-card.png`} />
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: title,
          description,
          url,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        })}
      </script>
    </Helmet>
  )
}
