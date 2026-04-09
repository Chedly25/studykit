/**
 * Privacy Policy page — GDPR-compliant privacy notice.
 * Route: /privacy
 */
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Privacy() {
  const { t } = useTranslation()

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-fade-in">
      <Helmet>
        <title>{t('privacy.pageTitle', 'Privacy Policy — StudiesKit')}</title>
        <meta name="description" content="StudiesKit privacy policy — how we collect, store, and protect your data." />
      </Helmet>

      <h1 className="text-3xl font-bold text-[var(--text-heading)] mb-6">
        {t('privacy.title', 'Privacy Policy')}
      </h1>

      <p className="text-sm text-[var(--text-muted)] mb-8">
        {t('privacy.lastUpdated', 'Last updated: April 2026')}
      </p>

      <div className="space-y-8 text-[var(--text-body)] text-sm leading-relaxed">
        {/* 1. Data Controller */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('privacy.controllerTitle', '1. Data Controller')}
          </h2>
          <p>
            {t(
              'privacy.controllerBody',
              'StudiesKit, operated by Chedly Boukhris. For any data-related inquiries, please contact us at privacy@studieskit.com.'
            )}
          </p>
        </section>

        {/* 2. What Data We Collect */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('privacy.collectTitle', '2. What Data We Collect')}
          </h2>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li>
              <strong>{t('privacy.studyData', 'Study data')}</strong> — {t(
                'privacy.studyDataDesc',
                'Your exam profiles, notes, flashcards, study sessions, and progress. This data is stored locally in your browser (IndexedDB) and never leaves your device unless you enable cloud sync.'
              )}
            </li>
            <li>
              <strong>{t('privacy.authData', 'Authentication data')}</strong> — {t(
                'privacy.authDataDesc',
                'Email address, name, and profile picture managed by Clerk (our authentication provider). We do not store passwords directly.'
              )}
            </li>
            <li>
              <strong>{t('privacy.paymentData', 'Payment data')}</strong> — {t(
                'privacy.paymentDataDesc',
                'Subscription and billing information processed by Stripe. We never store full card numbers on our servers.'
              )}
            </li>
            <li>
              <strong>{t('privacy.usageData', 'Usage analytics')}</strong> — {t(
                'privacy.usageDataDesc',
                'Anonymous usage data (page views, feature usage) collected via PostHog, only with your consent. PostHog is EU-hosted.'
              )}
            </li>
            <li>
              <strong>{t('privacy.errorData', 'Error reports')}</strong> — {t(
                'privacy.errorDataDesc',
                'Technical error data collected via Sentry to help us fix bugs, only with your consent.'
              )}
            </li>
          </ul>
        </section>

        {/* 3. How Data Is Stored */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('privacy.storageTitle', '3. How Data Is Stored')}
          </h2>
          <p className="mb-2">
            {t(
              'privacy.storageBody1',
              'Your study data is stored primarily in IndexedDB, which is local to your browser. This means your data stays on your device by default.'
            )}
          </p>
          <p>
            {t(
              'privacy.storageBody2',
              'If you are a Pro subscriber and enable cloud sync, your profile data is encrypted and stored on Cloudflare Workers KV (edge storage). Cloud-synced data is retained for 90 days and can be deleted at any time from your Settings page.'
            )}
          </p>
        </section>

        {/* 4. Third-Party Processors */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('privacy.processorsTitle', '4. Third-Party Processors')}
          </h2>
          <p className="mb-3">
            {t(
              'privacy.processorsIntro',
              'We use the following third-party services to provide our platform:'
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-card)]">
                  <th className="text-left py-2 pr-4 font-semibold text-[var(--text-heading)]">Service</th>
                  <th className="text-left py-2 pr-4 font-semibold text-[var(--text-heading)]">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-card)]">
                <tr><td className="py-2 pr-4">Clerk</td><td className="py-2">Authentication &amp; user management</td></tr>
                <tr><td className="py-2 pr-4">Stripe</td><td className="py-2">Payment processing &amp; subscriptions</td></tr>
                <tr><td className="py-2 pr-4">Moonshot AI</td><td className="py-2">AI chat &amp; study assistance</td></tr>
                <tr><td className="py-2 pr-4">Anthropic</td><td className="py-2">AI pipeline (content generation)</td></tr>
                <tr><td className="py-2 pr-4">Cloudflare</td><td className="py-2">Hosting, edge functions, embeddings</td></tr>
                <tr><td className="py-2 pr-4">PostHog</td><td className="py-2">Analytics (EU-hosted, consent-based)</td></tr>
                <tr><td className="py-2 pr-4">Sentry</td><td className="py-2">Error tracking (consent-based)</td></tr>
                <tr><td className="py-2 pr-4">Resend</td><td className="py-2">Transactional email delivery</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Data Retention */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('privacy.retentionTitle', '5. Data Retention')}
          </h2>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li>
              <strong>{t('privacy.localData', 'Local data')}</strong> — {t(
                'privacy.localDataDesc',
                'Persists in your browser until you clear your browser data or delete your profile in Settings.'
              )}
            </li>
            <li>
              <strong>{t('privacy.cloudData', 'Cloud sync data')}</strong> — {t(
                'privacy.cloudDataDesc',
                'Retained for 90 days on Cloudflare KV. You can delete it at any time from Settings.'
              )}
            </li>
            <li>
              <strong>{t('privacy.accountData', 'Account data')}</strong> — {t(
                'privacy.accountDataDesc',
                'Deleted upon request. You can delete your account from Settings, which removes all associated data from our systems.'
              )}
            </li>
          </ul>
        </section>

        {/* 6. Your Rights */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('privacy.rightsTitle', '6. Your Rights (GDPR)')}
          </h2>
          <p className="mb-2">
            {t(
              'privacy.rightsIntro',
              'Under the General Data Protection Regulation (GDPR), you have the following rights:'
            )}
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li>
              <strong>{t('privacy.rightAccess', 'Right of access')}</strong> — {t(
                'privacy.rightAccessDesc',
                'You can export all your data from the Settings page at any time.'
              )}
            </li>
            <li>
              <strong>{t('privacy.rightPortability', 'Right to data portability')}</strong> — {t(
                'privacy.rightPortabilityDesc',
                'Your data can be exported as a JSON file from Settings.'
              )}
            </li>
            <li>
              <strong>{t('privacy.rightErasure', 'Right to erasure')}</strong> — {t(
                'privacy.rightErasureDesc',
                'You can delete your account and all associated data from Settings.'
              )}
            </li>
            <li>
              <strong>{t('privacy.rightWithdraw', 'Right to withdraw consent')}</strong> — {t(
                'privacy.rightWithdrawDesc',
                'You can change your cookie preferences at any time. Analytics and error tracking only run with your explicit consent.'
              )}
            </li>
          </ul>
        </section>

        {/* 7. Contact */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('privacy.contactTitle', '7. Contact')}
          </h2>
          <p>
            {t(
              'privacy.contactBody',
              'If you have any questions about this privacy policy or your data, please contact us at:'
            )}
          </p>
          <p className="mt-2 font-medium">
            privacy@studieskit.com
          </p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-[var(--border-card)] text-sm text-[var(--text-muted)]">
        <Link to="/terms" className="hover:text-[var(--text-body)] underline transition-colors">
          {t('privacy.viewTerms', 'View Terms of Service')}
        </Link>
      </div>
    </div>
  )
}
