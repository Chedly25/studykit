/**
 * Terms of Service page.
 * Route: /terms
 */
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Terms() {
  const { t } = useTranslation()

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-fade-in">
      <Helmet>
        <title>{t('terms.pageTitle', 'Terms of Service — StudiesKit')}</title>
        <meta name="description" content="StudiesKit terms of service — rules and conditions for using our platform." />
      </Helmet>

      <h1 className="text-3xl font-bold text-[var(--text-heading)] mb-6">
        {t('terms.title', 'Terms of Service')}
      </h1>

      {/* Template banner */}
      <div className="glass-card p-4 mb-8 border-l-4 border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]">
        <p className="text-sm text-[var(--text-body)] font-medium">
          {t(
            'terms.templateBanner',
            'These terms of service are a template and should be reviewed by a legal professional before use.'
          )}
        </p>
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-8">
        {t('terms.lastUpdated', 'Last updated: April 2026')}
      </p>

      <div className="space-y-8 text-[var(--text-body)] text-sm leading-relaxed">
        {/* 1. Acceptance */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.acceptanceTitle', '1. Acceptance of Terms')}
          </h2>
          <p>
            {t(
              'terms.acceptanceBody',
              'By accessing or using StudiesKit ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.'
            )}
          </p>
        </section>

        {/* 2. Description of Service */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.descriptionTitle', '2. Description of Service')}
          </h2>
          <p>
            {t(
              'terms.descriptionBody',
              'StudiesKit is an AI-powered study platform that helps users prepare for exams, manage study materials, and track their learning progress. The Service includes both free and paid (Pro) tiers with different feature sets.'
            )}
          </p>
        </section>

        {/* 3. User Accounts */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.accountsTitle', '3. User Accounts')}
          </h2>
          <p className="mb-2">
            {t(
              'terms.accountsBody1',
              'To access certain features, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.'
            )}
          </p>
          <p>
            {t(
              'terms.accountsBody2',
              'You must provide accurate information when creating your account and keep it up to date. We reserve the right to suspend or terminate accounts that violate these terms.'
            )}
          </p>
        </section>

        {/* 4. Acceptable Use */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.useTitle', '4. Acceptable Use')}
          </h2>
          <p className="mb-2">
            {t('terms.useIntro', 'You agree not to:')}
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li>{t('terms.useRule1', 'Use the Service for any unlawful purpose')}</li>
            <li>{t('terms.useRule2', 'Attempt to gain unauthorized access to the Service or its systems')}</li>
            <li>{t('terms.useRule3', 'Interfere with or disrupt the Service or servers')}</li>
            <li>{t('terms.useRule4', 'Upload malicious content or code')}</li>
            <li>{t('terms.useRule5', 'Use automated tools to scrape or extract data from the Service')}</li>
            <li>{t('terms.useRule6', 'Resell or redistribute the Service without authorization')}</li>
            <li>{t('terms.useRule7', 'Use the AI features to generate harmful, misleading, or illegal content')}</li>
          </ul>
        </section>

        {/* 5. Intellectual Property */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.ipTitle', '5. Intellectual Property')}
          </h2>
          <p className="mb-2">
            {t(
              'terms.ipBody1',
              'The Service and its original content, features, and functionality are owned by [Company Name] and are protected by international copyright, trademark, and other intellectual property laws.'
            )}
          </p>
          <p>
            {t(
              'terms.ipBody2',
              'You retain ownership of any content you upload to the Service (study materials, notes, etc.). By uploading content, you grant us a limited license to process it for the purpose of providing the Service (e.g., AI-powered summaries, flashcard generation).'
            )}
          </p>
        </section>

        {/* 6. Limitation of Liability */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.liabilityTitle', '6. Limitation of Liability')}
          </h2>
          <p className="mb-2">
            {t(
              'terms.liabilityBody1',
              'The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or secure.'
            )}
          </p>
          <p className="mb-2">
            {t(
              'terms.liabilityBody2',
              'AI-generated content (summaries, flashcards, practice questions) is provided for study purposes only and may contain errors. You should always verify important information with authoritative sources.'
            )}
          </p>
          <p>
            {t(
              'terms.liabilityBody3',
              'To the maximum extent permitted by applicable law, [Company Name] shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.'
            )}
          </p>
        </section>

        {/* 7. Termination */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.terminationTitle', '7. Termination')}
          </h2>
          <p className="mb-2">
            {t(
              'terms.terminationBody1',
              'You may terminate your account at any time from the Settings page. Upon termination, your cloud-synced data will be deleted, and your local data will remain in your browser until cleared.'
            )}
          </p>
          <p>
            {t(
              'terms.terminationBody2',
              'We reserve the right to suspend or terminate your access to the Service at any time for violation of these terms, with reasonable notice where possible.'
            )}
          </p>
        </section>

        {/* 8. Changes to Terms */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.changesTitle', '8. Changes to Terms')}
          </h2>
          <p>
            {t(
              'terms.changesBody',
              'We may update these terms from time to time. We will notify you of material changes by posting the updated terms on this page and updating the "Last updated" date. Your continued use of the Service after changes are posted constitutes acceptance of the revised terms.'
            )}
          </p>
        </section>

        {/* 9. Contact */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            {t('terms.contactTitle', '9. Contact')}
          </h2>
          <p>
            {t(
              'terms.contactBody',
              'If you have any questions about these Terms of Service, please contact us at:'
            )}
          </p>
          <p className="mt-2 font-medium">
            legal@studieskit.com
          </p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-[var(--border-card)] text-sm text-[var(--text-muted)]">
        <Link to="/privacy" className="hover:text-[var(--text-body)] underline transition-colors">
          {t('terms.viewPrivacy', 'View Privacy Policy')}
        </Link>
      </div>
    </div>
  )
}
