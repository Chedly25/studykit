/**
 * Microsoft Azure certification catalog.
 * 15 active Azure certifications as of April 2026.
 */
import type { CertificationEntry } from './types'

export const AZURE_CERTS: CertificationEntry[] = [
  // ─── AZ-900 — Azure Fundamentals ────────────────────────────────
  {
    id: 'azure-az-900',
    vendor: 'Microsoft',
    certName: 'Azure Fundamentals',
    certCode: 'AZ-900',
    aliases: [
      /\baz[\s-]?900\b/i,
      /azure\s*fundamentals/i,
      /\bazure\s*fundamentals/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 45,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format Azure fundamentals exam covering cloud concepts, core services, and governance.',
        timeAllocation: 45,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Cloud Concepts',
        weight: 28,
        chapters: [
          {
            name: 'Cloud Computing Benefits',
            topics: [
              { name: 'High availability and scalability' },
              { name: 'Reliability and predictability' },
              { name: 'Security and governance' },
              { name: 'Manageability in the cloud' },
            ],
          },
          {
            name: 'Cloud Service Types',
            topics: [
              { name: 'IaaS, PaaS, SaaS' },
              { name: 'Shared responsibility model' },
              { name: 'Use cases for each service type' },
            ],
          },
          {
            name: 'Cloud Models',
            topics: [
              { name: 'Public, private, and hybrid cloud' },
              { name: 'Multi-cloud strategies' },
              { name: 'Azure Arc' },
            ],
          },
        ],
        topics: [
          { name: 'High availability and scalability' },
          { name: 'IaaS, PaaS, SaaS' },
          { name: 'Public, private, and hybrid cloud' },
          { name: 'Shared responsibility model' },
        ],
      },
      {
        name: 'Azure Architecture and Services',
        weight: 37,
        chapters: [
          {
            name: 'Core Architectural Components',
            topics: [
              { name: 'Azure regions and availability zones' },
              { name: 'Resource groups and subscriptions' },
              { name: 'Management groups and hierarchy' },
            ],
          },
          {
            name: 'Compute and Networking',
            topics: [
              { name: 'Azure Virtual Machines' },
              { name: 'Azure App Service' },
              { name: 'Azure Container Instances and AKS' },
              { name: 'Azure Functions' },
              { name: 'Azure Virtual Network and subnets' },
              { name: 'VPN Gateway and ExpressRoute' },
              { name: 'Azure DNS' },
            ],
          },
          {
            name: 'Storage Services',
            topics: [
              { name: 'Azure Storage accounts' },
              { name: 'Blob, File, Queue, Table storage' },
              { name: 'Storage redundancy options' },
            ],
          },
          {
            name: 'Identity, Access, and Security',
            topics: [
              { name: 'Microsoft Entra ID (Azure AD)' },
              { name: 'Authentication methods and MFA' },
              { name: 'Conditional Access' },
              { name: 'Azure RBAC' },
              { name: 'Zero Trust and defense in depth' },
            ],
          },
        ],
        topics: [
          { name: 'Azure regions and availability zones' },
          { name: 'Azure Virtual Machines and App Service' },
          { name: 'Azure Storage accounts' },
          { name: 'Microsoft Entra ID' },
        ],
      },
      {
        name: 'Azure Management and Governance',
        weight: 35,
        chapters: [
          {
            name: 'Cost Management',
            topics: [
              { name: 'Factors affecting cost' },
              { name: 'Pricing calculator and TCO calculator' },
              { name: 'Azure Cost Management and billing' },
              { name: 'Resource tags for cost tracking' },
            ],
          },
          {
            name: 'Governance and Compliance',
            topics: [
              { name: 'Azure Policy' },
              { name: 'Resource locks' },
              { name: 'Azure Blueprints' },
              { name: 'Service Trust Portal' },
            ],
          },
          {
            name: 'Management and Deployment Tools',
            topics: [
              { name: 'Azure Portal, CLI, PowerShell' },
              { name: 'Azure Cloud Shell' },
              { name: 'ARM templates and Bicep' },
              { name: 'Azure Advisor and Service Health' },
              { name: 'Azure Monitor' },
            ],
          },
        ],
        topics: [
          { name: 'Azure Cost Management' },
          { name: 'Azure Policy and governance' },
          { name: 'ARM templates and Bicep' },
          { name: 'Azure Monitor and Advisor' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AZ-900 is an entry-level exam covering fundamental cloud concepts, core Azure services, and Azure management/governance. It is ideal for non-technical and technical professionals beginning their Azure journey.',
      totalDuration: 45,
      passingScore: 700,
      tips: [
        'Understand the shared responsibility model and how it differs across IaaS, PaaS, and SaaS.',
        'Know the difference between Azure regions, availability zones, and region pairs.',
        'Be comfortable with Azure cost management tools: pricing calculator, TCO calculator, Cost Management.',
        'Review Azure governance features: Policy, Blueprints, resource locks, management groups.',
        'Familiarize yourself with Microsoft Entra ID (formerly Azure AD) basics.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop ordering, and hot area (select region on image). Questions test conceptual understanding of cloud fundamentals and Azure service selection. No lab simulations.',
  },

  // ─── AZ-104 — Azure Administrator ───────────────────────────────
  {
    id: 'azure-az-104',
    vendor: 'Microsoft',
    certName: 'Azure Administrator',
    certCode: 'AZ-104',
    aliases: [
      /\baz[\s-]?104\b/i,
      /azure\s*administrator/i,
      /azure\s*admin$/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 100,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies, lab simulations',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam testing Azure administration skills across identity, networking, compute, and storage.',
        timeAllocation: 100,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Manage Azure Identities and Governance',
        weight: 22,
        chapters: [
          {
            name: 'Azure Active Directory',
            topics: [
              { name: 'Users and groups management' },
              { name: 'Administrative units' },
              { name: 'Microsoft Entra ID roles' },
            ],
          },
          {
            name: 'Role-Based Access Control',
            topics: [
              { name: 'Custom RBAC roles' },
              { name: 'Role assignments and scope' },
              { name: 'Conditional Access policies' },
            ],
          },
          {
            name: 'Governance',
            topics: [
              { name: 'Azure Policy creation and assignment' },
              { name: 'Resource locks and tags' },
              { name: 'Management groups and subscriptions' },
              { name: 'Azure Blueprints' },
            ],
          },
        ],
        topics: [
          { name: 'Microsoft Entra ID users and groups' },
          { name: 'RBAC and Conditional Access' },
          { name: 'Azure Policy and governance' },
        ],
      },
      {
        name: 'Implement and Manage Storage',
        weight: 18,
        chapters: [
          {
            name: 'Storage Accounts',
            topics: [
              { name: 'Storage account configuration' },
              { name: 'Blob storage and access tiers' },
              { name: 'Azure Files and File Sync' },
              { name: 'Storage redundancy (LRS, GRS, ZRS, GZRS)' },
            ],
          },
          {
            name: 'Storage Security',
            topics: [
              { name: 'Shared access signatures (SAS)' },
              { name: 'Storage access keys and rotation' },
              { name: 'Azure Storage encryption' },
              { name: 'Stored access policies' },
            ],
          },
        ],
        topics: [
          { name: 'Blob storage and access tiers' },
          { name: 'Azure Files and File Sync' },
          { name: 'SAS tokens and access keys' },
        ],
      },
      {
        name: 'Deploy and Manage Azure Compute Resources',
        weight: 22,
        chapters: [
          {
            name: 'Virtual Machines',
            topics: [
              { name: 'VM creation and configuration' },
              { name: 'VM availability sets and scale sets' },
              { name: 'Azure Disk Encryption' },
              { name: 'VM extensions' },
            ],
          },
          {
            name: 'Containers and App Service',
            topics: [
              { name: 'Azure Container Instances' },
              { name: 'Azure Kubernetes Service (AKS)' },
              { name: 'Azure App Service plans and deployment' },
              { name: 'Deployment slots' },
            ],
          },
          {
            name: 'ARM Templates',
            topics: [
              { name: 'ARM template syntax and deployment' },
              { name: 'Bicep files' },
              { name: 'Template parameters and variables' },
            ],
          },
        ],
        topics: [
          { name: 'Virtual Machine management' },
          { name: 'Container services (ACI, AKS)' },
          { name: 'ARM templates and Bicep' },
        ],
      },
      {
        name: 'Implement and Manage Virtual Networking',
        weight: 18,
        chapters: [
          {
            name: 'Virtual Networks',
            topics: [
              { name: 'VNet creation and configuration' },
              { name: 'Subnets and IP addressing' },
              { name: 'VNet peering' },
              { name: 'Azure DNS and private DNS zones' },
            ],
          },
          {
            name: 'Network Security',
            topics: [
              { name: 'Network Security Groups (NSGs)' },
              { name: 'Application Security Groups' },
              { name: 'Azure Firewall' },
              { name: 'Service endpoints and Private Link' },
            ],
          },
          {
            name: 'Load Balancing',
            topics: [
              { name: 'Azure Load Balancer' },
              { name: 'Application Gateway' },
              { name: 'VPN Gateway and ExpressRoute' },
            ],
          },
        ],
        topics: [
          { name: 'VNet configuration and peering' },
          { name: 'NSGs and Azure Firewall' },
          { name: 'Load balancing solutions' },
        ],
      },
      {
        name: 'Monitor and Maintain Azure Resources',
        weight: 18,
        chapters: [
          {
            name: 'Azure Monitor',
            topics: [
              { name: 'Metrics and log analytics' },
              { name: 'Azure Monitor alerts and action groups' },
              { name: 'Log Analytics workspace' },
              { name: 'Application Insights' },
            ],
          },
          {
            name: 'Backup and Recovery',
            topics: [
              { name: 'Azure Backup vault and policies' },
              { name: 'Azure Site Recovery' },
              { name: 'VM backup and restore' },
              { name: 'Soft delete and snapshots' },
            ],
          },
        ],
        topics: [
          { name: 'Azure Monitor and Log Analytics' },
          { name: 'Azure Backup and Site Recovery' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AZ-104 tests the ability to manage Azure identities, governance, storage, compute, and virtual networks. This is the core Azure administrator certification.',
      totalDuration: 100,
      passingScore: 700,
      tips: [
        'Practice configuring NSGs, VNet peering, and load balancers in the Azure portal.',
        'Understand the differences between storage redundancy options (LRS, ZRS, GRS, GZRS).',
        'Know how to create and assign Azure Policies and RBAC roles.',
        'Be familiar with ARM template deployment and Bicep syntax.',
        'Review Azure Backup configuration and Site Recovery scenarios.',
        'Expect case studies that require you to evaluate multi-resource architectures.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, hot area, case studies with multi-part scenarios, and possible lab simulations requiring configuration in a live Azure environment.',
  },

  // ─── AZ-204 — Azure Developer ──────────────────────────────────
  {
    id: 'azure-az-204',
    vendor: 'Microsoft',
    certName: 'Developing Solutions for Microsoft Azure',
    certCode: 'AZ-204',
    aliases: [
      /\baz[\s-]?204\b/i,
      /azure\s*developer/i,
      /developing\s*solutions.*azure/i,
    ],
    retirementDate: '2026-07-31',
    passingThresholdPercent: 70,
    totalDurationMinutes: 100,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies, lab simulations',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam testing Azure development skills including compute, storage, security, and monitoring.',
        timeAllocation: 100,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Develop Azure Compute Solutions',
        weight: 28,
        chapters: [
          {
            name: 'Azure App Service',
            topics: [
              { name: 'Creating and configuring web apps' },
              { name: 'Deployment slots and swapping' },
              { name: 'App Service scaling (manual and auto)' },
              { name: 'App Service configuration and settings' },
            ],
          },
          {
            name: 'Azure Functions',
            topics: [
              { name: 'Function triggers and bindings' },
              { name: 'Durable Functions orchestrations' },
              { name: 'Function app hosting plans' },
            ],
          },
          {
            name: 'Containers',
            topics: [
              { name: 'Azure Container Registry' },
              { name: 'Azure Container Instances' },
              { name: 'Azure Container Apps' },
            ],
          },
        ],
        topics: [
          { name: 'Azure App Service and Functions' },
          { name: 'Durable Functions' },
          { name: 'Container solutions' },
        ],
      },
      {
        name: 'Develop for Azure Storage',
        weight: 18,
        chapters: [
          {
            name: 'Blob Storage',
            topics: [
              { name: 'Blob storage SDK operations' },
              { name: 'Blob lifecycle management' },
              { name: 'Blob access tiers and metadata' },
            ],
          },
          {
            name: 'Cosmos DB',
            topics: [
              { name: 'Cosmos DB SDK and partition keys' },
              { name: 'Consistency levels' },
              { name: 'Change feed processing' },
              { name: 'Stored procedures and triggers' },
            ],
          },
        ],
        topics: [
          { name: 'Blob storage SDK operations' },
          { name: 'Cosmos DB partition strategies' },
        ],
      },
      {
        name: 'Implement Azure Security',
        weight: 22,
        chapters: [
          {
            name: 'Authentication and Authorization',
            topics: [
              { name: 'Microsoft Identity Platform and MSAL' },
              { name: 'Microsoft Graph API' },
              { name: 'Managed identities' },
            ],
          },
          {
            name: 'Secure Data',
            topics: [
              { name: 'Azure Key Vault (secrets, keys, certificates)' },
              { name: 'App Configuration and feature flags' },
              { name: 'SAS tokens for storage access' },
            ],
          },
        ],
        topics: [
          { name: 'MSAL and managed identities' },
          { name: 'Azure Key Vault' },
        ],
      },
      {
        name: 'Monitor, Troubleshoot, and Optimize',
        weight: 18,
        chapters: [
          {
            name: 'Caching and CDN',
            topics: [
              { name: 'Azure CDN configuration' },
              { name: 'Azure Cache for Redis' },
              { name: 'Cache invalidation strategies' },
            ],
          },
          {
            name: 'Monitoring',
            topics: [
              { name: 'Application Insights instrumentation' },
              { name: 'Transient fault handling' },
              { name: 'Performance analysis and logging' },
            ],
          },
        ],
        topics: [
          { name: 'Azure CDN and Redis Cache' },
          { name: 'Application Insights' },
        ],
      },
      {
        name: 'Connect to and Consume Azure Services and Third-Party Services',
        weight: 14,
        chapters: [
          {
            name: 'Messaging Services',
            topics: [
              { name: 'Azure Service Bus queues and topics' },
              { name: 'Azure Queue Storage' },
              { name: 'Azure Event Grid' },
              { name: 'Azure Event Hubs' },
            ],
          },
          {
            name: 'API Management',
            topics: [
              { name: 'Azure API Management policies' },
              { name: 'API versioning and gateway configuration' },
            ],
          },
        ],
        topics: [
          { name: 'Service Bus and Event Grid' },
          { name: 'API Management' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AZ-204 validates skills in developing Azure compute solutions, working with storage and security, and integrating Azure services. Retiring July 2026.',
      totalDuration: 100,
      passingScore: 700,
      tips: [
        'Know the Azure Functions triggers and bindings model in detail.',
        'Practice Cosmos DB partition key selection and consistency level trade-offs.',
        'Understand MSAL authentication flows and managed identity configuration.',
        'Be ready for code-completion questions involving Azure SDK snippets.',
        'Review Azure Service Bus vs. Event Grid vs. Event Hubs selection criteria.',
        'Exam retiring 2026-07-31 -- schedule before that date.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop code ordering, hot area, case studies with code snippets, and potential lab simulations in a live Azure environment.',
  },

  // ─── AZ-305 — Azure Solutions Architect Expert ──────────────────
  {
    id: 'azure-az-305',
    vendor: 'Microsoft',
    certName: 'Designing Microsoft Azure Infrastructure Solutions',
    certCode: 'AZ-305',
    aliases: [
      /\baz[\s-]?305\b/i,
      /azure\s*solutions?\s*architect/i,
      /azure\s*architect/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 100,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam testing solution architecture design across identity, data, business continuity, and infrastructure.',
        timeAllocation: 100,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Design Identity, Governance, and Monitoring Solutions',
        weight: 28,
        chapters: [
          {
            name: 'Identity and Access',
            topics: [
              { name: 'Microsoft Entra ID architecture' },
              { name: 'Conditional Access and MFA design' },
              { name: 'B2B and B2C identity scenarios' },
              { name: 'Privileged Identity Management (PIM)' },
            ],
          },
          {
            name: 'Governance',
            topics: [
              { name: 'Management group and subscription design' },
              { name: 'Azure Policy and initiative design' },
              { name: 'RBAC role design and least privilege' },
            ],
          },
          {
            name: 'Monitoring',
            topics: [
              { name: 'Azure Monitor and Log Analytics design' },
              { name: 'Application Insights and alerting strategies' },
              { name: 'Azure Workbooks and dashboards' },
            ],
          },
        ],
        topics: [
          { name: 'Entra ID and PIM design' },
          { name: 'Governance and RBAC strategy' },
          { name: 'Monitoring architecture' },
        ],
      },
      {
        name: 'Design Data Storage Solutions',
        weight: 22,
        chapters: [
          {
            name: 'Relational Data',
            topics: [
              { name: 'Azure SQL Database and Managed Instance' },
              { name: 'Database scaling and elastic pools' },
              { name: 'Data replication and geo-redundancy' },
            ],
          },
          {
            name: 'Non-Relational and Big Data',
            topics: [
              { name: 'Cosmos DB multi-model design' },
              { name: 'Azure Data Lake Storage' },
              { name: 'Storage account architecture' },
              { name: 'Data integration with Synapse and Data Factory' },
            ],
          },
        ],
        topics: [
          { name: 'SQL Database and Cosmos DB design' },
          { name: 'Data Lake and Synapse architecture' },
        ],
      },
      {
        name: 'Design Business Continuity Solutions',
        weight: 18,
        chapters: [
          {
            name: 'High Availability',
            topics: [
              { name: 'Availability zones and availability sets' },
              { name: 'SLA calculations for multi-tier architectures' },
              { name: 'Load balancing and Traffic Manager design' },
            ],
          },
          {
            name: 'Disaster Recovery',
            topics: [
              { name: 'Azure Site Recovery design' },
              { name: 'Backup strategies and recovery objectives (RPO/RTO)' },
              { name: 'Geo-replication and failover groups' },
            ],
          },
        ],
        topics: [
          { name: 'HA and availability zone design' },
          { name: 'DR strategies and RPO/RTO' },
        ],
      },
      {
        name: 'Design Infrastructure Solutions',
        weight: 28,
        chapters: [
          {
            name: 'Compute Solutions',
            topics: [
              { name: 'VM vs. containers vs. serverless selection' },
              { name: 'Azure Kubernetes Service (AKS) architecture' },
              { name: 'Azure App Service and Functions design' },
              { name: 'Azure Batch and HPC solutions' },
            ],
          },
          {
            name: 'Networking',
            topics: [
              { name: 'Hub-spoke network topology' },
              { name: 'Azure Virtual WAN' },
              { name: 'Application Gateway and WAF design' },
              { name: 'Private endpoints and service endpoints' },
              { name: 'ExpressRoute and VPN design' },
            ],
          },
          {
            name: 'Migration',
            topics: [
              { name: 'Azure Migrate strategies' },
              { name: 'Application modernization paths' },
              { name: 'Database migration options' },
            ],
          },
        ],
        topics: [
          { name: 'Compute platform selection' },
          { name: 'Network topology design' },
          { name: 'Migration strategies' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AZ-305 evaluates the ability to design Azure infrastructure solutions covering identity, data, business continuity, and infrastructure. Prerequisite: AZ-104 recommended.',
      totalDuration: 100,
      passingScore: 700,
      tips: [
        'Focus on architecture trade-offs: cost vs. availability vs. performance.',
        'Know when to use hub-spoke topology vs. Virtual WAN.',
        'Understand SLA composition for multi-service architectures.',
        'Be ready for case studies requiring end-to-end solution design.',
        'Review Cosmos DB consistency levels and partition key design.',
        'Know the difference between Azure SQL Database, Managed Instance, and SQL Server on VMs.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, hot area, and extensive case studies with multi-part architecture design scenarios.',
  },

  // ─── AZ-400 — Azure DevOps Engineer Expert ─────────────────────
  {
    id: 'azure-az-400',
    vendor: 'Microsoft',
    certName: 'Designing and Implementing Microsoft DevOps Solutions',
    certCode: 'AZ-400',
    aliases: [
      /\baz[\s-]?400\b/i,
      /azure\s*devops\s*engineer/i,
      /azure\s*devops$/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 120,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies, lab simulations',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam covering DevOps strategy, source control, CI/CD, dependency management, infrastructure as code, and continuous feedback.',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Configure Processes and Communications',
        weight: 8,
        chapters: [
          {
            name: 'DevOps Strategy',
            topics: [
              { name: 'Agile planning with Azure Boards' },
              { name: 'Team collaboration and communication tools' },
              { name: 'DevOps culture and mindset' },
            ],
          },
        ],
        topics: [
          { name: 'Azure Boards and agile planning' },
          { name: 'DevOps culture' },
        ],
      },
      {
        name: 'Design and Implement Source Control',
        weight: 12,
        chapters: [
          {
            name: 'Git Workflows',
            topics: [
              { name: 'Branching strategies (GitFlow, trunk-based)' },
              { name: 'Pull request workflows and policies' },
              { name: 'Git hooks and repository management' },
            ],
          },
          {
            name: 'Repository Management',
            topics: [
              { name: 'Mono-repo vs. multi-repo strategies' },
              { name: 'Large file storage (Git LFS)' },
              { name: 'Repository security and permissions' },
            ],
          },
        ],
        topics: [
          { name: 'Branching strategies' },
          { name: 'Pull request policies' },
        ],
      },
      {
        name: 'Design and Implement Build and Release Pipelines',
        weight: 42,
        chapters: [
          {
            name: 'Continuous Integration',
            topics: [
              { name: 'Azure Pipelines YAML configuration' },
              { name: 'Build agents (Microsoft-hosted and self-hosted)' },
              { name: 'Pipeline triggers and templates' },
              { name: 'Multi-stage pipelines' },
            ],
          },
          {
            name: 'Continuous Delivery',
            topics: [
              { name: 'Release pipelines and environments' },
              { name: 'Deployment strategies (blue-green, canary, rolling)' },
              { name: 'Approval gates and quality checks' },
              { name: 'Azure Artifacts integration' },
            ],
          },
          {
            name: 'Testing Strategy',
            topics: [
              { name: 'Automated testing in pipelines' },
              { name: 'Integration and load testing' },
              { name: 'Security scanning in CI/CD' },
            ],
          },
          {
            name: 'GitHub Actions',
            topics: [
              { name: 'GitHub Actions workflows' },
              { name: 'GitHub-Azure integration' },
              { name: 'Secrets and environment management' },
            ],
          },
        ],
        topics: [
          { name: 'Azure Pipelines YAML' },
          { name: 'Deployment strategies' },
          { name: 'GitHub Actions workflows' },
        ],
      },
      {
        name: 'Develop a Dependency Management Strategy',
        weight: 8,
        chapters: [
          {
            name: 'Package Management',
            topics: [
              { name: 'Azure Artifacts feeds' },
              { name: 'NuGet, npm, Maven, and Python package management' },
              { name: 'Versioning strategies (SemVer)' },
              { name: 'Upstream sources and package security' },
            ],
          },
        ],
        topics: [
          { name: 'Azure Artifacts and package feeds' },
          { name: 'Versioning and dependency security' },
        ],
      },
      {
        name: 'Implement Infrastructure as Code and Configuration Management',
        weight: 18,
        chapters: [
          {
            name: 'Infrastructure as Code',
            topics: [
              { name: 'ARM templates and Bicep' },
              { name: 'Terraform for Azure' },
              { name: 'Desired State Configuration (DSC)' },
              { name: 'Azure Automation' },
            ],
          },
          {
            name: 'Container Infrastructure',
            topics: [
              { name: 'Docker and container registries' },
              { name: 'Azure Kubernetes Service (AKS) deployment' },
              { name: 'Helm charts and manifests' },
            ],
          },
        ],
        topics: [
          { name: 'ARM/Bicep and Terraform' },
          { name: 'AKS and container orchestration' },
        ],
      },
      {
        name: 'Implement Continuous Feedback',
        weight: 12,
        chapters: [
          {
            name: 'Monitoring and Logging',
            topics: [
              { name: 'Azure Monitor and Application Insights' },
              { name: 'Log Analytics queries (KQL)' },
              { name: 'Alerting and notification strategies' },
            ],
          },
          {
            name: 'Feedback Loops',
            topics: [
              { name: 'Feature flags and A/B testing' },
              { name: 'User telemetry and analytics' },
              { name: 'Site Reliability Engineering (SRE) practices' },
            ],
          },
        ],
        topics: [
          { name: 'Azure Monitor and KQL' },
          { name: 'Feature flags and SRE' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AZ-400 validates skills in designing and implementing DevOps practices including CI/CD pipelines, source control, infrastructure as code, and continuous feedback. Build/release pipelines dominate the exam at ~42%.',
      totalDuration: 120,
      passingScore: 700,
      tips: [
        'Build/release pipelines represent ~42% of the exam -- master Azure Pipelines YAML syntax.',
        'Know deployment strategies: blue-green, canary, rolling, and when to use each.',
        'Understand GitHub Actions workflows and GitHub-Azure integration.',
        'Practice writing KQL queries for Log Analytics.',
        'Be familiar with both ARM/Bicep and Terraform for IaC questions.',
        'Review Azure Artifacts for package management scenarios.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop pipeline configuration, hot area, case studies with CI/CD design scenarios, and potential lab simulations.',
  },

  // ─── AZ-500 — Azure Security Engineer ──────────────────────────
  {
    id: 'azure-az-500',
    vendor: 'Microsoft',
    certName: 'Azure Security Technologies',
    certCode: 'AZ-500',
    aliases: [
      /\baz[\s-]?500\b/i,
      /azure\s*security\s*engineer/i,
      /azure\s*security\s*technologies/i,
    ],
    retirementDate: '2026-08-31',
    passingThresholdPercent: 70,
    totalDurationMinutes: 100,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies, lab simulations',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam covering identity/access, platform protection, security operations, and data/application security.',
        timeAllocation: 100,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Manage Identity and Access',
        weight: 28,
        chapters: [
          {
            name: 'Microsoft Entra ID Security',
            topics: [
              { name: 'Conditional Access policies' },
              { name: 'Privileged Identity Management (PIM)' },
              { name: 'Identity Protection risk policies' },
              { name: 'MFA and passwordless authentication' },
            ],
          },
          {
            name: 'Access Management',
            topics: [
              { name: 'Azure RBAC and custom roles' },
              { name: 'Managed identities for Azure resources' },
              { name: 'Service principals and app registrations' },
              { name: 'Access reviews and entitlement management' },
            ],
          },
        ],
        topics: [
          { name: 'Conditional Access and PIM' },
          { name: 'RBAC and managed identities' },
        ],
      },
      {
        name: 'Secure Networking and Platform Protection',
        weight: 18,
        chapters: [
          {
            name: 'Network Security',
            topics: [
              { name: 'NSG and ASG configuration' },
              { name: 'Azure Firewall and Firewall Manager' },
              { name: 'Azure DDoS Protection' },
              { name: 'Private endpoints and Private Link' },
            ],
          },
          {
            name: 'Host Security',
            topics: [
              { name: 'VM security and endpoint protection' },
              { name: 'Azure Bastion and JIT VM access' },
              { name: 'Container security and AKS hardening' },
            ],
          },
        ],
        topics: [
          { name: 'Azure Firewall and DDoS Protection' },
          { name: 'Azure Bastion and JIT access' },
        ],
      },
      {
        name: 'Manage Security Operations',
        weight: 28,
        chapters: [
          {
            name: 'Microsoft Defender for Cloud',
            topics: [
              { name: 'Security posture and Secure Score' },
              { name: 'Workload protection plans' },
              { name: 'Regulatory compliance dashboards' },
              { name: 'Just-in-time VM access' },
            ],
          },
          {
            name: 'Microsoft Sentinel',
            topics: [
              { name: 'Data connectors and log ingestion' },
              { name: 'Analytics rules and incident management' },
              { name: 'Workbooks and threat hunting' },
              { name: 'Automation with playbooks (Logic Apps)' },
            ],
          },
        ],
        topics: [
          { name: 'Defender for Cloud and Secure Score' },
          { name: 'Sentinel incident management' },
        ],
      },
      {
        name: 'Secure Data and Applications',
        weight: 22,
        chapters: [
          {
            name: 'Data Security',
            topics: [
              { name: 'Azure Key Vault (keys, secrets, certificates)' },
              { name: 'Storage encryption and customer-managed keys' },
              { name: 'Azure SQL security (TDE, Always Encrypted, dynamic data masking)' },
              { name: 'Azure Information Protection' },
            ],
          },
          {
            name: 'Application Security',
            topics: [
              { name: 'App Service security and access restrictions' },
              { name: 'API Management security policies' },
              { name: 'Azure Web Application Firewall (WAF)' },
            ],
          },
        ],
        topics: [
          { name: 'Key Vault and encryption' },
          { name: 'SQL security and WAF' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AZ-500 validates skills in Azure security including identity management, platform protection, security operations, and data/application security. Retiring August 2026.',
      totalDuration: 100,
      passingScore: 700,
      tips: [
        'Identity/access and security operations each represent ~28% -- focus here first.',
        'Know Conditional Access policy components and PIM configuration.',
        'Understand Microsoft Defender for Cloud workload protection plans.',
        'Practice configuring Microsoft Sentinel analytics rules and playbooks.',
        'Review Key Vault access policies vs. RBAC model.',
        'Exam retiring 2026-08-31 -- schedule before that date.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, hot area, case studies with security architecture scenarios, and potential lab simulations in a live Azure environment.',
  },

  // ─── AI-900 — Azure AI Fundamentals ─────────────────────────────
  {
    id: 'azure-ai-900',
    vendor: 'Microsoft',
    certName: 'Azure AI Fundamentals',
    certCode: 'AI-900',
    aliases: [
      /\bai[\s-]?900\b/i,
      /azure\s*ai\s*fundamentals/i,
    ],
    retirementDate: '2026-06-30',
    passingThresholdPercent: 70,
    totalDurationMinutes: 45,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format fundamentals exam covering AI workloads, ML, computer vision, NLP, and generative AI.',
        timeAllocation: 45,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'AI Workloads and Considerations',
        weight: 18,
        chapters: [
          {
            name: 'AI Concepts',
            topics: [
              { name: 'Common AI workloads (prediction, anomaly detection, NLP, vision)' },
              { name: 'Responsible AI principles' },
              { name: 'AI fairness, transparency, and accountability' },
            ],
          },
        ],
        topics: [
          { name: 'Common AI workloads' },
          { name: 'Responsible AI principles' },
        ],
      },
      {
        name: 'Machine Learning Fundamentals',
        weight: 22,
        chapters: [
          {
            name: 'Core ML Concepts',
            topics: [
              { name: 'Supervised learning (classification, regression)' },
              { name: 'Unsupervised learning (clustering)' },
              { name: 'Training, validation, and evaluation metrics' },
            ],
          },
          {
            name: 'Azure Machine Learning',
            topics: [
              { name: 'Azure Machine Learning workspace' },
              { name: 'Automated ML (AutoML)' },
              { name: 'Azure ML Designer' },
            ],
          },
        ],
        topics: [
          { name: 'Supervised and unsupervised learning' },
          { name: 'Azure Machine Learning studio' },
        ],
      },
      {
        name: 'Computer Vision Workloads',
        weight: 18,
        chapters: [
          {
            name: 'Computer Vision',
            topics: [
              { name: 'Image classification and object detection' },
              { name: 'Azure AI Vision service' },
              { name: 'Face detection and analysis' },
              { name: 'Optical character recognition (OCR)' },
            ],
          },
        ],
        topics: [
          { name: 'Image classification and object detection' },
          { name: 'Azure AI Vision and OCR' },
        ],
      },
      {
        name: 'Natural Language Processing Workloads',
        weight: 18,
        chapters: [
          {
            name: 'NLP Concepts',
            topics: [
              { name: 'Text analytics (key phrase extraction, sentiment, NER)' },
              { name: 'Azure AI Language service' },
              { name: 'Speech-to-text and text-to-speech' },
              { name: 'Translation services' },
            ],
          },
        ],
        topics: [
          { name: 'Text analytics and sentiment analysis' },
          { name: 'Azure AI Language and Speech services' },
        ],
      },
      {
        name: 'Generative AI Workloads',
        weight: 18,
        chapters: [
          {
            name: 'Generative AI Concepts',
            topics: [
              { name: 'Large language models (LLMs)' },
              { name: 'Azure OpenAI Service' },
              { name: 'Prompt engineering basics' },
              { name: 'Responsible use of generative AI' },
            ],
          },
        ],
        topics: [
          { name: 'LLMs and Azure OpenAI Service' },
          { name: 'Prompt engineering' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AI-900 is a foundational exam covering AI concepts, ML, computer vision, NLP, and generative AI with Azure services. Retiring June 2026.',
      totalDuration: 45,
      passingScore: 700,
      tips: [
        'Know the six Microsoft responsible AI principles: fairness, reliability, privacy, inclusiveness, transparency, accountability.',
        'Understand the difference between classification, regression, and clustering.',
        'Be familiar with Azure AI Vision, Language, and Speech service capabilities.',
        'Review Azure OpenAI Service features and prompt engineering basics.',
        'Exam retiring 2026-06-30 -- schedule before that date.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, and hot area. Questions test conceptual understanding of AI/ML concepts and Azure AI service capabilities. No lab simulations.',
  },

  // ─── AI-102 — Azure AI Engineer ─────────────────────────────────
  {
    id: 'azure-ai-102',
    vendor: 'Microsoft',
    certName: 'Designing and Implementing a Microsoft Azure AI Solution',
    certCode: 'AI-102',
    aliases: [
      /\bai[\s-]?102\b/i,
      /azure\s*ai\s*engineer/i,
    ],
    retirementDate: '2026-06-30',
    passingThresholdPercent: 70,
    totalDurationMinutes: 100,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam testing the ability to plan, implement, and manage Azure AI solutions including vision, NLP, generative AI, and knowledge mining.',
        timeAllocation: 100,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Plan and Manage an Azure AI Solution',
        weight: 18,
        chapters: [
          {
            name: 'Solution Planning',
            topics: [
              { name: 'Azure AI services resource provisioning' },
              { name: 'Authentication and security (keys, managed identity)' },
              { name: 'Networking and private endpoints for AI services' },
              { name: 'Container deployment of AI services' },
            ],
          },
          {
            name: 'Monitoring and Management',
            topics: [
              { name: 'Diagnostic logging for AI services' },
              { name: 'Cost management and quotas' },
              { name: 'Responsible AI tools and practices' },
            ],
          },
        ],
        topics: [
          { name: 'AI resource provisioning and security' },
          { name: 'Monitoring and responsible AI' },
        ],
      },
      {
        name: 'Implement Computer Vision Solutions',
        weight: 18,
        chapters: [
          {
            name: 'Image Analysis',
            topics: [
              { name: 'Azure AI Vision image analysis' },
              { name: 'Custom Vision training and prediction' },
              { name: 'Face API detection and verification' },
            ],
          },
          {
            name: 'OCR and Video',
            topics: [
              { name: 'Document Intelligence (Form Recognizer)' },
              { name: 'OCR with Azure AI Vision' },
              { name: 'Video Indexer' },
            ],
          },
        ],
        topics: [
          { name: 'Azure AI Vision and Custom Vision' },
          { name: 'Document Intelligence and OCR' },
        ],
      },
      {
        name: 'Implement Natural Language Processing Solutions',
        weight: 28,
        chapters: [
          {
            name: 'Text Analytics',
            topics: [
              { name: 'Entity recognition and key phrase extraction' },
              { name: 'Sentiment analysis and opinion mining' },
              { name: 'Language detection' },
              { name: 'Custom text classification and NER' },
            ],
          },
          {
            name: 'Conversational AI',
            topics: [
              { name: 'Question answering (custom and prebuilt)' },
              { name: 'Conversational Language Understanding (CLU)' },
              { name: 'Azure Bot Service integration' },
            ],
          },
          {
            name: 'Speech and Translation',
            topics: [
              { name: 'Speech-to-text and text-to-speech' },
              { name: 'Speech translation' },
              { name: 'Text translation and custom translator' },
            ],
          },
        ],
        topics: [
          { name: 'Text analytics and custom NLP' },
          { name: 'CLU and conversational AI' },
          { name: 'Speech and translation services' },
        ],
      },
      {
        name: 'Implement Generative AI Solutions',
        weight: 12,
        chapters: [
          {
            name: 'Azure OpenAI Service',
            topics: [
              { name: 'Azure OpenAI resource provisioning' },
              { name: 'Prompt engineering and system messages' },
              { name: 'Fine-tuning models' },
              { name: 'Retrieval-Augmented Generation (RAG) patterns' },
            ],
          },
        ],
        topics: [
          { name: 'Azure OpenAI deployment and prompt engineering' },
          { name: 'RAG patterns' },
        ],
      },
      {
        name: 'Implement Knowledge Mining and Document Intelligence',
        weight: 8,
        chapters: [
          {
            name: 'Azure AI Search',
            topics: [
              { name: 'Index creation and data sources' },
              { name: 'Skillsets and enrichment pipeline' },
              { name: 'Custom skills and knowledge store' },
              { name: 'Search query syntax and scoring profiles' },
            ],
          },
        ],
        topics: [
          { name: 'Azure AI Search and skillsets' },
          { name: 'Knowledge store' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AI-102 validates skills in designing and implementing Azure AI solutions including vision, NLP, generative AI, and knowledge mining. NLP is the largest domain at ~28%. Retiring June 2026.',
      totalDuration: 100,
      passingScore: 700,
      tips: [
        'NLP is the largest domain (~28%) -- master CLU, text analytics, and speech services.',
        'Know how to provision and secure Azure AI services with managed identities.',
        'Understand Retrieval-Augmented Generation (RAG) patterns with Azure OpenAI.',
        'Review Azure AI Search skillsets and enrichment pipelines.',
        'Practice with Document Intelligence (Form Recognizer) custom models.',
        'Exam retiring 2026-06-30 -- schedule before that date.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, hot area, and case studies with multi-part AI solution design scenarios. Code snippets may appear for SDK usage questions.',
  },

  // ─── DP-900 — Azure Data Fundamentals ──────────────────────────
  {
    id: 'azure-dp-900',
    vendor: 'Microsoft',
    certName: 'Azure Data Fundamentals',
    certCode: 'DP-900',
    aliases: [
      /\bdp[\s-]?900\b/i,
      /azure\s*data\s*fundamentals/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 45,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format fundamentals exam covering core data concepts, relational and non-relational data, and analytics on Azure.',
        timeAllocation: 45,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Core Data Concepts',
        weight: 28,
        chapters: [
          {
            name: 'Data Fundamentals',
            topics: [
              { name: 'Structured, semi-structured, and unstructured data' },
              { name: 'Data storage models (relational, document, key-value, graph)' },
              { name: 'Transactional vs. analytical workloads' },
            ],
          },
          {
            name: 'Data Roles and Services',
            topics: [
              { name: 'Data roles (DBA, data engineer, data analyst)' },
              { name: 'Azure data services overview' },
              { name: 'ETL and ELT concepts' },
            ],
          },
        ],
        topics: [
          { name: 'Data types and storage models' },
          { name: 'Transactional vs. analytical workloads' },
        ],
      },
      {
        name: 'Relational Data on Azure',
        weight: 22,
        chapters: [
          {
            name: 'Relational Concepts',
            topics: [
              { name: 'Relational model (tables, keys, normalization)' },
              { name: 'SQL query fundamentals (SELECT, JOIN, aggregation)' },
              { name: 'Database objects (views, stored procedures, indexes)' },
            ],
          },
          {
            name: 'Azure Relational Services',
            topics: [
              { name: 'Azure SQL Database' },
              { name: 'Azure SQL Managed Instance' },
              { name: 'Azure Database for MySQL and PostgreSQL' },
            ],
          },
        ],
        topics: [
          { name: 'SQL fundamentals and relational model' },
          { name: 'Azure SQL services' },
        ],
      },
      {
        name: 'Non-Relational Data on Azure',
        weight: 18,
        chapters: [
          {
            name: 'Non-Relational Concepts',
            topics: [
              { name: 'NoSQL data models (document, key-value, column-family, graph)' },
              { name: 'Azure Cosmos DB and its APIs' },
              { name: 'Azure Table Storage' },
            ],
          },
          {
            name: 'Azure Storage',
            topics: [
              { name: 'Azure Blob Storage' },
              { name: 'Azure Files and Azure Data Lake Storage' },
            ],
          },
        ],
        topics: [
          { name: 'Cosmos DB and NoSQL models' },
          { name: 'Azure Blob and Data Lake Storage' },
        ],
      },
      {
        name: 'Analytics on Azure',
        weight: 28,
        chapters: [
          {
            name: 'Analytics Concepts',
            topics: [
              { name: 'Data warehousing concepts' },
              { name: 'Real-time vs. batch analytics' },
              { name: 'Star schema and data modeling for analytics' },
            ],
          },
          {
            name: 'Azure Analytics Services',
            topics: [
              { name: 'Azure Synapse Analytics' },
              { name: 'Azure Databricks' },
              { name: 'Azure HDInsight' },
              { name: 'Azure Data Factory' },
              { name: 'Azure Stream Analytics' },
              { name: 'Microsoft Power BI' },
            ],
          },
        ],
        topics: [
          { name: 'Data warehousing and Synapse Analytics' },
          { name: 'Power BI and data visualization' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'DP-900 is an entry-level exam covering core data concepts, relational and non-relational data on Azure, and Azure analytics services.',
      totalDuration: 45,
      passingScore: 700,
      tips: [
        'Know the differences between transactional (OLTP) and analytical (OLAP) workloads.',
        'Understand when to use Azure SQL Database vs. Cosmos DB vs. Blob Storage.',
        'Review Azure Synapse Analytics components: SQL pools, Spark pools, pipelines.',
        'Be familiar with basic SQL query syntax for relational data questions.',
        'Know Cosmos DB API options: SQL, MongoDB, Cassandra, Table, Gremlin.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, and hot area. Questions test conceptual understanding of data concepts and Azure data service selection. No lab simulations.',
  },

  // ─── DP-300 — Azure Database Administrator ─────────────────────
  {
    id: 'azure-dp-300',
    vendor: 'Microsoft',
    certName: 'Administering Microsoft Azure SQL Solutions',
    certCode: 'DP-300',
    aliases: [
      /\bdp[\s-]?300\b/i,
      /azure\s*database\s*admin/i,
      /azure\s*sql\s*admin/i,
      /azure\s*dba$/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 100,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies, lab simulations',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam covering Azure SQL planning, security, monitoring, optimization, configuration, and HADR.',
        timeAllocation: 100,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Plan and Implement Data Platform Resources',
        weight: 18,
        chapters: [
          {
            name: 'Deployment Planning',
            topics: [
              { name: 'Azure SQL Database deployment options' },
              { name: 'Azure SQL Managed Instance configuration' },
              { name: 'SQL Server on Azure VMs' },
              { name: 'Database migration strategies (DMS, Azure Migrate)' },
            ],
          },
          {
            name: 'Resource Configuration',
            topics: [
              { name: 'Compute and storage tier selection' },
              { name: 'Elastic pools configuration' },
              { name: 'Serverless vs. provisioned compute' },
            ],
          },
        ],
        topics: [
          { name: 'SQL deployment options and migration' },
          { name: 'Compute and storage tiers' },
        ],
      },
      {
        name: 'Implement a Secure Environment',
        weight: 18,
        chapters: [
          {
            name: 'Database Security',
            topics: [
              { name: 'Azure SQL authentication (SQL, Entra ID, managed identity)' },
              { name: 'Database-level and server-level firewall rules' },
              { name: 'Transparent Data Encryption (TDE)' },
              { name: 'Always Encrypted and dynamic data masking' },
            ],
          },
          {
            name: 'Auditing and Compliance',
            topics: [
              { name: 'Azure SQL auditing' },
              { name: 'Advanced Threat Protection' },
              { name: 'SQL vulnerability assessment' },
              { name: 'Row-level security and data classification' },
            ],
          },
        ],
        topics: [
          { name: 'Authentication and encryption' },
          { name: 'Auditing and threat protection' },
        ],
      },
      {
        name: 'Monitor, Configure, and Optimize Resources',
        weight: 22,
        chapters: [
          {
            name: 'Performance Monitoring',
            topics: [
              { name: 'Azure SQL Database metrics and alerts' },
              { name: 'Query Performance Insight' },
              { name: 'Dynamic Management Views (DMVs)' },
              { name: 'Intelligent Performance features (auto-tuning)' },
            ],
          },
          {
            name: 'Performance Optimization',
            topics: [
              { name: 'Index management and recommendations' },
              { name: 'Query store analysis' },
              { name: 'Execution plan analysis' },
              { name: 'Resource governance and throttling' },
            ],
          },
        ],
        topics: [
          { name: 'Query performance monitoring' },
          { name: 'Index and query optimization' },
        ],
      },
      {
        name: 'Configure and Manage Automation of Tasks',
        weight: 22,
        chapters: [
          {
            name: 'Task Automation',
            topics: [
              { name: 'Azure SQL Agent jobs' },
              { name: 'Azure Automation runbooks' },
              { name: 'Elastic jobs' },
              { name: 'Maintenance tasks and scheduling' },
            ],
          },
          {
            name: 'Configuration Management',
            topics: [
              { name: 'Azure Policy for SQL resources' },
              { name: 'ARM templates and Bicep for SQL deployment' },
              { name: 'Database lifecycle management' },
            ],
          },
        ],
        topics: [
          { name: 'SQL Agent and automation' },
          { name: 'ARM/Bicep for SQL' },
        ],
      },
      {
        name: 'Plan and Configure High Availability and Disaster Recovery',
        weight: 18,
        chapters: [
          {
            name: 'High Availability',
            topics: [
              { name: 'Azure SQL Database HA architecture (active geo-replication)' },
              { name: 'Failover groups and auto-failover' },
              { name: 'Always On availability groups (SQL on VMs)' },
            ],
          },
          {
            name: 'Disaster Recovery',
            topics: [
              { name: 'Backup strategies (automated, long-term retention)' },
              { name: 'Point-in-time restore and geo-restore' },
              { name: 'RPO and RTO planning for SQL workloads' },
            ],
          },
        ],
        topics: [
          { name: 'Geo-replication and failover groups' },
          { name: 'Backup and restore strategies' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'DP-300 validates skills in administering Azure SQL solutions including deployment, security, monitoring, optimization, automation, and HADR.',
      totalDuration: 100,
      passingScore: 700,
      tips: [
        'Monitor/optimize and configure/automate are the largest domains (~22% each).',
        'Know the differences between Azure SQL Database, Managed Instance, and SQL Server on VMs.',
        'Understand auto-tuning, Query Store, and DMVs for performance optimization.',
        'Review geo-replication vs. failover groups vs. Always On availability groups.',
        'Practice configuring TDE, Always Encrypted, and dynamic data masking.',
        'Be prepared for case studies requiring multi-database architecture decisions.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, hot area, case studies with database administration scenarios, and potential lab simulations involving SQL configuration.',
  },

  // ─── SC-900 — Security/Compliance/Identity Fundamentals ────────
  {
    id: 'azure-sc-900',
    vendor: 'Microsoft',
    certName: 'Security, Compliance, and Identity Fundamentals',
    certCode: 'SC-900',
    aliases: [
      /\bsc[\s-]?900\b/i,
      /security\s*compliance\s*identity\s*fundamentals/i,
      /microsoft\s*security\s*fundamentals/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 45,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format fundamentals exam covering security/compliance concepts, Microsoft identity, security capabilities, and compliance features.',
        timeAllocation: 45,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Security and Compliance Concepts',
        weight: 12,
        chapters: [
          {
            name: 'Security Concepts',
            topics: [
              { name: 'Shared responsibility model' },
              { name: 'Defense in depth' },
              { name: 'Zero Trust model' },
              { name: 'Common threats and attack vectors' },
            ],
          },
          {
            name: 'Compliance Concepts',
            topics: [
              { name: 'Data residency and sovereignty' },
              { name: 'Privacy principles and regulations (GDPR)' },
              { name: 'Encryption and hashing concepts' },
            ],
          },
        ],
        topics: [
          { name: 'Zero Trust and defense in depth' },
          { name: 'Compliance and privacy concepts' },
        ],
      },
      {
        name: 'Microsoft Identity and Access Management',
        weight: 28,
        chapters: [
          {
            name: 'Microsoft Entra ID',
            topics: [
              { name: 'Microsoft Entra ID concepts (tenant, directory)' },
              { name: 'Identity types (user, device, service principal, managed identity)' },
              { name: 'Hybrid identity with Entra Connect' },
              { name: 'External identities (B2B, B2C)' },
            ],
          },
          {
            name: 'Authentication and Access',
            topics: [
              { name: 'Authentication methods (MFA, passwordless, FIDO2)' },
              { name: 'Conditional Access policies' },
              { name: 'Azure RBAC and Entra roles' },
              { name: 'Identity governance (access reviews, PIM, entitlement management)' },
            ],
          },
        ],
        topics: [
          { name: 'Microsoft Entra ID and hybrid identity' },
          { name: 'MFA, Conditional Access, and governance' },
        ],
      },
      {
        name: 'Microsoft Security Solutions',
        weight: 32,
        chapters: [
          {
            name: 'Azure Security',
            topics: [
              { name: 'Azure DDoS Protection and Azure Firewall' },
              { name: 'Network Security Groups and Web Application Firewall' },
              { name: 'Azure Key Vault' },
              { name: 'Microsoft Defender for Cloud' },
            ],
          },
          {
            name: 'Microsoft 365 Security',
            topics: [
              { name: 'Microsoft Defender XDR (365 Defender)' },
              { name: 'Microsoft Defender for Endpoint, Office 365, Identity' },
              { name: 'Microsoft Sentinel (SIEM/SOAR)' },
            ],
          },
        ],
        topics: [
          { name: 'Azure security services' },
          { name: 'Microsoft Defender and Sentinel' },
        ],
      },
      {
        name: 'Microsoft Compliance Solutions',
        weight: 22,
        chapters: [
          {
            name: 'Compliance Management',
            topics: [
              { name: 'Microsoft Purview compliance portal' },
              { name: 'Compliance Manager and compliance score' },
              { name: 'Data classification and sensitivity labels' },
              { name: 'Data loss prevention (DLP)' },
            ],
          },
          {
            name: 'Information Governance',
            topics: [
              { name: 'Retention policies and labels' },
              { name: 'Records management' },
              { name: 'eDiscovery and audit capabilities' },
              { name: 'Insider risk management' },
            ],
          },
        ],
        topics: [
          { name: 'Microsoft Purview and compliance score' },
          { name: 'DLP and information governance' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'SC-900 is an entry-level exam covering security, compliance, and identity fundamentals across Microsoft services including Azure, Microsoft 365, and Microsoft Purview.',
      totalDuration: 45,
      passingScore: 700,
      tips: [
        'Security solutions is the largest domain (~32%) -- know Microsoft Defender and Sentinel capabilities.',
        'Understand the Zero Trust model and shared responsibility model.',
        'Review Microsoft Entra ID concepts: Conditional Access, PIM, access reviews.',
        'Know Microsoft Purview compliance features: Compliance Manager, DLP, sensitivity labels.',
        'This is a cross-platform exam covering Azure and Microsoft 365 security.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, and hot area. Questions test conceptual understanding of Microsoft security and compliance services. No lab simulations.',
  },

  // ─── SC-200 — Security Operations Analyst ──────────────────────
  {
    id: 'azure-sc-200',
    vendor: 'Microsoft',
    certName: 'Microsoft Security Operations Analyst',
    certCode: 'SC-200',
    aliases: [
      /\bsc[\s-]?200\b/i,
      /security\s*operations\s*analyst/i,
      /microsoft\s*sec\s*ops/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 100,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies, lab simulations',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam covering Microsoft Sentinel operations, Defender XDR, and Defender for Cloud.',
        timeAllocation: 100,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Microsoft Sentinel Operations',
        weight: 28,
        chapters: [
          {
            name: 'Sentinel Configuration',
            topics: [
              { name: 'Workspace design and data connectors' },
              { name: 'Analytics rules (scheduled, NRT, fusion)' },
              { name: 'Data normalization (ASIM)' },
            ],
          },
          {
            name: 'Incident Management',
            topics: [
              { name: 'Incident investigation and triage' },
              { name: 'Automation with playbooks (Logic Apps)' },
              { name: 'Workbooks and threat hunting with KQL' },
              { name: 'Threat intelligence integration' },
            ],
          },
        ],
        topics: [
          { name: 'Sentinel analytics and data connectors' },
          { name: 'Incident management and automation' },
        ],
      },
      {
        name: 'Microsoft Defender XDR Threat Mitigation',
        weight: 28,
        chapters: [
          {
            name: 'Defender for Endpoint',
            topics: [
              { name: 'Endpoint detection and response (EDR)' },
              { name: 'Attack surface reduction rules' },
              { name: 'Automated investigation and remediation' },
              { name: 'Threat and vulnerability management' },
            ],
          },
          {
            name: 'Defender for Office 365 and Identity',
            topics: [
              { name: 'Anti-phishing and Safe Links/Attachments policies' },
              { name: 'Defender for Identity alerts and lateral movement paths' },
              { name: 'Unified incident queue in Microsoft Defender portal' },
            ],
          },
          {
            name: 'Advanced Hunting',
            topics: [
              { name: 'KQL queries for threat hunting' },
              { name: 'Custom detection rules' },
              { name: 'Cross-domain investigation' },
            ],
          },
        ],
        topics: [
          { name: 'Defender for Endpoint EDR' },
          { name: 'Defender for Office 365 and Identity' },
          { name: 'KQL-based threat hunting' },
        ],
      },
      {
        name: 'Microsoft Defender for Cloud',
        weight: 22,
        chapters: [
          {
            name: 'Cloud Security Posture',
            topics: [
              { name: 'Secure Score and recommendations' },
              { name: 'Regulatory compliance dashboards' },
              { name: 'Cloud Security Posture Management (CSPM)' },
            ],
          },
          {
            name: 'Workload Protection',
            topics: [
              { name: 'Defender for Servers and VMs' },
              { name: 'Defender for Containers and Kubernetes' },
              { name: 'Defender for SQL and Storage' },
              { name: 'Alert investigation and response' },
            ],
          },
        ],
        topics: [
          { name: 'Secure Score and CSPM' },
          { name: 'Workload protection plans' },
        ],
      },
      {
        name: 'Threat Intelligence and Cross-Product Correlation',
        weight: 22,
        chapters: [
          {
            name: 'Threat Intelligence',
            topics: [
              { name: 'Microsoft Defender Threat Intelligence' },
              { name: 'Threat indicators and STIX/TAXII' },
              { name: 'Sentinel threat intelligence workbooks' },
            ],
          },
          {
            name: 'Cross-Product Investigation',
            topics: [
              { name: 'Unified security operations with Sentinel and Defender XDR' },
              { name: 'Multi-source incident correlation' },
              { name: 'SOAR automation across products' },
            ],
          },
        ],
        topics: [
          { name: 'Threat intelligence integration' },
          { name: 'Cross-product incident correlation' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'SC-200 validates skills in security operations using Microsoft Sentinel, Defender XDR, and Defender for Cloud. KQL proficiency is essential throughout.',
      totalDuration: 100,
      passingScore: 700,
      tips: [
        'Sentinel and Defender XDR each represent ~28% -- master both equally.',
        'KQL (Kusto Query Language) proficiency is critical for hunting and analytics rules.',
        'Know how to configure Sentinel analytics rules (scheduled, NRT, fusion).',
        'Understand Defender for Endpoint EDR workflows and automated investigation.',
        'Review Defender for Cloud Secure Score, CSPM, and workload protection.',
        'Practice configuring SOAR playbooks with Logic Apps in Sentinel.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, hot area, case studies with security incident investigation scenarios, and potential lab simulations involving Sentinel and Defender portals.',
  },

  // ─── PL-900 — Power Platform Fundamentals ─────────────────────
  {
    id: 'azure-pl-900',
    vendor: 'Microsoft',
    certName: 'Microsoft Power Platform Fundamentals',
    certCode: 'PL-900',
    aliases: [
      /\bpl[\s-]?900\b/i,
      /power\s*platform\s*fundamentals/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 45,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format fundamentals exam covering Power Platform, Power Apps, Power Automate, Power BI, and Copilot.',
        timeAllocation: 45,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Describe the Business Value of Microsoft Power Platform',
        weight: 18,
        chapters: [
          {
            name: 'Power Platform Overview',
            topics: [
              { name: 'Power Platform components and ecosystem' },
              { name: 'Microsoft Dataverse' },
              { name: 'Connectors (standard and premium)' },
              { name: 'Business value and use cases' },
            ],
          },
          {
            name: 'Administration and Security',
            topics: [
              { name: 'Power Platform admin center' },
              { name: 'Environments and data loss prevention (DLP)' },
              { name: 'Security roles and permissions' },
            ],
          },
        ],
        topics: [
          { name: 'Power Platform components and Dataverse' },
          { name: 'Administration and DLP' },
        ],
      },
      {
        name: 'Identify Core Components of Microsoft Power Apps',
        weight: 22,
        chapters: [
          {
            name: 'Power Apps Basics',
            topics: [
              { name: 'Canvas apps vs. model-driven apps' },
              { name: 'App design and user experience' },
              { name: 'Data sources and connections' },
            ],
          },
          {
            name: 'Building Apps',
            topics: [
              { name: 'Power Apps Studio' },
              { name: 'Formulas and expressions' },
              { name: 'Power Apps portals' },
              { name: 'App sharing and publishing' },
            ],
          },
        ],
        topics: [
          { name: 'Canvas vs. model-driven apps' },
          { name: 'Power Apps Studio and formulas' },
        ],
      },
      {
        name: 'Describe the Core Components of Power Automate',
        weight: 22,
        chapters: [
          {
            name: 'Flow Types',
            topics: [
              { name: 'Cloud flows (automated, instant, scheduled)' },
              { name: 'Desktop flows (RPA)' },
              { name: 'Business process flows' },
            ],
          },
          {
            name: 'Building Flows',
            topics: [
              { name: 'Triggers and actions' },
              { name: 'Conditions and loops' },
              { name: 'Approvals and notifications' },
              { name: 'Error handling and monitoring' },
            ],
          },
        ],
        topics: [
          { name: 'Cloud flows and desktop flows (RPA)' },
          { name: 'Triggers, actions, and approvals' },
        ],
      },
      {
        name: 'Describe the Business Value of Power BI',
        weight: 18,
        chapters: [
          {
            name: 'Power BI Components',
            topics: [
              { name: 'Power BI Desktop, Service, and Mobile' },
              { name: 'Reports, dashboards, and datasets' },
              { name: 'Data refresh and gateways' },
            ],
          },
          {
            name: 'Data Visualization',
            topics: [
              { name: 'Building basic visualizations' },
              { name: 'DAX basics and measures' },
              { name: 'Sharing and collaboration' },
            ],
          },
        ],
        topics: [
          { name: 'Power BI components and architecture' },
          { name: 'Reports and dashboards' },
        ],
      },
      {
        name: 'Describe Microsoft Copilot in Power Platform',
        weight: 8,
        chapters: [
          {
            name: 'Copilot Capabilities',
            topics: [
              { name: 'Copilot in Power Apps (app generation from description)' },
              { name: 'Copilot in Power Automate (flow generation)' },
              { name: 'Copilot in Power BI (natural language queries)' },
              { name: 'AI Builder and Copilot Studio' },
            ],
          },
        ],
        topics: [
          { name: 'Copilot across Power Platform' },
          { name: 'AI Builder and Copilot Studio' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'PL-900 is a fundamentals exam covering the Microsoft Power Platform including Power Apps, Power Automate, Power BI, and Copilot capabilities.',
      totalDuration: 45,
      passingScore: 700,
      tips: [
        'Know the difference between canvas apps and model-driven apps.',
        'Understand the three types of cloud flows: automated, instant, scheduled.',
        'Review Microsoft Dataverse and its role in Power Platform.',
        'Be familiar with Power BI components: Desktop, Service, Mobile.',
        'Understand DLP policies and environment management in admin center.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, and hot area. Questions test conceptual understanding of Power Platform components and use cases. No lab simulations.',
  },

  // ─── PL-300 — Power BI Data Analyst ────────────────────────────
  {
    id: 'azure-pl-300',
    vendor: 'Microsoft',
    certName: 'Microsoft Power BI Data Analyst',
    certCode: 'PL-300',
    aliases: [
      /\bpl[\s-]?300\b/i,
      /power\s*bi\s*data\s*analyst/i,
      /power\s*bi\s*analyst/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 100,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area, case studies',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format exam covering data preparation, data modeling, visualization/analysis, and deployment/maintenance with Power BI.',
        timeAllocation: 100,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Prepare the Data',
        weight: 28,
        chapters: [
          {
            name: 'Data Acquisition',
            topics: [
              { name: 'Connect to data sources (SQL, Excel, web, APIs)' },
              { name: 'Power Query Editor' },
              { name: 'Data source settings and parameters' },
            ],
          },
          {
            name: 'Data Transformation',
            topics: [
              { name: 'Data profiling and quality assessment' },
              { name: 'Merge and append queries' },
              { name: 'Data type transformations' },
              { name: 'Pivoting, unpivoting, and grouping' },
              { name: 'M language basics' },
            ],
          },
        ],
        topics: [
          { name: 'Power Query data transformation' },
          { name: 'M language and data profiling' },
        ],
      },
      {
        name: 'Model the Data',
        weight: 32,
        chapters: [
          {
            name: 'Data Model Design',
            topics: [
              { name: 'Star schema design' },
              { name: 'Relationships (cardinality, cross-filter direction)' },
              { name: 'Role-playing dimensions and date tables' },
              { name: 'Data model optimization' },
            ],
          },
          {
            name: 'DAX Calculations',
            topics: [
              { name: 'Calculated columns vs. measures' },
              { name: 'DAX functions (CALCULATE, FILTER, ALL, VALUES)' },
              { name: 'Time intelligence functions (TOTALYTD, SAMEPERIODLASTYEAR)' },
              { name: 'Row context vs. filter context' },
              { name: 'Iterators (SUMX, AVERAGEX)' },
            ],
          },
          {
            name: 'Row-Level Security',
            topics: [
              { name: 'Static and dynamic RLS' },
              { name: 'Testing RLS with different roles' },
            ],
          },
        ],
        topics: [
          { name: 'Star schema and relationships' },
          { name: 'DAX measures and time intelligence' },
          { name: 'Row-level security' },
        ],
      },
      {
        name: 'Visualize and Analyze the Data',
        weight: 28,
        chapters: [
          {
            name: 'Report Design',
            topics: [
              { name: 'Choosing appropriate visualizations' },
              { name: 'Formatting and conditional formatting' },
              { name: 'Slicers, filters, and interactions' },
              { name: 'Bookmarks and drill-through pages' },
            ],
          },
          {
            name: 'Advanced Analytics',
            topics: [
              { name: 'AI visuals (Q&A, Key Influencers, Decomposition Tree)' },
              { name: 'Trend lines, forecasting, and anomaly detection' },
              { name: 'Paginated reports with Report Builder' },
              { name: 'Performance Analyzer' },
            ],
          },
        ],
        topics: [
          { name: 'Visualization design and interactivity' },
          { name: 'AI visuals and advanced analytics' },
        ],
      },
      {
        name: 'Deploy and Maintain Assets',
        weight: 12,
        chapters: [
          {
            name: 'Workspace Management',
            topics: [
              { name: 'Power BI Service workspaces' },
              { name: 'Deployment pipelines' },
              { name: 'App publishing and distribution' },
            ],
          },
          {
            name: 'Data Refresh and Maintenance',
            topics: [
              { name: 'Scheduled refresh and incremental refresh' },
              { name: 'On-premises data gateway configuration' },
              { name: 'Dataset endorsement (promoted, certified)' },
              { name: 'Usage metrics and monitoring' },
            ],
          },
        ],
        topics: [
          { name: 'Deployment pipelines and app publishing' },
          { name: 'Data refresh and gateway configuration' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'PL-300 validates skills as a Power BI Data Analyst including data preparation, modeling with DAX, visualization, and deployment. Data modeling is the largest domain at ~32%.',
      totalDuration: 100,
      passingScore: 700,
      tips: [
        'Data modeling is the largest domain (~32%) -- master DAX and star schema design.',
        'Know the difference between calculated columns and measures, and when to use each.',
        'Practice CALCULATE with filter modifiers (ALL, REMOVEFILTERS, KEEPFILTERS).',
        'Understand Power Query M language for data transformation questions.',
        'Review row-level security configuration (static and dynamic).',
        'Be prepared for case studies requiring end-to-end report design decisions.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, hot area, and case studies with Power BI design scenarios. Questions may include DAX formula completion and data model diagrams.',
  },

  // ─── AB-900 — Microsoft Copilot & Agent Admin Fundamentals ─────
  {
    id: 'azure-ab-900',
    vendor: 'Microsoft',
    certName: 'Microsoft Copilot and Agent Admin Fundamentals',
    certCode: 'AB-900',
    aliases: [
      /\bab[\s-]?900\b/i,
      /copilot\s*(and|&)?\s*agent\s*admin/i,
      /microsoft\s*copilot\s*fundamentals/i,
      /copilot\s*admin\s*fundamentals/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 45,
    questionCountTotal: 50,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'MCQ, drag-and-drop, hot area',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: 'Mixed-format fundamentals exam covering Copilot concepts, agent architecture, and admin fundamentals for Microsoft Copilot and agents.',
        timeAllocation: 45,
        pointWeight: 100,
        questionCount: 50,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 700,
      },
    ],
    subjects: [
      {
        name: 'Copilot Concepts',
        weight: 33,
        chapters: [
          {
            name: 'Introduction to Microsoft Copilot',
            topics: [
              { name: 'What is Microsoft Copilot and how it works' },
              { name: 'Copilot across Microsoft 365 (Word, Excel, Teams, Outlook)' },
              { name: 'Grounding and retrieval-augmented generation (RAG)' },
              { name: 'Responsible AI in Copilot' },
            ],
          },
          {
            name: 'Copilot Capabilities',
            topics: [
              { name: 'Natural language interaction patterns' },
              { name: 'Plugins and connectors for Copilot' },
              { name: 'Microsoft Graph integration' },
              { name: 'Copilot Studio overview' },
            ],
          },
        ],
        topics: [
          { name: 'Microsoft Copilot architecture and RAG' },
          { name: 'Copilot across Microsoft 365' },
        ],
      },
      {
        name: 'Agent Architecture',
        weight: 34,
        chapters: [
          {
            name: 'AI Agent Fundamentals',
            topics: [
              { name: 'What are AI agents and autonomous workflows' },
              { name: 'Agent orchestration and planning' },
              { name: 'Tool use and function calling' },
              { name: 'Memory and context management' },
            ],
          },
          {
            name: 'Building Agents',
            topics: [
              { name: 'Copilot Studio agent builder' },
              { name: 'Custom agents with Azure AI Agent Service' },
              { name: 'Agent triggers and actions' },
              { name: 'Multi-agent collaboration patterns' },
            ],
          },
          {
            name: 'Agent Integration',
            topics: [
              { name: 'Agents in Microsoft 365 ecosystem' },
              { name: 'Agents in Teams and SharePoint' },
              { name: 'Data sources and knowledge bases for agents' },
            ],
          },
        ],
        topics: [
          { name: 'AI agent concepts and orchestration' },
          { name: 'Copilot Studio and Azure AI agents' },
        ],
      },
      {
        name: 'Admin Fundamentals',
        weight: 33,
        chapters: [
          {
            name: 'Copilot Administration',
            topics: [
              { name: 'Licensing and prerequisites for Copilot' },
              { name: 'Microsoft 365 admin center Copilot settings' },
              { name: 'Data security and compliance for Copilot' },
              { name: 'User readiness and adoption' },
            ],
          },
          {
            name: 'Agent Administration',
            topics: [
              { name: 'Agent deployment and lifecycle management' },
              { name: 'Permissions and access control for agents' },
              { name: 'Monitoring agent usage and performance' },
              { name: 'DLP policies for agents' },
            ],
          },
          {
            name: 'Governance and Security',
            topics: [
              { name: 'Data governance for Copilot and agents' },
              { name: 'Sensitivity labels and information barriers' },
              { name: 'Audit logs and compliance reporting' },
              { name: 'Tenant-level controls and policies' },
            ],
          },
        ],
        topics: [
          { name: 'Copilot licensing and admin settings' },
          { name: 'Agent deployment and governance' },
        ],
      },
    ],
    examIntelligence: {
      overview: 'AB-900 is a new fundamentals exam (2026) covering Microsoft Copilot concepts, AI agent architecture, and administration fundamentals for deploying and managing Copilot and agents.',
      totalDuration: 45,
      passingScore: 700,
      tips: [
        'Understand how Copilot uses RAG (retrieval-augmented generation) with Microsoft Graph data.',
        'Know the difference between Copilot (LLM assistant) and agents (autonomous AI workflows).',
        'Review Copilot Studio for building custom agents and Copilot extensions.',
        'Understand licensing requirements and admin center configurations for Copilot.',
        'Be familiar with data governance: sensitivity labels, DLP, and information barriers.',
        'This is a brand new exam for 2026 -- focus on official Microsoft Learn modules.',
      ],
    },
    questionStyle: 'Multiple choice, multiple answer, drag-and-drop, and hot area. Questions test conceptual understanding of Copilot and agent concepts, architecture, and administration. No lab simulations.',
  },
]
