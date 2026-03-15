/**
 * Bar Exam (MBE) seed data — based on NCBE subject matter outlines.
 * 7 MBE subjects with topics and subtopics, weighted by exam representation.
 */
import type { ExamType } from '../schema'

export interface SeedSubject {
  name: string
  weight: number // percentage of exam
  color: string
  topics: SeedTopic[]
}

export interface SeedTopic {
  name: string
  subtopics: string[]
}

export const barExamSeed: { examType: ExamType; subjects: SeedSubject[] } = {
  examType: 'bar',
  subjects: [
    {
      name: 'Constitutional Law',
      weight: 14,
      color: '#3b82f6',
      topics: [
        { name: 'Judicial Review & Justiciability', subtopics: ['Standing', 'Ripeness & Mootness', 'Political Question Doctrine', 'Advisory Opinions'] },
        { name: 'Federal Legislative Power', subtopics: ['Commerce Clause', 'Taxing & Spending Power', 'War Powers', 'Property Power', 'Necessary & Proper Clause'] },
        { name: 'Federal Executive Power', subtopics: ['Executive Privilege', 'Appointment & Removal', 'Treaty Power', 'Executive Orders'] },
        { name: 'Federalism', subtopics: ['Supremacy Clause', 'Preemption', 'Intergovernmental Immunities', '10th Amendment', '11th Amendment'] },
        { name: 'Due Process', subtopics: ['Procedural Due Process', 'Substantive Due Process', 'Incorporation Doctrine', 'Privacy Rights'] },
        { name: 'Equal Protection', subtopics: ['Strict Scrutiny', 'Intermediate Scrutiny', 'Rational Basis', 'Suspect Classifications', 'Fundamental Rights'] },
        { name: 'First Amendment', subtopics: ['Free Speech', 'Content-Based vs Content-Neutral', 'Commercial Speech', 'Obscenity', 'Free Exercise', 'Establishment Clause'] },
        { name: 'State Action', subtopics: ['Public Function Doctrine', 'Entanglement', 'State Action Requirement'] },
      ],
    },
    {
      name: 'Contracts',
      weight: 14,
      color: '#8b5cf6',
      topics: [
        { name: 'Formation', subtopics: ['Offer', 'Acceptance', 'Consideration', 'Promissory Estoppel', 'Mailbox Rule'] },
        { name: 'Defenses to Formation', subtopics: ['Statute of Frauds', 'Mistake', 'Misrepresentation', 'Duress', 'Unconscionability', 'Illegality'] },
        { name: 'Parol Evidence Rule', subtopics: ['Integration', 'Exceptions to Parol Evidence'] },
        { name: 'Contract Interpretation', subtopics: ['Plain Meaning', 'Course of Dealing', 'Usage of Trade'] },
        { name: 'Conditions', subtopics: ['Express Conditions', 'Constructive Conditions', 'Excuse of Conditions'] },
        { name: 'Breach & Remedies', subtopics: ['Material Breach', 'Anticipatory Repudiation', 'Expectation Damages', 'Reliance Damages', 'Restitution', 'Specific Performance'] },
        { name: 'Third-Party Rights', subtopics: ['Third-Party Beneficiaries', 'Assignment', 'Delegation'] },
        { name: 'UCC Article 2', subtopics: ['Merchants', 'Battle of the Forms', 'Perfect Tender Rule', 'Warranties', 'Risk of Loss'] },
      ],
    },
    {
      name: 'Criminal Law & Procedure',
      weight: 14,
      color: '#ef4444',
      topics: [
        { name: 'Homicide', subtopics: ['First-Degree Murder', 'Second-Degree Murder', 'Voluntary Manslaughter', 'Involuntary Manslaughter', 'Felony Murder'] },
        { name: 'Other Crimes Against Persons', subtopics: ['Assault', 'Battery', 'Kidnapping', 'False Imprisonment', 'Rape'] },
        { name: 'Property Crimes', subtopics: ['Larceny', 'Embezzlement', 'False Pretenses', 'Robbery', 'Burglary', 'Arson'] },
        { name: 'Inchoate Offenses', subtopics: ['Attempt', 'Conspiracy', 'Solicitation'] },
        { name: 'Defenses', subtopics: ['Insanity', 'Intoxication', 'Self-Defense', 'Duress', 'Necessity', 'Entrapment'] },
        { name: '4th Amendment', subtopics: ['Search & Seizure', 'Warrant Requirement', 'Exceptions to Warrant', 'Exclusionary Rule', 'Standing'] },
        { name: '5th Amendment', subtopics: ['Miranda Rights', 'Self-Incrimination', 'Double Jeopardy', 'Grand Jury'] },
        { name: '6th Amendment', subtopics: ['Right to Counsel', 'Speedy Trial', 'Confrontation Clause', 'Jury Trial'] },
      ],
    },
    {
      name: 'Evidence',
      weight: 14,
      color: '#f59e0b',
      topics: [
        { name: 'Relevance', subtopics: ['Logical Relevance', 'Legal Relevance (403)', 'Character Evidence', 'Habit'] },
        { name: 'Hearsay', subtopics: ['Definition', 'Non-Hearsay (801(d))', 'Present Sense Impression', 'Excited Utterance', 'State of Mind', 'Business Records', 'Past Recollection Recorded', 'Residual Exception'] },
        { name: 'Witnesses', subtopics: ['Competency', 'Impeachment', 'Rehabilitation', 'Lay Opinion', 'Expert Opinion'] },
        { name: 'Privileges', subtopics: ['Attorney-Client', 'Spousal', 'Physician-Patient', '5th Amendment'] },
        { name: 'Authentication & Best Evidence', subtopics: ['Authentication Methods', 'Self-Authentication', 'Best Evidence Rule'] },
        { name: 'Judicial Notice', subtopics: ['Adjudicative Facts', 'Legislative Facts'] },
      ],
    },
    {
      name: 'Real Property',
      weight: 14,
      color: '#10b981',
      topics: [
        { name: 'Estates in Land', subtopics: ['Fee Simple', 'Life Estate', 'Defeasible Fees', 'Future Interests'] },
        { name: 'Landlord-Tenant', subtopics: ['Types of Tenancies', 'Duties of Landlord', 'Duties of Tenant', 'Assignment & Sublease'] },
        { name: 'Concurrent Ownership', subtopics: ['Joint Tenancy', 'Tenancy in Common', 'Tenancy by the Entirety', 'Community Property'] },
        { name: 'Conveyancing', subtopics: ['Land Sale Contracts', 'Deeds', 'Recording Acts', 'Title Insurance'] },
        { name: 'Mortgages', subtopics: ['Types of Mortgages', 'Foreclosure', 'Priority', 'Transfer of Mortgaged Property'] },
        { name: 'Easements & Covenants', subtopics: ['Creation of Easements', 'Termination', 'Real Covenants', 'Equitable Servitudes'] },
        { name: 'Zoning & Takings', subtopics: ['Zoning Power', 'Variances', 'Regulatory Takings', 'Eminent Domain'] },
      ],
    },
    {
      name: 'Torts',
      weight: 16,
      color: '#ec4899',
      topics: [
        { name: 'Intentional Torts', subtopics: ['Battery', 'Assault', 'False Imprisonment', 'IIED', 'Trespass to Land', 'Trespass to Chattels', 'Conversion'] },
        { name: 'Negligence', subtopics: ['Duty', 'Breach', 'Causation (Actual & Proximate)', 'Damages', 'Res Ipsa Loquitur'] },
        { name: 'Strict Liability', subtopics: ['Abnormally Dangerous Activities', 'Animals', 'Products Liability'] },
        { name: 'Products Liability', subtopics: ['Manufacturing Defects', 'Design Defects', 'Warning Defects', 'Defenses'] },
        { name: 'Defenses', subtopics: ['Comparative Negligence', 'Contributory Negligence', 'Assumption of Risk', 'Consent'] },
        { name: 'Vicarious Liability', subtopics: ['Respondeat Superior', 'Independent Contractor', 'Joint Enterprise'] },
        { name: 'Damages', subtopics: ['Compensatory', 'Punitive', 'Economic Loss Rule', 'Emotional Distress'] },
      ],
    },
    {
      name: 'Civil Procedure',
      weight: 14,
      color: '#06b6d4',
      topics: [
        { name: 'Jurisdiction', subtopics: ['Subject Matter Jurisdiction', 'Personal Jurisdiction', 'Supplemental Jurisdiction', 'Removal'] },
        { name: 'Venue & Forum', subtopics: ['Venue Rules', 'Transfer', 'Forum Non Conveniens'] },
        { name: 'Pleadings', subtopics: ['Complaint', 'Answer', 'Amendments', 'Rule 12 Motions'] },
        { name: 'Joinder', subtopics: ['Permissive Joinder', 'Compulsory Joinder', 'Intervention', 'Interpleader', 'Class Actions'] },
        { name: 'Discovery', subtopics: ['Scope', 'Depositions', 'Interrogatories', 'Requests for Production', 'Privilege', 'Work Product'] },
        { name: 'Summary Judgment & Trial', subtopics: ['Summary Judgment Standard', 'Jury Trial Right', 'Directed Verdict', 'JMOL'] },
        { name: 'Res Judicata & Collateral Estoppel', subtopics: ['Claim Preclusion', 'Issue Preclusion', 'Full Faith and Credit'] },
      ],
    },
  ],
}
