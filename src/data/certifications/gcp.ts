/**
 * Google Cloud Platform (GCP) certification catalog.
 * 8 certifications covering foundational through professional levels.
 *
 * Note: GCP does not publish official domain weights — values are approximate
 * based on exam guides and community consensus as of early 2026.
 */
import type { CertificationEntry } from './types'

export const GCP_CERTS: CertificationEntry[] = [
  // ─── 1. Cloud Digital Leader ─────────────────────────────────────
  {
    id: 'gcp-cloud-digital-leader',
    vendor: 'Google Cloud',
    certName: 'Cloud Digital Leader',
    certCode: 'Cloud Digital Leader',
    aliases: [
      /\bcloud\s*digital\s*leader\b/i,
      /\bgcp\b.*\bdigital\s*leader\b/i,
      /\bgoogle\s*cloud\b.*\bdigital\s*leader\b/i,
      /\bcdl\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 55,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'Cloud Digital Leader Exam',
        description: 'MCQ and multiple-select questions covering cloud fundamentals and Google Cloud services',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Digital Transformation with Google Cloud',
        weight: 18,
        topics: [
          { name: 'Why cloud technology is transforming business' },
          { name: 'Fundamental cloud concepts (IaaS, PaaS, SaaS)' },
          { name: 'Cloud adoption frameworks and migration strategies' },
        ],
        chapters: [
          {
            name: 'Cloud Adoption and Strategy',
            topics: [
              { name: 'Total cost of ownership and OpEx vs CapEx' },
              { name: 'Business drivers for cloud transformation' },
              { name: 'Change management and organizational readiness' },
            ],
          },
          {
            name: 'Google Cloud Solutions',
            topics: [
              { name: 'Compute options (Compute Engine, GKE, Cloud Run, App Engine)' },
              { name: 'Storage and database options' },
              { name: 'Networking fundamentals (VPC, load balancing)' },
            ],
          },
        ],
      },
      {
        name: 'Innovating with Data and AI',
        weight: 20,
        topics: [
          { name: 'Google Cloud data management solutions' },
          { name: 'Smart analytics and BI tools' },
          { name: 'Machine learning and AI products on Google Cloud' },
        ],
        chapters: [
          {
            name: 'Data Management',
            topics: [
              { name: 'BigQuery fundamentals and use cases' },
              { name: 'Cloud SQL, Spanner, Bigtable, Firestore selection' },
              { name: 'Dataflow and Pub/Sub for streaming' },
            ],
          },
          {
            name: 'AI and Machine Learning',
            topics: [
              { name: 'Vertex AI and AutoML basics' },
              { name: 'Pre-trained APIs (Vision, Natural Language, Translation)' },
              { name: 'Responsible AI principles' },
            ],
          },
        ],
      },
      {
        name: 'Infrastructure and Application Modernization',
        weight: 22,
        topics: [
          { name: 'Modernizing infrastructure with Google Cloud' },
          { name: 'Application modernization and containers' },
          { name: 'Serverless computing on Google Cloud' },
        ],
        chapters: [
          {
            name: 'Infrastructure Modernization',
            topics: [
              { name: 'Virtual machines and managed instance groups' },
              { name: 'Containers and Kubernetes (GKE)' },
              { name: 'Hybrid and multi-cloud with Anthos' },
            ],
          },
          {
            name: 'Application Modernization',
            topics: [
              { name: 'Microservices architecture patterns' },
              { name: 'Cloud Run and App Engine for serverless' },
              { name: 'API management with Apigee' },
            ],
          },
        ],
      },
      {
        name: 'Google Cloud Security and Operations',
        weight: 22,
        topics: [
          { name: 'Google Cloud security foundations' },
          { name: 'Identity and access management' },
          { name: 'Monitoring and operations tooling' },
        ],
        chapters: [
          {
            name: 'Security Foundations',
            topics: [
              { name: 'Shared responsibility model' },
              { name: 'IAM roles, policies, and service accounts' },
              { name: 'Encryption at rest and in transit' },
            ],
          },
          {
            name: 'Operations and Monitoring',
            topics: [
              { name: 'Cloud Monitoring and Cloud Logging' },
              { name: 'Cost management and billing controls' },
              { name: 'Resource hierarchy (org, folders, projects)' },
            ],
          },
        ],
      },
      {
        name: 'Scaling with Google Cloud Operations',
        weight: 18,
        topics: [
          { name: 'Financial governance and cost optimization' },
          { name: 'Operational excellence best practices' },
          { name: 'Resource management and sustainability' },
        ],
        chapters: [
          {
            name: 'Cost Management',
            topics: [
              { name: 'Billing accounts, budgets, and alerts' },
              { name: 'Committed use discounts and sustained use pricing' },
              { name: 'Cost optimization strategies' },
            ],
          },
          {
            name: 'Operational Reliability',
            topics: [
              { name: 'SLA, SLO, and SLI concepts' },
              { name: 'Disaster recovery planning' },
              { name: 'Automation with Cloud Deployment Manager and Terraform' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Cloud Digital Leader is a foundational certification that validates understanding of Google Cloud capabilities and how they can be used to achieve business objectives. No hands-on experience required — focuses on concepts, benefits, and use cases rather than implementation details.',
      totalDuration: 120,
      passingScore: 70,
      tips: [
        'Focus on understanding WHEN and WHY to use each service, not how to configure them',
        'Know the difference between IaaS, PaaS, and SaaS with Google Cloud examples',
        'Understand BigQuery, Vertex AI, and Cloud Run at a high level — these appear frequently',
        'Review the shared responsibility model and basic IAM concepts',
        'Cost optimization questions are common — know billing concepts and pricing models',
      ],
    },

    questionStyle: 'Scenario-based questions testing understanding of Google Cloud services and their business applications. Questions present real-world situations and ask which Google Cloud product or approach best addresses the need. No deep technical implementation knowledge required.',
  },

  // ─── 2. Associate Cloud Engineer ─────────────────────────────────
  {
    id: 'gcp-associate-cloud-engineer',
    vendor: 'Google Cloud',
    certName: 'Associate Cloud Engineer',
    certCode: 'Associate Cloud Engineer',
    aliases: [
      /\bassociate\s*cloud\s*engineer\b/i,
      /\bgcp\b.*\bcloud\s*engineer\b/i,
      /\bgoogle\s*cloud\b.*\bengineer\b/i,
      /\bace\b.*\bgcp\b/i,
      /\bgcp\b.*\bace\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 55,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'Associate Cloud Engineer Exam',
        description: 'MCQ and multiple-select questions on deploying and managing Google Cloud solutions',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Setting Up a Cloud Solution Environment',
        weight: 17,
        topics: [
          { name: 'Creating projects and managing resource hierarchy' },
          { name: 'Managing billing configuration' },
          { name: 'Installing and configuring the Cloud SDK' },
        ],
        chapters: [
          {
            name: 'Project and Organization Setup',
            topics: [
              { name: 'Resource hierarchy (organizations, folders, projects)' },
              { name: 'IAM policies and role bindings' },
              { name: 'Enabling APIs and managing service accounts' },
            ],
          },
          {
            name: 'Billing and SDK',
            topics: [
              { name: 'Billing accounts and budget alerts' },
              { name: 'gcloud CLI configuration and initialization' },
              { name: 'Cloud Shell usage and customization' },
            ],
          },
        ],
      },
      {
        name: 'Planning and Configuring a Cloud Solution',
        weight: 18,
        topics: [
          { name: 'Planning compute resources (Compute Engine, GKE, Cloud Run)' },
          { name: 'Planning storage and database solutions' },
          { name: 'Planning network resources' },
        ],
        chapters: [
          {
            name: 'Compute Planning',
            topics: [
              { name: 'Choosing between Compute Engine, GKE, App Engine, Cloud Run, Cloud Functions' },
              { name: 'Machine type selection and preemptible/spot VMs' },
              { name: 'Container orchestration decisions' },
            ],
          },
          {
            name: 'Data and Network Planning',
            topics: [
              { name: 'Choosing between Cloud SQL, Spanner, Firestore, Bigtable, BigQuery' },
              { name: 'Cloud Storage classes and lifecycle policies' },
              { name: 'VPC design, subnets, and firewall rules' },
            ],
          },
        ],
      },
      {
        name: 'Deploying and Implementing a Cloud Solution',
        weight: 22,
        topics: [
          { name: 'Deploying compute resources' },
          { name: 'Deploying storage and database resources' },
          { name: 'Deploying networking resources' },
        ],
        chapters: [
          {
            name: 'Compute Deployment',
            topics: [
              { name: 'Creating and configuring VMs with gcloud and Console' },
              { name: 'Deploying GKE clusters and workloads' },
              { name: 'Deploying Cloud Run services and Cloud Functions' },
            ],
          },
          {
            name: 'Data and Network Deployment',
            topics: [
              { name: 'Creating Cloud SQL instances and managing backups' },
              { name: 'Configuring Cloud Storage buckets and permissions' },
              { name: 'Creating VPCs, subnets, firewall rules, and load balancers' },
            ],
          },
        ],
      },
      {
        name: 'Ensuring Successful Operation of a Cloud Solution',
        weight: 22,
        topics: [
          { name: 'Managing Compute Engine resources' },
          { name: 'Managing GKE resources' },
          { name: 'Managing Cloud Monitoring and Logging' },
        ],
        chapters: [
          {
            name: 'Compute Operations',
            topics: [
              { name: 'Managing VM snapshots, images, and instance groups' },
              { name: 'Managing GKE node pools, upgrades, and autoscaling' },
              { name: 'App Engine versioning and traffic splitting' },
            ],
          },
          {
            name: 'Monitoring and Troubleshooting',
            topics: [
              { name: 'Cloud Monitoring dashboards, alerts, and uptime checks' },
              { name: 'Cloud Logging log sinks and filters' },
              { name: 'Cloud Trace and Error Reporting' },
            ],
          },
        ],
      },
      {
        name: 'Configuring Access and Security',
        weight: 21,
        topics: [
          { name: 'Managing IAM roles and policies' },
          { name: 'Managing service accounts' },
          { name: 'Viewing audit logs and managing encryption keys' },
        ],
        chapters: [
          {
            name: 'Identity and Access Management',
            topics: [
              { name: 'Primitive, predefined, and custom IAM roles' },
              { name: 'Service account creation, key management, and impersonation' },
              { name: 'Organization policies and constraints' },
            ],
          },
          {
            name: 'Security Operations',
            topics: [
              { name: 'Cloud Audit Logs (admin, data access, system events)' },
              { name: 'Cloud KMS for key management' },
              { name: 'VPC Service Controls and private Google access' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Associate Cloud Engineer exam tests your ability to deploy applications, monitor operations, and manage enterprise solutions on Google Cloud. It requires hands-on experience with gcloud CLI, Console, and core services. Expect scenario-based questions about real operational tasks.',
      totalDuration: 120,
      passingScore: 70,
      tips: [
        'Master gcloud CLI commands — many questions test specific command syntax and flags',
        'Know when to use each compute option (Compute Engine vs GKE vs Cloud Run vs App Engine)',
        'IAM is heavily tested — understand roles, service accounts, and policy inheritance',
        'Practice with VPC networking, firewall rules, and load balancer configuration',
        'Understand Cloud Monitoring alerting policies and log-based metrics',
      ],
    },

    questionStyle: 'Scenario-based questions that present operational situations and ask you to choose the correct gcloud commands, Console actions, or architectural decisions. Tests practical knowledge of deploying, managing, and troubleshooting Google Cloud resources.',
  },

  // ─── 3. Professional Cloud Architect ─────────────────────────────
  {
    id: 'gcp-professional-cloud-architect',
    vendor: 'Google Cloud',
    certName: 'Professional Cloud Architect',
    certCode: 'Professional Cloud Architect',
    aliases: [
      /\bprofessional\s*cloud\s*architect\b/i,
      /\bgcp\b.*\bcloud\s*architect\b/i,
      /\bgoogle\s*cloud\b.*\barchitect\b/i,
      /\bpca\b.*\bgcp\b/i,
      /\bgcp\b.*\bpca\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 55,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select (includes 2 case studies)',
    performanceBased: false,

    formats: [
      {
        formatName: 'Professional Cloud Architect Exam',
        description: 'MCQ and multiple-select questions including 2 case studies worth ~20-30% of the exam',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Designing and Planning a Cloud Solution Architecture',
        weight: 20,
        topics: [
          { name: 'Designing a solution infrastructure' },
          { name: 'Planning migration strategies' },
          { name: 'Designing for business requirements' },
        ],
        chapters: [
          {
            name: 'Architecture Design',
            topics: [
              { name: 'High availability and disaster recovery patterns' },
              { name: 'Multi-region and global architecture design' },
              { name: 'Cost optimization in architecture decisions' },
            ],
          },
          {
            name: 'Migration Planning',
            topics: [
              { name: 'Lift-and-shift vs refactor vs replatform strategies' },
              { name: 'Migration tools (Migrate for Compute Engine, Database Migration Service)' },
              { name: 'Hybrid connectivity (Cloud Interconnect, VPN)' },
            ],
          },
        ],
      },
      {
        name: 'Managing and Provisioning Solution Infrastructure',
        weight: 20,
        topics: [
          { name: 'Configuring network topologies' },
          { name: 'Configuring individual storage systems' },
          { name: 'Configuring compute systems' },
        ],
        chapters: [
          {
            name: 'Network Infrastructure',
            topics: [
              { name: 'Shared VPC and VPC peering architectures' },
              { name: 'Load balancing options (HTTP(S), TCP/UDP, Internal)' },
              { name: 'Cloud CDN, Cloud DNS, and Cloud NAT' },
            ],
          },
          {
            name: 'Compute and Storage Infrastructure',
            topics: [
              { name: 'Managed instance groups and autoscaling' },
              { name: 'GKE cluster architecture (regional, private, Autopilot)' },
              { name: 'Storage tier selection and data lifecycle management' },
            ],
          },
        ],
      },
      {
        name: 'Designing for Security and Compliance',
        weight: 18,
        topics: [
          { name: 'Designing for security' },
          { name: 'Designing for compliance' },
          { name: 'Identity management and access control' },
        ],
        chapters: [
          {
            name: 'Security Architecture',
            topics: [
              { name: 'Zero-trust security model on Google Cloud' },
              { name: 'BeyondCorp Enterprise and Identity-Aware Proxy' },
              { name: 'Data encryption strategies (CMEK, CSEK, Cloud HSM)' },
            ],
          },
          {
            name: 'Compliance and Governance',
            topics: [
              { name: 'Organization policies and resource constraints' },
              { name: 'VPC Service Controls for data exfiltration protection' },
              { name: 'Regulatory compliance (HIPAA, PCI-DSS, GDPR on GCP)' },
            ],
          },
        ],
      },
      {
        name: 'Analyzing and Optimizing Technical and Business Processes',
        weight: 17,
        topics: [
          { name: 'Analyzing and defining technical processes' },
          { name: 'Analyzing and defining business processes' },
          { name: 'Cost optimization and performance tuning' },
        ],
        chapters: [
          {
            name: 'Process Optimization',
            topics: [
              { name: 'CI/CD pipeline design with Cloud Build' },
              { name: 'Development and testing best practices' },
              { name: 'Business continuity and disaster recovery planning' },
            ],
          },
          {
            name: 'Cost and Performance',
            topics: [
              { name: 'Rightsizing recommendations and committed use discounts' },
              { name: 'Performance monitoring and bottleneck analysis' },
              { name: 'TCO analysis and cloud economics' },
            ],
          },
        ],
      },
      {
        name: 'Managing Implementation',
        weight: 12,
        topics: [
          { name: 'Advising development and operations teams' },
          { name: 'Interacting with Google Cloud programmatically' },
          { name: 'Managing infrastructure as code' },
        ],
        chapters: [
          {
            name: 'Implementation Management',
            topics: [
              { name: 'Terraform and Deployment Manager for IaC' },
              { name: 'Cloud Build and Artifact Registry pipelines' },
              { name: 'API design and management with Apigee' },
            ],
          },
        ],
      },
      {
        name: 'Ensuring Solution and Operations Reliability',
        weight: 13,
        topics: [
          { name: 'Monitoring and logging' },
          { name: 'Deploying for reliability' },
          { name: 'SRE principles applied to Google Cloud' },
        ],
        chapters: [
          {
            name: 'Reliability Engineering',
            topics: [
              { name: 'SLI, SLO, SLA design and error budgets' },
              { name: 'Cloud Monitoring alerting and uptime checks' },
              { name: 'Incident response and post-mortem processes' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Professional Cloud Architect exam is one of the most popular cloud certifications. It tests your ability to design, develop, and manage robust, secure, scalable solutions. The exam includes 2 case studies (published in advance) that account for ~20-30% of questions. Study the case studies thoroughly before exam day.',
      totalDuration: 120,
      passingScore: 70,
      tips: [
        'Read and memorize the 2 published case studies — they appear verbatim on the exam',
        'Focus on architectural trade-offs: cost vs performance, availability vs complexity',
        'Know hybrid/multi-cloud patterns with Anthos, Cloud Interconnect, and VPN',
        'Understand when to choose managed vs self-managed services',
        'Security architecture (IAP, VPC-SC, CMEK) is heavily tested',
        'Practice eliminating wrong answers — many questions have 2 plausible options',
      ],
    },

    questionStyle: 'Scenario-based architecture questions testing real-world design decisions. Includes 2 case studies describing fictional companies with specific technical and business requirements — questions ask you to recommend solutions for those companies. Tests ability to balance cost, security, reliability, and performance.',
  },

  // ─── 4. Professional Data Engineer ───────────────────────────────
  {
    id: 'gcp-professional-data-engineer',
    vendor: 'Google Cloud',
    certName: 'Professional Data Engineer',
    certCode: 'Professional Data Engineer',
    aliases: [
      /\bprofessional\s*data\s*engineer\b/i,
      /\bgcp\b.*\bdata\s*engineer\b/i,
      /\bgoogle\s*cloud\b.*\bdata\s*engineer\b/i,
      /\bpde\b.*\bgcp\b/i,
      /\bgcp\b.*\bpde\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 55,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'Professional Data Engineer Exam',
        description: 'MCQ and multiple-select questions on designing and building data processing systems (updated Jan 2026)',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Design Data Processing Systems',
        weight: 22,
        topics: [
          { name: 'Designing for reliability and scalability' },
          { name: 'Designing data processing pipelines' },
          { name: 'Selecting storage technologies' },
        ],
        chapters: [
          {
            name: 'Pipeline Architecture',
            topics: [
              { name: 'Batch vs streaming architecture decisions' },
              { name: 'Dataflow (Apache Beam) pipeline design' },
              { name: 'Pub/Sub for event-driven architectures' },
            ],
          },
          {
            name: 'Data Architecture',
            topics: [
              { name: 'Data lake vs data warehouse vs lakehouse patterns' },
              { name: 'Schema design for BigQuery and Bigtable' },
              { name: 'Partitioning and clustering strategies' },
            ],
          },
        ],
      },
      {
        name: 'Ingest and Process Data',
        weight: 25,
        topics: [
          { name: 'Planning data ingestion' },
          { name: 'Building batch and streaming data pipelines' },
          { name: 'Data transformation and enrichment' },
        ],
        chapters: [
          {
            name: 'Data Ingestion',
            topics: [
              { name: 'Batch loading into BigQuery (bq load, Transfer Service, Storage Write API)' },
              { name: 'Streaming ingestion with Pub/Sub and Dataflow' },
              { name: 'Change data capture and replication patterns' },
            ],
          },
          {
            name: 'Data Processing',
            topics: [
              { name: 'Dataflow windowing, triggers, and watermarks' },
              { name: 'Dataproc (managed Spark/Hadoop) for batch processing' },
              { name: 'Cloud Composer (Airflow) for workflow orchestration' },
            ],
          },
        ],
      },
      {
        name: 'Store Data',
        weight: 20,
        topics: [
          { name: 'Selecting storage systems for different use cases' },
          { name: 'Managing and optimizing data storage' },
          { name: 'Data modeling for analytics' },
        ],
        chapters: [
          {
            name: 'Storage Selection',
            topics: [
              { name: 'BigQuery for analytics, Bigtable for time-series and IoT' },
              { name: 'Cloud Spanner for globally consistent RDBMS' },
              { name: 'Cloud Storage for unstructured data and data lakes' },
            ],
          },
          {
            name: 'Storage Optimization',
            topics: [
              { name: 'BigQuery slot management and reservation models' },
              { name: 'Data lifecycle management and retention policies' },
              { name: 'Cost optimization across storage tiers' },
            ],
          },
        ],
      },
      {
        name: 'Prepare and Use Data for Analysis',
        weight: 18,
        topics: [
          { name: 'Preparing data for visualization and reporting' },
          { name: 'Exploring and sharing data' },
          { name: 'Machine learning data preparation' },
        ],
        chapters: [
          {
            name: 'Data Preparation',
            topics: [
              { name: 'Data quality, cleansing, and validation techniques' },
              { name: 'BigQuery ML for in-warehouse machine learning' },
              { name: 'Looker and Looker Studio for analytics and dashboards' },
            ],
          },
          {
            name: 'Data Sharing',
            topics: [
              { name: 'Analytics Hub for data sharing across organizations' },
              { name: 'Authorized views and dataset sharing in BigQuery' },
              { name: 'Dataplex for data governance and cataloging' },
            ],
          },
        ],
      },
      {
        name: 'Maintain and Automate Data Workloads',
        weight: 15,
        topics: [
          { name: 'Monitoring and troubleshooting data pipelines' },
          { name: 'Automating data processing workflows' },
          { name: 'Data security and compliance' },
        ],
        chapters: [
          {
            name: 'Operations and Automation',
            topics: [
              { name: 'Cloud Composer DAG management and scheduling' },
              { name: 'Dataflow monitoring, autoscaling, and error handling' },
              { name: 'Data lineage and audit logging' },
            ],
          },
          {
            name: 'Data Security',
            topics: [
              { name: 'Column-level and row-level security in BigQuery' },
              { name: 'Data Loss Prevention (DLP) API for PII detection' },
              { name: 'Encryption and access controls for data at rest and in transit' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'Updated January 2026, the Professional Data Engineer exam validates ability to design, build, and operationalize data processing systems on Google Cloud. Heavy emphasis on BigQuery, Dataflow, and data pipeline architecture. Real-world scenario questions dominate.',
      totalDuration: 120,
      passingScore: 70,
      tips: [
        'BigQuery is the #1 tested service — know partitioning, clustering, materialized views, and BI Engine',
        'Understand Dataflow deeply: windowing strategies, exactly-once processing, and autoscaling',
        'Know when to use Dataflow vs Dataproc vs BigQuery for data processing tasks',
        'Cloud Composer (Airflow) orchestration patterns appear frequently',
        'Data security (DLP, column-level security, VPC-SC) is increasingly important',
      ],
    },

    questionStyle: 'Scenario-based questions presenting data engineering challenges (ingestion, transformation, storage, analysis) and asking you to select the optimal Google Cloud service or architecture. Tests deep understanding of trade-offs between batch and streaming, cost and performance, and managed vs custom solutions.',
  },

  // ─── 5. Professional Machine Learning Engineer ───────────────────
  {
    id: 'gcp-professional-ml-engineer',
    vendor: 'Google Cloud',
    certName: 'Professional Machine Learning Engineer',
    certCode: 'Professional ML Engineer',
    aliases: [
      /\bprofessional\s*ml\s*engineer\b/i,
      /\bprofessional\s*machine\s*learning\s*engineer\b/i,
      /\bgcp\b.*\bml\s*engineer\b/i,
      /\bgoogle\s*cloud\b.*\bml\s*engineer\b/i,
      /\bgoogle\s*cloud\b.*\bmachine\s*learning\b/i,
      /\bpmle\b.*\bgcp\b/i,
      /\bgcp\b.*\bpmle\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 55,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'Professional ML Engineer Exam',
        description: 'MCQ and multiple-select questions on ML/AI solution design, now including GenAI and Vertex AI',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Architect Low-Code AI Solutions',
        weight: 15,
        topics: [
          { name: 'AutoML and pre-trained API selection' },
          { name: 'Vertex AI Search and Conversation' },
          { name: 'Generative AI Studio and foundation models' },
        ],
        chapters: [
          {
            name: 'Low-Code ML',
            topics: [
              { name: 'AutoML for tabular, image, text, and video data' },
              { name: 'Pre-trained APIs (Vision, NLP, Translation, Speech)' },
              { name: 'Document AI and Contact Center AI' },
            ],
          },
          {
            name: 'Generative AI on Vertex',
            topics: [
              { name: 'Vertex AI Studio for prompt engineering' },
              { name: 'Foundation model selection and tuning' },
              { name: 'Grounding and retrieval augmented generation (RAG)' },
            ],
          },
        ],
      },
      {
        name: 'Manage Data and Models',
        weight: 20,
        topics: [
          { name: 'Data management for ML workloads' },
          { name: 'Feature engineering and feature stores' },
          { name: 'Model versioning and metadata management' },
        ],
        chapters: [
          {
            name: 'Data for ML',
            topics: [
              { name: 'Vertex AI Feature Store for feature management' },
              { name: 'Data labeling and annotation strategies' },
              { name: 'Handling imbalanced datasets and data augmentation' },
            ],
          },
          {
            name: 'Model Management',
            topics: [
              { name: 'Vertex AI Model Registry for versioning' },
              { name: 'Experiment tracking and ML metadata' },
              { name: 'Data and model lineage' },
            ],
          },
        ],
      },
      {
        name: 'Scale Prototypes into ML Models',
        weight: 18,
        topics: [
          { name: 'Building ML models with Vertex AI' },
          { name: 'Training at scale with custom containers' },
          { name: 'Hyperparameter tuning and model selection' },
        ],
        chapters: [
          {
            name: 'Model Development',
            topics: [
              { name: 'Vertex AI Training with custom containers' },
              { name: 'Distributed training strategies (data parallelism, model parallelism)' },
              { name: 'Hyperparameter tuning with Vertex AI Vizier' },
            ],
          },
          {
            name: 'Model Evaluation',
            topics: [
              { name: 'Evaluation metrics selection (precision, recall, AUC, BLEU, ROUGE)' },
              { name: 'Model explainability (Vertex Explainable AI, SHAP, LIME)' },
              { name: 'Bias detection and fairness metrics' },
            ],
          },
        ],
      },
      {
        name: 'Serve and Scale Models',
        weight: 17,
        topics: [
          { name: 'Deploying models to Vertex AI endpoints' },
          { name: 'Online and batch prediction patterns' },
          { name: 'Model optimization for serving' },
        ],
        chapters: [
          {
            name: 'Model Serving',
            topics: [
              { name: 'Vertex AI Prediction (online, batch, private endpoints)' },
              { name: 'Model optimization (quantization, distillation, pruning)' },
              { name: 'Autoscaling and GPU/TPU selection for inference' },
            ],
          },
          {
            name: 'Serving Architecture',
            topics: [
              { name: 'A/B testing and canary deployments for models' },
              { name: 'Edge deployment with Vertex AI' },
              { name: 'Latency optimization and caching strategies' },
            ],
          },
        ],
      },
      {
        name: 'Automate and Orchestrate ML Pipelines',
        weight: 15,
        topics: [
          { name: 'Building Vertex AI Pipelines (Kubeflow)' },
          { name: 'Continuous training and CI/CD for ML' },
          { name: 'Pipeline scheduling and triggering' },
        ],
        chapters: [
          {
            name: 'MLOps Pipelines',
            topics: [
              { name: 'Vertex AI Pipelines with Kubeflow Pipelines SDK' },
              { name: 'CI/CD for ML: automated retraining triggers' },
              { name: 'TFX pipeline components and orchestration' },
            ],
          },
        ],
      },
      {
        name: 'Monitor AI Solutions',
        weight: 15,
        topics: [
          { name: 'Model monitoring for data and prediction drift' },
          { name: 'Responsible AI and governance' },
          { name: 'Debugging and troubleshooting ML systems' },
        ],
        chapters: [
          {
            name: 'Monitoring and Governance',
            topics: [
              { name: 'Vertex AI Model Monitoring for skew and drift detection' },
              { name: 'Feature attribution drift and prediction anomaly detection' },
              { name: 'Responsible AI principles: fairness, privacy, safety, transparency' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Professional ML Engineer exam now includes significant GenAI/Vertex AI content. It tests end-to-end ML lifecycle: from data preparation through model deployment and monitoring. Expect questions on both traditional ML and generative AI approaches on Google Cloud.',
      totalDuration: 120,
      passingScore: 70,
      tips: [
        'Vertex AI is central — know Training, Prediction, Pipelines, Feature Store, and Model Monitoring',
        'GenAI content is new: study Vertex AI Studio, foundation model tuning, and RAG patterns',
        'Understand MLOps maturity levels and when to automate vs manual ML workflows',
        'Know evaluation metrics for different ML tasks (classification, regression, NLP, GenAI)',
        'Responsible AI and bias mitigation questions are increasingly common',
      ],
    },

    questionStyle: 'Scenario-based questions on designing, building, and deploying ML/AI solutions on Google Cloud. Questions present ML challenges and ask you to select the appropriate Vertex AI service, training strategy, or deployment pattern. Now includes generative AI scenarios with foundation models and prompt engineering.',
  },

  // ─── 6. Professional Cloud Developer ─────────────────────────────
  {
    id: 'gcp-professional-cloud-developer',
    vendor: 'Google Cloud',
    certName: 'Professional Cloud Developer',
    certCode: 'Professional Cloud Developer',
    aliases: [
      /\bprofessional\s*cloud\s*developer\b/i,
      /\bgcp\b.*\bcloud\s*developer\b/i,
      /\bgoogle\s*cloud\b.*\bdeveloper\b/i,
      /\bpcd\b.*\bgcp\b/i,
      /\bgcp\b.*\bpcd\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 55,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'Professional Cloud Developer Exam',
        description: 'MCQ and multiple-select questions on designing and building cloud-native applications',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Designing Scalable, Available, and Reliable Applications',
        weight: 20,
        topics: [
          { name: 'Designing high-performance applications' },
          { name: 'Designing secure applications' },
          { name: 'Managing application data' },
        ],
        chapters: [
          {
            name: 'Application Architecture',
            topics: [
              { name: 'Microservices vs monolith trade-offs' },
              { name: 'Event-driven architecture with Pub/Sub and Eventarc' },
              { name: '12-factor app principles on Google Cloud' },
            ],
          },
          {
            name: 'Resilience Patterns',
            topics: [
              { name: 'Circuit breaker, retry, and backoff patterns' },
              { name: 'Caching strategies (Memorystore for Redis)' },
              { name: 'Multi-region deployment for high availability' },
            ],
          },
        ],
      },
      {
        name: 'Building and Testing Applications',
        weight: 25,
        topics: [
          { name: 'Setting up development environments' },
          { name: 'Building cloud-native applications' },
          { name: 'Testing strategies (unit, integration, load)' },
        ],
        chapters: [
          {
            name: 'Development',
            topics: [
              { name: 'Cloud Code IDE extensions and Cloud Workstations' },
              { name: 'Container image building with Cloud Build and Buildpacks' },
              { name: 'Local development with emulators (Firestore, Pub/Sub, Spanner)' },
            ],
          },
          {
            name: 'Testing',
            topics: [
              { name: 'Unit and integration testing with Cloud SDK test utilities' },
              { name: 'Load testing with Cloud Run and Cloud Tasks' },
              { name: 'Contract testing for microservices' },
            ],
          },
        ],
      },
      {
        name: 'Deploying Applications',
        weight: 20,
        topics: [
          { name: 'Deploying to compute platforms' },
          { name: 'Implementing CI/CD pipelines' },
          { name: 'Managing application releases' },
        ],
        chapters: [
          {
            name: 'Deployment Strategies',
            topics: [
              { name: 'Cloud Run, GKE, and App Engine deployment patterns' },
              { name: 'Blue-green, canary, and rolling deployments' },
              { name: 'Cloud Build triggers and Artifact Registry management' },
            ],
          },
          {
            name: 'Release Management',
            topics: [
              { name: 'Cloud Deploy for continuous delivery pipelines' },
              { name: 'Feature flags and traffic splitting' },
              { name: 'Rollback strategies and version management' },
            ],
          },
        ],
      },
      {
        name: 'Integrating Google Cloud Services',
        weight: 20,
        topics: [
          { name: 'Integrating data and storage services' },
          { name: 'Integrating compute services' },
          { name: 'Using Google Cloud APIs and client libraries' },
        ],
        chapters: [
          {
            name: 'Service Integration',
            topics: [
              { name: 'Pub/Sub, Cloud Tasks, and Cloud Scheduler for async processing' },
              { name: 'Secret Manager for configuration and credentials' },
              { name: 'Cloud Endpoints and API Gateway for API management' },
            ],
          },
          {
            name: 'Data Integration',
            topics: [
              { name: 'Firestore, Cloud SQL, and Spanner client library usage' },
              { name: 'Cloud Storage signed URLs and event notifications' },
              { name: 'Identity Platform and Firebase Authentication integration' },
            ],
          },
        ],
      },
      {
        name: 'Managing Application Performance',
        weight: 15,
        topics: [
          { name: 'Managing compute resources' },
          { name: 'Application performance monitoring' },
          { name: 'Debugging and profiling applications' },
        ],
        chapters: [
          {
            name: 'Performance Management',
            topics: [
              { name: 'Cloud Trace for latency analysis' },
              { name: 'Cloud Profiler for CPU and memory optimization' },
              { name: 'Error Reporting and Cloud Debugger' },
            ],
          },
          {
            name: 'Resource Optimization',
            topics: [
              { name: 'Autoscaling configuration for Cloud Run and GKE' },
              { name: 'Cold start optimization strategies' },
              { name: 'Resource quotas and limits management' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Professional Cloud Developer exam tests your ability to build scalable, cloud-native applications on Google Cloud. Strong emphasis on Cloud Run, GKE, Pub/Sub, and CI/CD with Cloud Build. Requires hands-on development experience with Google Cloud services and client libraries.',
      totalDuration: 120,
      passingScore: 70,
      tips: [
        'Cloud Run is the most tested compute service — know concurrency, cold starts, and traffic management',
        'Understand Pub/Sub deeply: exactly-once delivery, dead letter topics, and ordering keys',
        'CI/CD with Cloud Build and Cloud Deploy appears frequently',
        'Know when to use Cloud Tasks vs Pub/Sub vs Cloud Scheduler for async patterns',
        'Secret Manager and Identity Platform integration questions are common',
      ],
    },

    questionStyle: 'Scenario-based questions focused on application development decisions. Presents coding and architecture scenarios asking you to choose the best Google Cloud service, design pattern, or implementation approach. Tests practical development knowledge rather than theoretical concepts.',
  },

  // ─── 7. Professional Cloud DevOps Engineer ───────────────────────
  {
    id: 'gcp-professional-devops-engineer',
    vendor: 'Google Cloud',
    certName: 'Professional Cloud DevOps Engineer',
    certCode: 'Professional Cloud DevOps Engineer',
    aliases: [
      /\bprofessional\s*cloud\s*devops\s*engineer\b/i,
      /\bgcp\b.*\bdevops\s*engineer\b/i,
      /\bgoogle\s*cloud\b.*\bdevops\b/i,
      /\bpcde\b.*\bgcp\b/i,
      /\bgcp\b.*\bpcde\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 55,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'Professional Cloud DevOps Engineer Exam',
        description: 'MCQ and multiple-select questions on SRE principles, CI/CD, and operations on Google Cloud',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Bootstrapping a Google Cloud Organization',
        weight: 15,
        topics: [
          { name: 'Designing the resource hierarchy' },
          { name: 'Managing infrastructure as code' },
          { name: 'Designing a CI/CD architecture' },
        ],
        chapters: [
          {
            name: 'Organization Bootstrap',
            topics: [
              { name: 'Resource hierarchy design (org, folders, projects)' },
              { name: 'Terraform for GCP infrastructure provisioning' },
              { name: 'Landing zone design and project factory patterns' },
            ],
          },
        ],
      },
      {
        name: 'Building and Implementing CI/CD Pipelines',
        weight: 25,
        topics: [
          { name: 'Designing CI/CD pipelines' },
          { name: 'Implementing CI with Cloud Build' },
          { name: 'Implementing CD with Cloud Deploy' },
        ],
        chapters: [
          {
            name: 'CI/CD Architecture',
            topics: [
              { name: 'Cloud Build configuration and triggers' },
              { name: 'Cloud Deploy delivery pipelines and targets' },
              { name: 'Artifact Registry for container and package management' },
            ],
          },
          {
            name: 'Deployment Strategies',
            topics: [
              { name: 'Canary, blue-green, and rolling deployment patterns' },
              { name: 'Binary Authorization for supply chain security' },
              { name: 'GitOps patterns with Config Sync and Anthos Config Management' },
            ],
          },
        ],
      },
      {
        name: 'Applying Site Reliability Engineering Practices',
        weight: 25,
        topics: [
          { name: 'Defining SLIs, SLOs, and SLAs' },
          { name: 'Managing error budgets' },
          { name: 'Implementing reliability practices' },
        ],
        chapters: [
          {
            name: 'SRE Fundamentals',
            topics: [
              { name: 'SLI selection (latency, availability, throughput, correctness)' },
              { name: 'SLO definition and error budget policies' },
              { name: 'Toil reduction and automation strategies' },
            ],
          },
          {
            name: 'Reliability Implementation',
            topics: [
              { name: 'Chaos engineering and game days on GCP' },
              { name: 'Capacity planning and load testing' },
              { name: 'Progressive rollouts and feature flags' },
            ],
          },
        ],
      },
      {
        name: 'Implementing Service Monitoring Strategies',
        weight: 20,
        topics: [
          { name: 'Managing Cloud Monitoring' },
          { name: 'Managing Cloud Logging' },
          { name: 'Implementing observability' },
        ],
        chapters: [
          {
            name: 'Monitoring and Observability',
            topics: [
              { name: 'Cloud Monitoring dashboards, alerts, and uptime checks' },
              { name: 'Cloud Logging filters, sinks, and log-based metrics' },
              { name: 'Cloud Trace, Profiler, and distributed tracing' },
            ],
          },
          {
            name: 'Advanced Monitoring',
            topics: [
              { name: 'SLO monitoring with Service Monitoring' },
              { name: 'Custom metrics and OpenTelemetry integration' },
              { name: 'Monitoring multi-cloud and hybrid environments' },
            ],
          },
        ],
      },
      {
        name: 'Optimizing Service Performance',
        weight: 15,
        topics: [
          { name: 'Managing incidents and postmortems' },
          { name: 'Optimizing service operations' },
          { name: 'Implementing on-call and escalation procedures' },
        ],
        chapters: [
          {
            name: 'Incident Management',
            topics: [
              { name: 'Incident response procedures and escalation paths' },
              { name: 'Blameless postmortem culture and action items' },
              { name: 'On-call rotation design and alert fatigue reduction' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Professional Cloud DevOps Engineer exam is heavily influenced by Google SRE practices. It tests CI/CD pipeline design, SLI/SLO/SLA management, incident response, and operational excellence on Google Cloud. Strong alignment with the Google SRE book.',
      totalDuration: 120,
      passingScore: 70,
      tips: [
        'Read the Google SRE book chapters on SLIs, SLOs, error budgets, and toil — they are directly tested',
        'Cloud Build and Cloud Deploy are the primary CI/CD tools — know them deeply',
        'Understand Binary Authorization and supply chain security',
        'SLI/SLO questions are the most common — know how to select appropriate SLIs for different service types',
        'Incident management and blameless postmortems are frequently tested',
      ],
    },

    questionStyle: 'Scenario-based questions on DevOps and SRE practices applied to Google Cloud. Questions present operational challenges and ask you to choose the best approach for CI/CD, monitoring, incident response, or reliability improvement. Strong emphasis on Google SRE philosophy.',
  },

  // ─── 8. Professional Cloud Security Engineer ─────────────────────
  {
    id: 'gcp-professional-security-engineer',
    vendor: 'Google Cloud',
    certName: 'Professional Cloud Security Engineer',
    certCode: 'Professional Cloud Security Engineer',
    aliases: [
      /\bprofessional\s*cloud\s*security\s*engineer\b/i,
      /\bgcp\b.*\bsecurity\s*engineer\b/i,
      /\bgoogle\s*cloud\b.*\bsecurity\s*engineer\b/i,
      /\bpcse\b.*\bgcp\b/i,
      /\bgcp\b.*\bpcse\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 55,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'Professional Cloud Security Engineer Exam',
        description: 'MCQ and multiple-select questions on securing Google Cloud infrastructure and data',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Configuring Access Within a Cloud Solution',
        weight: 20,
        topics: [
          { name: 'Managing Cloud Identity and IAM' },
          { name: 'Managing service accounts' },
          { name: 'Managing authentication and authorization' },
        ],
        chapters: [
          {
            name: 'Identity and Access',
            topics: [
              { name: 'Cloud Identity, Google Workspace, and external IdP federation' },
              { name: 'IAM roles, conditions, and policy troubleshooting' },
              { name: 'Workforce Identity Federation and Workload Identity' },
            ],
          },
          {
            name: 'Service Account Security',
            topics: [
              { name: 'Service account best practices and least privilege' },
              { name: 'Service account key management and impersonation' },
              { name: 'Workload Identity for GKE workloads' },
            ],
          },
        ],
      },
      {
        name: 'Managing Operations Within a Cloud Solution',
        weight: 18,
        topics: [
          { name: 'Managing security operations' },
          { name: 'Using security tools' },
          { name: 'Managing security incident response' },
        ],
        chapters: [
          {
            name: 'Security Operations',
            topics: [
              { name: 'Security Command Center (Standard and Premium tiers)' },
              { name: 'Cloud Audit Logs configuration and analysis' },
              { name: 'Chronicle SIEM and SOAR integration' },
            ],
          },
          {
            name: 'Vulnerability Management',
            topics: [
              { name: 'Container Analysis and vulnerability scanning' },
              { name: 'Web Security Scanner for App Engine and Cloud Run' },
              { name: 'Security Health Analytics and compliance monitoring' },
            ],
          },
        ],
      },
      {
        name: 'Configuring Network Security',
        weight: 22,
        topics: [
          { name: 'Designing network security' },
          { name: 'Configuring network perimeter security' },
          { name: 'Implementing private connectivity' },
        ],
        chapters: [
          {
            name: 'Network Perimeter',
            topics: [
              { name: 'Cloud Armor for DDoS protection and WAF rules' },
              { name: 'Cloud IDS (Intrusion Detection System)' },
              { name: 'Firewall policies (hierarchical, VPC, and tags)' },
            ],
          },
          {
            name: 'Private Networking',
            topics: [
              { name: 'Private Google Access and Private Service Connect' },
              { name: 'VPC Service Controls for data exfiltration prevention' },
              { name: 'Cloud NAT and secure egress patterns' },
            ],
          },
        ],
      },
      {
        name: 'Ensuring Data Protection',
        weight: 22,
        topics: [
          { name: 'Managing encryption keys' },
          { name: 'Protecting sensitive data' },
          { name: 'Managing data access and sharing' },
        ],
        chapters: [
          {
            name: 'Encryption',
            topics: [
              { name: 'Google-managed, CMEK, and CSEK encryption' },
              { name: 'Cloud KMS and Cloud HSM key management' },
              { name: 'Cloud EKM for external key management' },
            ],
          },
          {
            name: 'Data Protection',
            topics: [
              { name: 'Data Loss Prevention (DLP) API for PII detection and de-identification' },
              { name: 'Secret Manager for secrets lifecycle management' },
              { name: 'Confidential Computing for data in use' },
            ],
          },
        ],
      },
      {
        name: 'Managing Compliance',
        weight: 18,
        topics: [
          { name: 'Determining regulatory requirements' },
          { name: 'Managing compliance obligations' },
          { name: 'Implementing security controls' },
        ],
        chapters: [
          {
            name: 'Compliance Frameworks',
            topics: [
              { name: 'Assured Workloads for regulated environments' },
              { name: 'Compliance reports and certifications (SOC, ISO, FedRAMP)' },
              { name: 'Data residency and sovereignty controls' },
            ],
          },
          {
            name: 'Governance',
            topics: [
              { name: 'Organization policies and constraints' },
              { name: 'Resource location restrictions' },
              { name: 'Access Transparency and Access Approval' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Professional Cloud Security Engineer exam validates ability to design and implement secure infrastructure on Google Cloud. Heavy emphasis on IAM, VPC Service Controls, encryption, and Security Command Center. Requires understanding of zero-trust architecture and defense-in-depth principles.',
      totalDuration: 120,
      passingScore: 70,
      tips: [
        'VPC Service Controls is the most complex and heavily tested topic — study it thoroughly',
        'Know IAM deeply: conditions, deny policies, Workload Identity, and policy troubleshooting',
        'Understand all encryption options: Google-managed, CMEK, CSEK, Cloud HSM, Cloud EKM',
        'Security Command Center (Premium) features and findings are frequently tested',
        'Cloud Armor WAF rules and DDoS protection scenarios appear regularly',
      ],
    },

    questionStyle: 'Scenario-based questions presenting security challenges and asking you to select the most secure and compliant solution. Tests deep understanding of Google Cloud security services, defense-in-depth strategies, and zero-trust architecture. Questions often involve multiple valid approaches — you must identify the MOST appropriate one.',
  },
]
