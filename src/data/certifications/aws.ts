/**
 * AWS Certification catalog — 12 active certifications as of April 2026.
 */
import type { CertificationEntry } from './types'

export const AWS_CERTS: CertificationEntry[] = [
  // ═══════════════════════════════════════════════════════════════
  // FOUNDATIONAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'aws-clf-c02',
    vendor: 'AWS',
    certName: 'AWS Certified Cloud Practitioner',
    certCode: 'CLF-C02',
    aliases: [
      /clf-?c?0?2/i,
      /\bclf\b/i,
      /cloud\s*practitioner/i,
      /aws\s+cp\b/i,
      /aws\s+ccp\b/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 90,
    questionCountTotal: 65,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'Multiple choice (single and multiple response)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 multiple-choice and multiple-response questions in 90 minutes',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Cloud Concepts',
        weight: 24,
        topics: [
          { name: 'Benefits of the AWS Cloud' },
          { name: 'AWS Cloud design principles' },
          { name: 'Migration strategies' },
          { name: 'Cloud economics and cost optimization concepts' },
        ],
        chapters: [
          {
            name: 'Cloud Value Proposition',
            topics: [
              { name: 'Six advantages of cloud computing' },
              { name: 'Cloud adoption strategies (6 Rs)' },
              { name: 'On-premises vs cloud total cost of ownership' },
            ],
          },
          {
            name: 'Cloud Architecture Principles',
            topics: [
              { name: 'AWS Well-Architected Framework pillars' },
              { name: 'High availability and fault tolerance' },
              { name: 'Elasticity and scalability' },
              { name: 'Loose coupling and design for failure' },
            ],
          },
          {
            name: 'Cloud Deployment and Operation Models',
            topics: [
              { name: 'Public, private, and hybrid cloud' },
              { name: 'IaaS, PaaS, SaaS models' },
              { name: 'AWS Global Infrastructure (Regions, AZs, Edge)' },
            ],
          },
        ],
      },
      {
        name: 'Security and Compliance',
        weight: 30,
        topics: [
          { name: 'AWS Shared Responsibility Model' },
          { name: 'Security, governance, and compliance concepts' },
          { name: 'AWS access management' },
          { name: 'Security support resources' },
        ],
        chapters: [
          {
            name: 'Shared Responsibility and Compliance',
            topics: [
              { name: 'Shared Responsibility Model (customer vs AWS)' },
              { name: 'AWS compliance programs (SOC, PCI-DSS, HIPAA)' },
              { name: 'AWS Artifact and compliance reports' },
            ],
          },
          {
            name: 'Identity and Access Management',
            topics: [
              { name: 'IAM users, groups, roles, and policies' },
              { name: 'Root account security and MFA' },
              { name: 'Principle of least privilege' },
              { name: 'AWS IAM Identity Center (SSO)' },
            ],
          },
          {
            name: 'Security Services and Tools',
            topics: [
              { name: 'AWS Shield, WAF, and Firewall Manager' },
              { name: 'Amazon Inspector, GuardDuty, Macie' },
              { name: 'AWS Security Hub and CloudTrail' },
              { name: 'KMS and encryption fundamentals' },
            ],
          },
        ],
      },
      {
        name: 'Cloud Technology and Services',
        weight: 34,
        topics: [
          { name: 'Deploying and operating in the AWS Cloud' },
          { name: 'AWS Global Infrastructure' },
          { name: 'AWS compute, storage, networking, and database services' },
          { name: 'AWS AI/ML and analytics services' },
        ],
        chapters: [
          {
            name: 'Compute and Networking',
            topics: [
              { name: 'EC2 instance types, pricing, and launch' },
              { name: 'Lambda, ECS, and Fargate' },
              { name: 'Elastic Load Balancing and Auto Scaling' },
              { name: 'VPC, subnets, route tables, and gateways' },
              { name: 'Route 53 and CloudFront' },
            ],
          },
          {
            name: 'Storage and Databases',
            topics: [
              { name: 'S3 storage classes and lifecycle policies' },
              { name: 'EBS, EFS, and FSx' },
              { name: 'RDS, Aurora, and DynamoDB' },
              { name: 'ElastiCache and Redshift' },
            ],
          },
          {
            name: 'Management, Monitoring, and Developer Tools',
            topics: [
              { name: 'CloudWatch, CloudTrail, and Config' },
              { name: 'CloudFormation and Elastic Beanstalk' },
              { name: 'Systems Manager and Trusted Advisor' },
              { name: 'AWS CLI, SDK, and Management Console' },
            ],
          },
        ],
      },
      {
        name: 'Billing, Pricing, and Support',
        weight: 12,
        topics: [
          { name: 'AWS pricing models' },
          { name: 'Billing, budgets, and cost management' },
          { name: 'AWS Support plans and resources' },
        ],
        chapters: [
          {
            name: 'Pricing and Cost Management',
            topics: [
              { name: 'On-Demand, Reserved, Spot, and Savings Plans' },
              { name: 'AWS Free Tier' },
              { name: 'AWS Cost Explorer, Budgets, and Cost Anomaly Detection' },
              { name: 'AWS Pricing Calculator' },
            ],
          },
          {
            name: 'Support and Account Management',
            topics: [
              { name: 'AWS Support plans (Basic, Developer, Business, Enterprise)' },
              { name: 'AWS Organizations and consolidated billing' },
              { name: 'AWS Marketplace' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Cloud Practitioner (CLF-C02) is an entry-level exam validating overall understanding of the AWS Cloud. It covers cloud concepts, security, core services, and pricing. This exam is suitable for non-technical roles and beginners seeking foundational AWS knowledge.',
      totalDuration: 90,
      passingScore: 70,
      tips: [
        'Focus on the Shared Responsibility Model — it appears in many questions.',
        'Know the core services (EC2, S3, RDS, Lambda, VPC) and their primary use cases.',
        'Understand the difference between AWS Support plans.',
        'Learn the six advantages of cloud computing and the Well-Architected pillars.',
        'Pricing questions are common — know On-Demand vs Reserved vs Spot vs Savings Plans.',
      ],
    },
    questionStyle: 'AWS Cloud Practitioner questions are straightforward scenario-based multiple-choice items. Each question presents a brief scenario or direct question about AWS cloud concepts, services, or pricing, and asks the candidate to select the BEST answer or the TWO correct answers. Questions test breadth of knowledge rather than deep technical implementation. Use clear, concise language appropriate for someone new to AWS. Distractors should be plausible AWS services or concepts that do not fit the described use case.',
  },

  {
    id: 'aws-aif-c01',
    vendor: 'AWS',
    certName: 'AWS Certified AI Practitioner',
    certCode: 'AIF-C01',
    aliases: [
      /aif-?c?0?1/i,
      /\baif\b/i,
      /ai\s*practitioner/i,
      /aws\s+ai\s+practitioner/i,
    ],
    passingThresholdPercent: 70,
    totalDurationMinutes: 90,
    questionCountTotal: 65,
    scoringScale: { passing: 700, max: 1000 },
    questionTypes: 'Multiple choice (single and multiple response)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 multiple-choice and multiple-response questions in 90 minutes',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'AI and ML Fundamentals',
        weight: 20,
        topics: [
          { name: 'Basic AI/ML concepts and terminology' },
          { name: 'Types of machine learning (supervised, unsupervised, reinforcement)' },
          { name: 'ML development lifecycle' },
          { name: 'AWS AI/ML service landscape' },
        ],
        chapters: [
          {
            name: 'Machine Learning Foundations',
            topics: [
              { name: 'Supervised, unsupervised, and reinforcement learning' },
              { name: 'Training, validation, and test datasets' },
              { name: 'Model evaluation metrics (accuracy, precision, recall, F1)' },
            ],
          },
          {
            name: 'AWS AI/ML Services Overview',
            topics: [
              { name: 'SageMaker for model training and deployment' },
              { name: 'Rekognition, Comprehend, Translate, Polly, Transcribe' },
              { name: 'Amazon Personalize and Forecast' },
              { name: 'Amazon Textract and Kendra' },
            ],
          },
        ],
      },
      {
        name: 'Generative AI Fundamentals',
        weight: 24,
        topics: [
          { name: 'Generative AI concepts and foundation models' },
          { name: 'Large language models and transformers' },
          { name: 'Prompt engineering basics' },
          { name: 'Amazon Bedrock overview' },
        ],
        chapters: [
          {
            name: 'Foundation Models and LLMs',
            topics: [
              { name: 'Transformer architecture basics' },
              { name: 'Pre-training, fine-tuning, and transfer learning' },
              { name: 'Tokens, context windows, and model parameters' },
              { name: 'Diffusion models and multi-modal models' },
            ],
          },
          {
            name: 'Prompt Engineering',
            topics: [
              { name: 'Zero-shot, few-shot, and chain-of-thought prompting' },
              { name: 'Prompt templates and structured outputs' },
              { name: 'Temperature, top-p, and inference parameters' },
            ],
          },
        ],
      },
      {
        name: 'Applications of Foundation Models',
        weight: 28,
        topics: [
          { name: 'Designing generative AI applications' },
          { name: 'Amazon Bedrock and model selection' },
          { name: 'RAG (Retrieval-Augmented Generation)' },
          { name: 'Agents and function calling' },
        ],
        chapters: [
          {
            name: 'Building with Amazon Bedrock',
            topics: [
              { name: 'Model providers and selection criteria' },
              { name: 'Bedrock APIs and inference endpoints' },
              { name: 'Knowledge Bases for RAG' },
              { name: 'Bedrock Agents for task orchestration' },
            ],
          },
          {
            name: 'Application Design Patterns',
            topics: [
              { name: 'Text generation, summarization, and classification' },
              { name: 'Code generation and analysis' },
              { name: 'Image generation with Stable Diffusion and Titan' },
              { name: 'Embedding models and semantic search' },
            ],
          },
        ],
      },
      {
        name: 'Guidelines for Responsible AI',
        weight: 14,
        topics: [
          { name: 'Responsible AI principles' },
          { name: 'Fairness, bias detection, and mitigation' },
          { name: 'Transparency and explainability' },
        ],
        chapters: [
          {
            name: 'Responsible AI Practices',
            topics: [
              { name: 'Bias detection and mitigation strategies' },
              { name: 'Model explainability tools (SageMaker Clarify)' },
              { name: 'Human-in-the-loop design patterns' },
              { name: 'Content moderation and guardrails' },
            ],
          },
        ],
      },
      {
        name: 'Security and Compliance for AI Solutions',
        weight: 14,
        topics: [
          { name: 'Data privacy and governance for AI' },
          { name: 'Securing AI workloads on AWS' },
          { name: 'Compliance considerations for AI/ML' },
        ],
        chapters: [
          {
            name: 'AI Security and Governance',
            topics: [
              { name: 'Data encryption and access control for AI workloads' },
              { name: 'Bedrock Guardrails for content filtering' },
              { name: 'Model access control and VPC endpoints' },
              { name: 'Regulatory compliance for AI (GDPR, AI Act considerations)' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS AI Practitioner (AIF-C01) validates foundational understanding of AI/ML concepts, generative AI, foundation models, and responsible AI on AWS. It is aimed at individuals in any role who want to demonstrate knowledge of AI/ML technologies and their AWS implementations.',
      totalDuration: 90,
      passingScore: 70,
      tips: [
        'Understand the differences between supervised, unsupervised, and reinforcement learning.',
        'Know Amazon Bedrock capabilities — model selection, Knowledge Bases, Agents, and Guardrails.',
        'Learn prompt engineering techniques: zero-shot, few-shot, chain-of-thought.',
        'RAG (Retrieval-Augmented Generation) is a major topic — understand when and why to use it.',
        'Responsible AI questions focus on bias, fairness, transparency, and human oversight.',
      ],
    },
    questionStyle: 'AWS AI Practitioner questions present scenarios involving AI/ML use cases and ask which AWS service, technique, or approach is BEST suited. Questions cover conceptual understanding of machine learning types, generative AI foundations, Amazon Bedrock capabilities, and responsible AI practices. Distractors are plausible AWS AI/ML services or ML concepts that do not match the scenario. Questions test breadth of AI knowledge rather than deep implementation details.',
  },

  // ═══════════════════════════════════════════════════════════════
  // ASSOCIATE
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'aws-saa-c03',
    vendor: 'AWS',
    certName: 'AWS Certified Solutions Architect - Associate',
    certCode: 'SAA-C03',
    aliases: [
      /saa-?c?0?3/i,
      /\bsaa\b/i,
      /solutions?\s*architect\s*associate/i,
      /aws\s+sa\s+associate/i,
    ],
    passingThresholdPercent: 72,
    totalDurationMinutes: 130,
    questionCountTotal: 65,
    scoringScale: { passing: 720, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 scenario-based multiple-choice and multiple-response questions in 130 minutes',
        timeAllocation: 130,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Design Secure Architectures',
        weight: 30,
        topics: [
          { name: 'Secure access to AWS resources' },
          { name: 'Secure workloads and applications' },
          { name: 'Data security controls' },
        ],
        chapters: [
          {
            name: 'Secure Access to AWS Resources',
            topics: [
              { name: 'IAM users, groups, roles, and policies' },
              { name: 'Multi-account strategies with AWS Organizations' },
              { name: 'Federation and IAM Identity Center (SSO)' },
              { name: 'Resource-based vs identity-based policies' },
              { name: 'Cross-account access patterns' },
            ],
          },
          {
            name: 'Secure Workloads and Applications',
            topics: [
              { name: 'VPC security groups and NACLs' },
              { name: 'AWS WAF, Shield, and Firewall Manager' },
              { name: 'Endpoint policies and PrivateLink' },
              { name: 'API Gateway authorization and throttling' },
            ],
          },
          {
            name: 'Data Security Controls',
            topics: [
              { name: 'Encryption at rest and in transit (KMS, ACM)' },
              { name: 'Secrets Manager and Parameter Store' },
              { name: 'S3 bucket policies, ACLs, and encryption' },
              { name: 'CloudTrail and Config for audit and compliance' },
            ],
          },
        ],
      },
      {
        name: 'Design Resilient Architectures',
        weight: 26,
        topics: [
          { name: 'Scalable and loosely coupled architectures' },
          { name: 'Highly available and fault-tolerant architectures' },
        ],
        chapters: [
          {
            name: 'Scalable and Loosely Coupled Architectures',
            topics: [
              { name: 'Elastic Load Balancing (ALB, NLB, GLB)' },
              { name: 'Auto Scaling groups and policies' },
              { name: 'SQS, SNS, and EventBridge for decoupling' },
              { name: 'Amazon Kinesis for real-time data streaming' },
            ],
          },
          {
            name: 'High Availability and Fault Tolerance',
            topics: [
              { name: 'Multi-AZ and Multi-Region architecture patterns' },
              { name: 'RDS Multi-AZ, Aurora replicas, and Global Database' },
              { name: 'Route 53 health checks and failover routing' },
              { name: 'S3 Cross-Region Replication' },
              { name: 'Disaster recovery strategies (Pilot Light, Warm Standby, Active-Active)' },
            ],
          },
        ],
      },
      {
        name: 'Design High-Performing Architectures',
        weight: 24,
        topics: [
          { name: 'High-performing storage solutions' },
          { name: 'High-performing compute solutions' },
          { name: 'High-performing database solutions' },
          { name: 'High-performing network architectures' },
        ],
        chapters: [
          {
            name: 'Compute and Networking Performance',
            topics: [
              { name: 'EC2 instance types and placement groups' },
              { name: 'Lambda concurrency and performance tuning' },
              { name: 'CloudFront distributions and edge caching' },
              { name: 'Global Accelerator and Transit Gateway' },
            ],
          },
          {
            name: 'Storage and Database Performance',
            topics: [
              { name: 'EBS volume types (gp3, io2, st1)' },
              { name: 'S3 Transfer Acceleration and multi-part uploads' },
              { name: 'DynamoDB capacity modes, DAX, and Global Tables' },
              { name: 'ElastiCache (Redis/Memcached) for caching layers' },
              { name: 'Aurora Serverless and read replicas' },
            ],
          },
        ],
      },
      {
        name: 'Design Cost-Optimized Architectures',
        weight: 20,
        topics: [
          { name: 'Cost-effective storage solutions' },
          { name: 'Cost-effective compute and database services' },
          { name: 'Cost-optimized network architectures' },
        ],
        chapters: [
          {
            name: 'Cost-Effective Compute and Pricing',
            topics: [
              { name: 'EC2 pricing models (On-Demand, Reserved, Spot, Savings Plans)' },
              { name: 'Right-sizing and Compute Optimizer' },
              { name: 'Serverless architecture cost benefits (Lambda, Fargate)' },
            ],
          },
          {
            name: 'Cost-Effective Storage and Data Transfer',
            topics: [
              { name: 'S3 storage classes and Intelligent-Tiering' },
              { name: 'S3 Lifecycle policies and Glacier retrieval options' },
              { name: 'Data transfer costs and VPC endpoints' },
              { name: 'AWS Cost Explorer, Budgets, and anomaly detection' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Solutions Architect Associate (SAA-C03) is the most popular AWS certification. It validates the ability to design well-architected, secure, resilient, high-performing, and cost-optimized solutions on AWS. Questions are heavily scenario-based and require selecting the BEST solution from multiple valid-sounding options.',
      totalDuration: 130,
      passingScore: 72,
      tips: [
        'Read each scenario carefully — the key constraint (cost, performance, resilience) determines the correct answer.',
        'Know when to use ALB vs NLB vs GLB and which layer they operate on.',
        'Multi-AZ vs Multi-Region is a frequent decision point — know the trade-offs.',
        'S3 storage classes appear often — know when to use Standard, IA, One Zone-IA, Glacier, and Deep Archive.',
        'Understand serverless patterns: API Gateway + Lambda + DynamoDB.',
        'DynamoDB partition keys, sort keys, GSIs, and DAX are heavily tested.',
      ],
    },
    questionStyle: 'AWS Solutions Architect Associate questions present a detailed business scenario (3-5 sentences) describing a company\'s workload, requirements, and constraints. The question asks "which solution meets these requirements" or "which is the MOST cost-effective/resilient/secure approach." Options present four plausible AWS architectures using real service names and configurations. The correct answer satisfies ALL stated requirements while the distractors each violate at least one constraint (cost, performance, operational overhead, or security). Scenarios should reference specific AWS services, instance types, and architectural patterns.',
  },

  {
    id: 'aws-dva-c02',
    vendor: 'AWS',
    certName: 'AWS Certified Developer - Associate',
    certCode: 'DVA-C02',
    aliases: [
      /dva-?c?0?2/i,
      /\bdva\b/i,
      /developer\s*associate/i,
      /aws\s+dev\s+associate/i,
    ],
    passingThresholdPercent: 72,
    totalDurationMinutes: 130,
    questionCountTotal: 65,
    scoringScale: { passing: 720, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 scenario-based multiple-choice and multiple-response questions in 130 minutes',
        timeAllocation: 130,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Development with AWS Services',
        weight: 32,
        topics: [
          { name: 'Develop code for applications hosted on AWS' },
          { name: 'Develop code for AWS Lambda' },
          { name: 'Use data stores in application development' },
        ],
        chapters: [
          {
            name: 'Serverless Application Development',
            topics: [
              { name: 'Lambda function handlers, events, and context' },
              { name: 'Lambda layers, versions, and aliases' },
              { name: 'API Gateway REST and HTTP APIs' },
              { name: 'Step Functions for orchestration' },
              { name: 'EventBridge and SQS event-driven patterns' },
            ],
          },
          {
            name: 'Application Data Storage',
            topics: [
              { name: 'DynamoDB CRUD, queries, scans, and indexes (GSI/LSI)' },
              { name: 'S3 SDK operations and presigned URLs' },
              { name: 'ElastiCache integration patterns' },
              { name: 'RDS and Aurora connection management' },
            ],
          },
          {
            name: 'Container and Compute Development',
            topics: [
              { name: 'ECS task definitions and Fargate' },
              { name: 'ECR image management' },
              { name: 'Elastic Beanstalk deployments and configurations' },
            ],
          },
        ],
      },
      {
        name: 'Security',
        weight: 26,
        topics: [
          { name: 'Authentication and authorization in applications' },
          { name: 'Encryption using AWS services' },
          { name: 'Application secrets management' },
        ],
        chapters: [
          {
            name: 'Application Authentication and Authorization',
            topics: [
              { name: 'Amazon Cognito User Pools and Identity Pools' },
              { name: 'IAM roles for applications (instance profiles, execution roles)' },
              { name: 'API Gateway authorizers (Lambda, Cognito, IAM)' },
              { name: 'STS AssumeRole and temporary credentials' },
            ],
          },
          {
            name: 'Data Protection in Applications',
            topics: [
              { name: 'KMS encryption in SDK calls' },
              { name: 'Secrets Manager and Parameter Store in code' },
              { name: 'S3 server-side and client-side encryption' },
              { name: 'Certificate-based authentication with ACM' },
            ],
          },
        ],
      },
      {
        name: 'Deployment',
        weight: 24,
        topics: [
          { name: 'Prepare application artifacts for deployment' },
          { name: 'Test applications in development environments' },
          { name: 'Automate deployment testing' },
        ],
        chapters: [
          {
            name: 'CI/CD Pipelines',
            topics: [
              { name: 'CodeCommit, CodeBuild, CodeDeploy, CodePipeline' },
              { name: 'SAM (Serverless Application Model) templates and CLI' },
              { name: 'CloudFormation stack operations and nested stacks' },
              { name: 'CDK constructs and synthesization' },
            ],
          },
          {
            name: 'Deployment Strategies',
            topics: [
              { name: 'Blue/green deployments with CodeDeploy' },
              { name: 'Canary and linear Lambda deployment preferences' },
              { name: 'Rolling deployments with Elastic Beanstalk' },
              { name: 'Feature flags and A/B testing with AppConfig' },
            ],
          },
        ],
      },
      {
        name: 'Troubleshooting and Optimization',
        weight: 18,
        topics: [
          { name: 'Root cause analysis for application issues' },
          { name: 'Observability for applications' },
          { name: 'Optimize applications using AWS services' },
        ],
        chapters: [
          {
            name: 'Observability and Debugging',
            topics: [
              { name: 'CloudWatch Logs, Metrics, and Alarms' },
              { name: 'X-Ray tracing for distributed applications' },
              { name: 'CloudWatch Logs Insights queries' },
              { name: 'Lambda error handling and dead-letter queues' },
            ],
          },
          {
            name: 'Performance Optimization',
            topics: [
              { name: 'Lambda memory/timeout tuning and cold starts' },
              { name: 'DynamoDB read/write capacity optimization' },
              { name: 'API Gateway caching and throttling' },
              { name: 'SQS batch processing and visibility timeout' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Developer Associate (DVA-C02) validates the ability to develop, deploy, debug, and optimize cloud-based applications on AWS. It focuses heavily on serverless development (Lambda, API Gateway, DynamoDB), CI/CD pipelines, and application security with Cognito and IAM.',
      totalDuration: 130,
      passingScore: 72,
      tips: [
        'Lambda is the most-tested service — know execution model, layers, versions, aliases, and error handling.',
        'DynamoDB is critical — understand partition keys, GSI/LSI, capacity modes, and DynamoDB Streams.',
        'Know the full CI/CD pipeline: CodeCommit -> CodeBuild -> CodeDeploy -> CodePipeline.',
        'Cognito User Pools (authentication) vs Identity Pools (authorization) is a key distinction.',
        'X-Ray tracing and CloudWatch Logs Insights are frequently tested for debugging scenarios.',
        'Understand SAM templates and the `sam deploy` workflow.',
      ],
    },
    questionStyle: 'AWS Developer Associate questions present a development scenario where a developer is building or troubleshooting an AWS application. Questions typically involve Lambda functions, API Gateway endpoints, DynamoDB tables, or CI/CD pipelines. The question asks which code change, configuration, or AWS service integration BEST solves the problem. Options reference specific SDK calls, IAM permissions, service configurations, and deployment settings. Scenarios may include code snippets or error messages that the candidate must diagnose.',
  },

  {
    id: 'aws-soa-c03',
    vendor: 'AWS',
    certName: 'AWS Certified CloudOps Engineer - Associate',
    certCode: 'SOA-C03',
    aliases: [
      /soa-?c?0?3/i,
      /\bsoa\b/i,
      /cloudops\s*engineer/i,
      /sysops\s*admin/i,
      /sysops\s*associate/i,
      /aws\s+sysops/i,
      /aws\s+cloudops/i,
    ],
    passingThresholdPercent: 72,
    totalDurationMinutes: 130,
    questionCountTotal: 65,
    scoringScale: { passing: 720, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 scenario-based multiple-choice and multiple-response questions in 130 minutes',
        timeAllocation: 130,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Monitoring, Logging, Remediation, and Performance',
        weight: 22,
        topics: [
          { name: 'Implement metrics, alarms, and filters using AWS monitoring services' },
          { name: 'Remediate issues based on monitoring and availability' },
          { name: 'Performance and availability metrics' },
        ],
        chapters: [
          {
            name: 'Monitoring and Alerting',
            topics: [
              { name: 'CloudWatch metrics, custom metrics, and dashboards' },
              { name: 'CloudWatch Alarms and composite alarms' },
              { name: 'CloudWatch Logs, log groups, and metric filters' },
              { name: 'EventBridge rules for automated remediation' },
            ],
          },
          {
            name: 'Remediation and Performance',
            topics: [
              { name: 'Auto Scaling policies (target tracking, step, scheduled)' },
              { name: 'EC2 instance health checks and recovery' },
              { name: 'RDS performance insights and slow query logs' },
              { name: 'Systems Manager Automation runbooks' },
            ],
          },
        ],
      },
      {
        name: 'Reliability and Business Continuity',
        weight: 22,
        topics: [
          { name: 'Implement scalability and elasticity' },
          { name: 'Implement high availability and resilient environments' },
          { name: 'Implement backup and restore strategies' },
        ],
        chapters: [
          {
            name: 'High Availability Strategies',
            topics: [
              { name: 'Multi-AZ deployments for RDS, ElastiCache, and EFS' },
              { name: 'Auto Scaling group configurations and health checks' },
              { name: 'Elastic Load Balancer health checks and cross-zone balancing' },
              { name: 'Route 53 failover routing and health checks' },
            ],
          },
          {
            name: 'Backup and Disaster Recovery',
            topics: [
              { name: 'AWS Backup plans, vaults, and policies' },
              { name: 'EBS snapshots and AMI management' },
              { name: 'RDS automated backups and point-in-time recovery' },
              { name: 'S3 versioning and Cross-Region Replication' },
            ],
          },
        ],
      },
      {
        name: 'Deployment, Provisioning, and Automation',
        weight: 22,
        topics: [
          { name: 'Provision and maintain cloud resources' },
          { name: 'Automate manual or repeatable processes' },
        ],
        chapters: [
          {
            name: 'Infrastructure Provisioning',
            topics: [
              { name: 'CloudFormation templates, stacks, and stack sets' },
              { name: 'CloudFormation drift detection and change sets' },
              { name: 'EC2 launch templates and user data scripts' },
              { name: 'AMI creation and golden image pipelines (EC2 Image Builder)' },
            ],
          },
          {
            name: 'Automation and Configuration Management',
            topics: [
              { name: 'Systems Manager (Run Command, Patch Manager, State Manager)' },
              { name: 'Systems Manager Parameter Store and Automation' },
              { name: 'AWS Config rules and remediation actions' },
              { name: 'OpsWorks and Elastic Beanstalk lifecycle management' },
            ],
          },
        ],
      },
      {
        name: 'Security and Compliance',
        weight: 16,
        topics: [
          { name: 'Implement and manage security and compliance policies' },
          { name: 'Implement data and infrastructure protection strategies' },
        ],
        chapters: [
          {
            name: 'Operational Security',
            topics: [
              { name: 'IAM policies, permission boundaries, and SCPs' },
              { name: 'CloudTrail for API auditing' },
              { name: 'AWS Config compliance rules' },
              { name: 'GuardDuty, Security Hub, and Inspector findings' },
            ],
          },
          {
            name: 'Data Protection',
            topics: [
              { name: 'KMS key management and key policies' },
              { name: 'S3 bucket policies and public access blocks' },
              { name: 'EBS and RDS encryption' },
              { name: 'VPC flow logs and traffic analysis' },
            ],
          },
        ],
      },
      {
        name: 'Networking and Content Delivery',
        weight: 18,
        topics: [
          { name: 'Implement networking features and connectivity' },
          { name: 'Configure domains, DNS services, and content delivery' },
          { name: 'Troubleshoot network connectivity issues' },
        ],
        chapters: [
          {
            name: 'VPC Networking',
            topics: [
              { name: 'VPC subnets, route tables, and NAT gateways' },
              { name: 'VPC peering and Transit Gateway' },
              { name: 'VPC endpoints (Gateway and Interface)' },
              { name: 'Network troubleshooting (flow logs, Reachability Analyzer)' },
            ],
          },
          {
            name: 'DNS and Content Delivery',
            topics: [
              { name: 'Route 53 record types and routing policies' },
              { name: 'CloudFront distributions and behaviors' },
              { name: 'ACM certificate management for HTTPS' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS CloudOps Engineer Associate (SOA-C03, formerly SysOps Administrator) validates the ability to deploy, manage, operate, and troubleshoot AWS workloads. It is the most operations-focused associate cert, emphasizing monitoring, automation, security, and networking.',
      totalDuration: 130,
      passingScore: 72,
      tips: [
        'CloudWatch is central — know metrics, alarms, dashboards, Logs Insights, and metric filters.',
        'Systems Manager is heavily tested: Run Command, Patch Manager, State Manager, Automation.',
        'CloudFormation questions are common — understand stack operations, drift detection, and change sets.',
        'Know AWS Backup plans and RDS backup/restore procedures.',
        'VPC networking is critical — subnets, route tables, NAT, peering, endpoints, and flow logs.',
        'Auto Scaling policies (target tracking vs step) and scaling behaviors appear frequently.',
      ],
    },
    questionStyle: 'AWS CloudOps Engineer Associate questions describe an operational scenario where a systems administrator must deploy, monitor, secure, or troubleshoot an AWS environment. Questions ask which AWS service, configuration, or operational procedure BEST addresses the issue with MINIMAL operational overhead. Scenarios involve CloudWatch alarms, Systems Manager operations, CloudFormation deployments, networking issues, or security compliance requirements. Options reference specific service features and configurations.',
  },

  {
    id: 'aws-dea-c01',
    vendor: 'AWS',
    certName: 'AWS Certified Data Engineer - Associate',
    certCode: 'DEA-C01',
    aliases: [
      /dea-?c?0?1/i,
      /\bdea\b/i,
      /data\s*engineer\s*associate/i,
      /aws\s+data\s+engineer/i,
    ],
    passingThresholdPercent: 72,
    totalDurationMinutes: 130,
    questionCountTotal: 65,
    scoringScale: { passing: 720, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 scenario-based multiple-choice and multiple-response questions in 130 minutes',
        timeAllocation: 130,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Data Ingestion and Transformation',
        weight: 34,
        topics: [
          { name: 'Choose appropriate data ingestion services' },
          { name: 'Transform and process data' },
          { name: 'Orchestrate data pipelines' },
        ],
        chapters: [
          {
            name: 'Data Ingestion Patterns',
            topics: [
              { name: 'Kinesis Data Streams and Kinesis Data Firehose' },
              { name: 'AWS Database Migration Service (DMS)' },
              { name: 'AWS Transfer Family and DataSync' },
              { name: 'Amazon AppFlow for SaaS integrations' },
              { name: 'Batch vs real-time ingestion trade-offs' },
            ],
          },
          {
            name: 'Data Transformation',
            topics: [
              { name: 'AWS Glue ETL jobs (Spark and Python shell)' },
              { name: 'Glue DataBrew for visual data preparation' },
              { name: 'EMR (Spark, Hive, Presto) for large-scale processing' },
              { name: 'Lambda for lightweight transformations' },
            ],
          },
          {
            name: 'Pipeline Orchestration',
            topics: [
              { name: 'Step Functions for workflow orchestration' },
              { name: 'Glue Workflows and triggers' },
              { name: 'Amazon MWAA (Managed Apache Airflow)' },
              { name: 'EventBridge for event-driven pipelines' },
            ],
          },
        ],
      },
      {
        name: 'Data Store Management',
        weight: 26,
        topics: [
          { name: 'Choose appropriate data stores' },
          { name: 'Design data models and schema evolution' },
          { name: 'Manage data lifecycle' },
        ],
        chapters: [
          {
            name: 'Data Lake and Storage',
            topics: [
              { name: 'S3 as a data lake foundation (partitioning, formats)' },
              { name: 'Data formats: Parquet, ORC, Avro, JSON' },
              { name: 'Lake Formation for data lake governance' },
              { name: 'S3 lifecycle policies and storage classes' },
            ],
          },
          {
            name: 'Databases and Data Warehouses',
            topics: [
              { name: 'Redshift architecture, distribution styles, and sort keys' },
              { name: 'DynamoDB for key-value and document workloads' },
              { name: 'RDS and Aurora for relational workloads' },
              { name: 'OpenSearch for search and log analytics' },
            ],
          },
          {
            name: 'Data Catalog and Schema Management',
            topics: [
              { name: 'Glue Data Catalog and crawlers' },
              { name: 'Schema Registry for streaming data' },
              { name: 'Athena for ad-hoc querying' },
            ],
          },
        ],
      },
      {
        name: 'Data Operations and Support',
        weight: 22,
        topics: [
          { name: 'Automate data processing and pipeline operations' },
          { name: 'Maintain and monitor data pipelines' },
          { name: 'Ensure data quality' },
        ],
        chapters: [
          {
            name: 'Pipeline Operations and Monitoring',
            topics: [
              { name: 'Glue job bookmarks and error handling' },
              { name: 'CloudWatch metrics and alarms for data pipelines' },
              { name: 'Glue Data Quality rules and checks' },
              { name: 'Cost optimization for EMR and Redshift' },
            ],
          },
          {
            name: 'Data Quality and Observability',
            topics: [
              { name: 'Data validation and completeness checks' },
              { name: 'Glue Data Quality transforms' },
              { name: 'Dead-letter queues for failed records' },
              { name: 'Data lineage and cataloging' },
            ],
          },
        ],
      },
      {
        name: 'Data Security and Governance',
        weight: 18,
        topics: [
          { name: 'Apply authentication and authorization mechanisms' },
          { name: 'Apply data governance and compliance' },
          { name: 'Encrypt and mask data' },
        ],
        chapters: [
          {
            name: 'Data Access Control',
            topics: [
              { name: 'Lake Formation permissions and column-level security' },
              { name: 'IAM policies for data services' },
              { name: 'Redshift role-based access and row-level security' },
              { name: 'S3 bucket policies and access points' },
            ],
          },
          {
            name: 'Data Protection and Compliance',
            topics: [
              { name: 'Encryption at rest (KMS, S3 SSE, Redshift encryption)' },
              { name: 'Data masking and tokenization' },
              { name: 'PII detection with Macie and Comprehend' },
              { name: 'CloudTrail auditing for data access' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Data Engineer Associate (DEA-C01) validates the ability to design, build, and manage data pipelines on AWS. It focuses on data ingestion (Kinesis, DMS, Glue), transformation (Glue ETL, EMR), storage (S3 data lake, Redshift), and governance (Lake Formation). This exam emphasizes practical data engineering scenarios.',
      totalDuration: 130,
      passingScore: 72,
      tips: [
        'Glue is the most-tested service — know ETL jobs, crawlers, Data Catalog, bookmarks, and Data Quality.',
        'Understand when to use Kinesis Data Streams vs Kinesis Data Firehose vs MSK.',
        'Know S3 data lake patterns: partitioning strategies, Parquet/ORC formats, and lifecycle policies.',
        'Redshift distribution styles (KEY, EVEN, ALL) and sort keys are frequently tested.',
        'Lake Formation permissions model is important for governance questions.',
        'Understand the difference between batch and streaming data pipeline architectures.',
      ],
    },
    questionStyle: 'AWS Data Engineer Associate questions describe a data engineering scenario involving data ingestion, transformation, storage, or governance. The question asks which combination of AWS services and configurations BEST implements the data pipeline with the stated requirements (latency, cost, durability, compliance). Options reference specific service features like Kinesis shard counts, Glue job types, Redshift distribution styles, or S3 storage classes. Scenarios often involve choosing between batch and streaming approaches.',
  },

  {
    id: 'aws-mla-c01',
    vendor: 'AWS',
    certName: 'AWS Certified Machine Learning Engineer - Associate',
    certCode: 'MLA-C01',
    aliases: [
      /mla-?c?0?1/i,
      /\bmla\b/i,
      /machine\s*learning\s*engineer\s*associate/i,
      /aws\s+ml\s+engineer/i,
      /aws\s+mle\b/i,
    ],
    passingThresholdPercent: 72,
    totalDurationMinutes: 170,
    questionCountTotal: 65,
    scoringScale: { passing: 720, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 scenario-based multiple-choice and multiple-response questions in 170 minutes',
        timeAllocation: 170,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Data Preparation for ML',
        weight: 28,
        topics: [
          { name: 'Ingest and store ML data' },
          { name: 'Transform data and perform feature engineering' },
          { name: 'Ensure data quality and compliance' },
        ],
        chapters: [
          {
            name: 'Data Ingestion and Storage for ML',
            topics: [
              { name: 'S3 data lake as ML data source' },
              { name: 'SageMaker Feature Store (online and offline)' },
              { name: 'Data Wrangler for data preparation' },
              { name: 'Athena and Glue for ML data pipelines' },
            ],
          },
          {
            name: 'Feature Engineering and Data Quality',
            topics: [
              { name: 'Feature transformation and encoding techniques' },
              { name: 'Handling missing values and outliers' },
              { name: 'Feature selection and dimensionality reduction' },
              { name: 'Data labeling with SageMaker Ground Truth' },
              { name: 'Data bias detection with SageMaker Clarify' },
            ],
          },
        ],
      },
      {
        name: 'ML Model Development',
        weight: 26,
        topics: [
          { name: 'Choose modeling approaches' },
          { name: 'Train and tune ML models' },
          { name: 'Evaluate ML models' },
        ],
        chapters: [
          {
            name: 'Model Training on SageMaker',
            topics: [
              { name: 'SageMaker built-in algorithms (XGBoost, Linear Learner, etc.)' },
              { name: 'SageMaker training jobs and distributed training' },
              { name: 'Hyperparameter tuning (automatic model tuning)' },
              { name: 'Bring-your-own-container and script mode' },
            ],
          },
          {
            name: 'Model Evaluation and Selection',
            topics: [
              { name: 'Evaluation metrics (accuracy, AUC-ROC, RMSE, F1)' },
              { name: 'Cross-validation strategies' },
              { name: 'Overfitting and underfitting diagnosis' },
              { name: 'SageMaker Experiments for tracking' },
            ],
          },
        ],
      },
      {
        name: 'Deployment and Orchestration of ML Workflows',
        weight: 22,
        topics: [
          { name: 'Select deployment infrastructure' },
          { name: 'Create and script ML pipelines' },
          { name: 'Deploy ML models' },
        ],
        chapters: [
          {
            name: 'Model Deployment',
            topics: [
              { name: 'SageMaker real-time endpoints' },
              { name: 'SageMaker Serverless Inference and Async Inference' },
              { name: 'Batch Transform for offline predictions' },
              { name: 'Multi-model and multi-container endpoints' },
            ],
          },
          {
            name: 'ML Pipeline Orchestration',
            topics: [
              { name: 'SageMaker Pipelines for MLOps' },
              { name: 'Step Functions for ML workflows' },
              { name: 'Model Registry and model approval workflows' },
              { name: 'CI/CD for ML (model retraining automation)' },
            ],
          },
        ],
      },
      {
        name: 'ML Solution Monitoring, Maintenance, and Security',
        weight: 24,
        topics: [
          { name: 'Monitor ML solutions' },
          { name: 'Maintain and update ML solutions' },
          { name: 'Secure ML solutions' },
        ],
        chapters: [
          {
            name: 'Model Monitoring and Maintenance',
            topics: [
              { name: 'SageMaker Model Monitor for data drift and quality' },
              { name: 'CloudWatch metrics for endpoint performance' },
              { name: 'A/B testing with production variants' },
              { name: 'Model retraining triggers and strategies' },
            ],
          },
          {
            name: 'ML Security and Cost Optimization',
            topics: [
              { name: 'VPC configurations for SageMaker' },
              { name: 'IAM roles and policies for ML workloads' },
              { name: 'KMS encryption for training data and model artifacts' },
              { name: 'Spot instances for training cost optimization' },
              { name: 'SageMaker Savings Plans and instance right-sizing' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Machine Learning Engineer Associate (MLA-C01) validates the ability to build, train, deploy, and maintain ML solutions on AWS. It focuses heavily on SageMaker capabilities including Feature Store, training jobs, deployment options, pipelines, model monitoring, and MLOps practices.',
      totalDuration: 170,
      passingScore: 72,
      tips: [
        'SageMaker is the centerpiece — know Feature Store, Training Jobs, Endpoints, Pipelines, and Model Monitor.',
        'Understand the difference between real-time, serverless, async, and batch inference.',
        'Feature engineering topics: encoding, normalization, handling missing data, and feature selection.',
        'SageMaker Clarify for bias detection and model explainability is frequently tested.',
        'Know when to use built-in algorithms vs bring-your-own-container vs script mode.',
        'MLOps practices: Model Registry, approval workflows, automated retraining triggers.',
      ],
    },
    questionStyle: 'AWS Machine Learning Engineer Associate questions present ML scenarios involving data preparation, model training, deployment, or monitoring on AWS. Questions ask which SageMaker feature, configuration, or architectural approach BEST addresses the ML requirement. Options reference specific SageMaker capabilities, instance types, algorithms, and deployment patterns. Scenarios require understanding of the full ML lifecycle from data preparation through production monitoring.',
  },

  // ═══════════════════════════════════════════════════════════════
  // PROFESSIONAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'aws-sap-c02',
    vendor: 'AWS',
    certName: 'AWS Certified Solutions Architect - Professional',
    certCode: 'SAP-C02',
    aliases: [
      /sap-?c?0?2/i,
      /\bsap\b/i,
      /solutions?\s*architect\s*professional/i,
      /aws\s+sa\s+pro/i,
      /aws\s+sap\b/i,
    ],
    passingThresholdPercent: 75,
    totalDurationMinutes: 180,
    questionCountTotal: 75,
    scoringScale: { passing: 750, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (complex scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '75 complex scenario-based multiple-choice and multiple-response questions in 180 minutes',
        timeAllocation: 180,
        pointWeight: 100,
        questionCount: 75,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Design Solutions for Organizational Complexity',
        weight: 26,
        topics: [
          { name: 'Cross-account and multi-account architectures' },
          { name: 'Multi-region and hybrid network architectures' },
          { name: 'Identity federation and centralized access management' },
        ],
        chapters: [
          {
            name: 'Multi-Account and Organization Strategies',
            topics: [
              { name: 'AWS Organizations OUs, SCPs, and account governance' },
              { name: 'AWS Control Tower and landing zone patterns' },
              { name: 'Cross-account IAM roles and resource sharing (RAM)' },
              { name: 'Centralized logging and security (Security Hub, CloudTrail org trail)' },
            ],
          },
          {
            name: 'Hybrid and Multi-Region Networking',
            topics: [
              { name: 'Transit Gateway and inter-region peering' },
              { name: 'Direct Connect and VPN architectures' },
              { name: 'AWS Outposts and Local Zones' },
              { name: 'DNS resolution across hybrid environments (Route 53 Resolver)' },
              { name: 'Global Accelerator and CloudFront for global applications' },
            ],
          },
          {
            name: 'Centralized Identity and Federation',
            topics: [
              { name: 'IAM Identity Center with SAML/OIDC providers' },
              { name: 'Cognito for B2C and workforce identity' },
              { name: 'Permission sets and attribute-based access control (ABAC)' },
            ],
          },
        ],
      },
      {
        name: 'Design for New Solutions',
        weight: 29,
        topics: [
          { name: 'Design deployment strategies for business requirements' },
          { name: 'Design solutions with appropriate compute, storage, database, and networking' },
          { name: 'Determine security strategies for new solutions' },
        ],
        chapters: [
          {
            name: 'Complex Compute and Application Architectures',
            topics: [
              { name: 'Microservices with ECS, EKS, and Fargate' },
              { name: 'Serverless architectures at scale (Lambda, Step Functions, EventBridge)' },
              { name: 'Event-driven architectures and choreography vs orchestration' },
              { name: 'High-performance computing with placement groups and EFA' },
            ],
          },
          {
            name: 'Advanced Data Architectures',
            topics: [
              { name: 'Data lake architectures with Lake Formation' },
              { name: 'DynamoDB Global Tables and stream processing' },
              { name: 'Aurora Global Database and custom endpoints' },
              { name: 'Redshift Spectrum and federated queries' },
              { name: 'Real-time analytics with Kinesis and OpenSearch' },
            ],
          },
          {
            name: 'Enterprise Security Architectures',
            topics: [
              { name: 'Multi-layer encryption strategies (KMS, CloudHSM)' },
              { name: 'Network segmentation and micro-segmentation' },
              { name: 'Zero-trust architecture patterns on AWS' },
              { name: 'Compliance automation with Config and Security Hub' },
            ],
          },
        ],
      },
      {
        name: 'Continuous Improvement for Existing Solutions',
        weight: 25,
        topics: [
          { name: 'Determine strategy for cost optimization' },
          { name: 'Determine strategy for performance improvement' },
          { name: 'Determine strategy for improving operational excellence' },
        ],
        chapters: [
          {
            name: 'Cost Optimization Strategies',
            topics: [
              { name: 'Compute Savings Plans and Reserved Instance strategies' },
              { name: 'Spot Fleet and Spot placement scores' },
              { name: 'Storage tiering and intelligent archival' },
              { name: 'Right-sizing with Compute Optimizer and Cost Explorer' },
            ],
          },
          {
            name: 'Performance and Operational Improvement',
            topics: [
              { name: 'Caching strategies (CloudFront, ElastiCache, DAX, API Gateway)' },
              { name: 'Database optimization (read replicas, connection pooling, ProxySQL)' },
              { name: 'Infrastructure as Code maturity (CDK, CloudFormation modules)' },
              { name: 'Observability with CloudWatch, X-Ray, and Distro for OpenTelemetry' },
            ],
          },
        ],
      },
      {
        name: 'Accelerate Workload Migration and Modernization',
        weight: 20,
        topics: [
          { name: 'Select existing workloads and processes for migration' },
          { name: 'Determine migration approach for workloads' },
          { name: 'Determine new architecture for migrated workloads' },
        ],
        chapters: [
          {
            name: 'Migration Strategies and Tools',
            topics: [
              { name: 'Migration 7 Rs strategy selection' },
              { name: 'AWS Migration Hub and Application Discovery Service' },
              { name: 'Server Migration Service and Application Migration Service' },
              { name: 'Database migration with DMS and SCT' },
            ],
          },
          {
            name: 'Application Modernization',
            topics: [
              { name: 'Strangler fig pattern for incremental modernization' },
              { name: 'Containerization strategies (lift-and-shift to ECS/EKS)' },
              { name: 'Refactoring to serverless architectures' },
              { name: 'Decoupling monoliths with SQS, SNS, and EventBridge' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Solutions Architect Professional (SAP-C02) is one of the most challenging AWS certifications. It tests the ability to design complex, enterprise-scale solutions spanning multi-account strategies, hybrid networking, migrations, and advanced architectural patterns. Questions are lengthy scenarios requiring evaluation of multiple valid approaches to select the BEST one.',
      totalDuration: 180,
      passingScore: 75,
      tips: [
        'Time management is critical — budget ~2.5 minutes per question for 75 questions in 180 minutes.',
        'Questions are long — read the requirements and constraints first, then the scenario.',
        'Multi-account architectures with Organizations, SCPs, and Control Tower are heavily tested.',
        'Know Transit Gateway, Direct Connect, and VPN architectures in depth.',
        'Migration strategies (7 Rs) and when to use each are frequently tested.',
        'Cost optimization at scale: Savings Plans, Spot Fleets, storage tiering.',
        'Disaster recovery across regions is a common scenario pattern.',
      ],
    },
    questionStyle: 'AWS Solutions Architect Professional questions present a complex enterprise scenario (5-8 sentences) with multiple constraints including organizational structure, compliance requirements, performance targets, cost budgets, and existing infrastructure. Questions ask which combination of AWS services and configurations BEST meets ALL requirements. Options are detailed multi-step solutions using 3-5 AWS services each. The correct answer satisfies every stated constraint while distractors miss at least one requirement or introduce unnecessary complexity. Scenarios frequently involve multi-account, multi-region, and hybrid architectures.',
  },

  {
    id: 'aws-dop-c02',
    vendor: 'AWS',
    certName: 'AWS Certified DevOps Engineer - Professional',
    certCode: 'DOP-C02',
    aliases: [
      /dop-?c?0?2/i,
      /\bdop\b/i,
      /devops\s*engineer\s*professional/i,
      /aws\s+devops\s*pro/i,
      /aws\s+devops\s*engineer/i,
    ],
    passingThresholdPercent: 75,
    totalDurationMinutes: 170,
    questionCountTotal: 75,
    scoringScale: { passing: 750, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (complex scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '75 complex scenario-based multiple-choice and multiple-response questions in 170 minutes',
        timeAllocation: 170,
        pointWeight: 100,
        questionCount: 75,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'SDLC Automation',
        weight: 22,
        topics: [
          { name: 'Implement CI/CD pipelines' },
          { name: 'Integrate automated testing' },
          { name: 'Build and manage artifacts' },
        ],
        chapters: [
          {
            name: 'CI/CD Pipeline Design',
            topics: [
              { name: 'CodePipeline stages, actions, and approval gates' },
              { name: 'CodeBuild buildspec.yml and environment configuration' },
              { name: 'CodeDeploy deployment configurations and hooks' },
              { name: 'Cross-account and cross-region pipeline patterns' },
            ],
          },
          {
            name: 'Automated Testing and Release Strategies',
            topics: [
              { name: 'Integration and end-to-end testing in pipelines' },
              { name: 'Blue/green and canary deployment strategies' },
              { name: 'Feature flags with AppConfig' },
              { name: 'Artifact management with CodeArtifact and ECR' },
            ],
          },
        ],
      },
      {
        name: 'Configuration Management and Infrastructure as Code',
        weight: 17,
        topics: [
          { name: 'Define cloud infrastructure with IaC' },
          { name: 'Deploy and manage cloud infrastructure' },
        ],
        chapters: [
          {
            name: 'Infrastructure as Code',
            topics: [
              { name: 'CloudFormation advanced features (macros, custom resources, modules)' },
              { name: 'CDK constructs, stacks, and app lifecycle' },
              { name: 'CloudFormation StackSets for multi-account deployments' },
              { name: 'Drift detection and import existing resources' },
            ],
          },
          {
            name: 'Configuration Management',
            topics: [
              { name: 'Systems Manager State Manager and Automation' },
              { name: 'Parameter Store and Secrets Manager for configuration' },
              { name: 'OpsWorks for Chef/Puppet configuration' },
              { name: 'EC2 Image Builder for AMI pipelines' },
            ],
          },
        ],
      },
      {
        name: 'Resilient Cloud Solutions',
        weight: 15,
        topics: [
          { name: 'Implement highly available solutions' },
          { name: 'Implement fault-tolerant and disaster recovery solutions' },
        ],
        chapters: [
          {
            name: 'High Availability and Disaster Recovery',
            topics: [
              { name: 'Multi-AZ and Multi-Region failover architectures' },
              { name: 'Route 53 health checks and DNS failover' },
              { name: 'RDS/Aurora failover and cross-region replicas' },
              { name: 'Chaos engineering with AWS Fault Injection Simulator' },
              { name: 'Backup automation with AWS Backup' },
            ],
          },
        ],
      },
      {
        name: 'Monitoring and Logging',
        weight: 15,
        topics: [
          { name: 'Configure monitoring and alerting' },
          { name: 'Analyze and aggregate logs' },
        ],
        chapters: [
          {
            name: 'Observability and Logging',
            topics: [
              { name: 'CloudWatch dashboards, composite alarms, and anomaly detection' },
              { name: 'CloudWatch Logs subscription filters and cross-account logging' },
              { name: 'X-Ray service maps and trace analysis' },
              { name: 'OpenSearch for centralized log analytics' },
              { name: 'CloudTrail organization trails and log integrity' },
            ],
          },
        ],
      },
      {
        name: 'Incident and Event Response',
        weight: 14,
        topics: [
          { name: 'Manage events and automate incident response' },
          { name: 'Implement event-driven automation' },
        ],
        chapters: [
          {
            name: 'Event-Driven Automation and Incident Response',
            topics: [
              { name: 'EventBridge rules and targets for automation' },
              { name: 'Systems Manager Incident Manager and OpsCenter' },
              { name: 'Lambda-based remediation patterns' },
              { name: 'SNS notifications and escalation workflows' },
              { name: 'Auto-remediation with Config rules and SSM Automation' },
            ],
          },
        ],
      },
      {
        name: 'Security and Compliance',
        weight: 17,
        topics: [
          { name: 'Implement IAM policies and permissions' },
          { name: 'Implement compliance and governance' },
          { name: 'Automate security controls' },
        ],
        chapters: [
          {
            name: 'Security Automation',
            topics: [
              { name: 'SCPs and permission boundaries for governance' },
              { name: 'AWS Config rules for compliance automation' },
              { name: 'Security Hub and GuardDuty automation' },
              { name: 'Secrets rotation with Secrets Manager' },
            ],
          },
          {
            name: 'Pipeline Security',
            topics: [
              { name: 'Pipeline artifact encryption with KMS' },
              { name: 'IAM roles for pipeline stages and cross-account access' },
              { name: 'Container image scanning with ECR and Inspector' },
              { name: 'SAST/DAST integration in CI/CD' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS DevOps Engineer Professional (DOP-C02) validates the ability to provision, operate, and manage distributed application systems on AWS. It covers CI/CD pipeline design, infrastructure as code, monitoring/logging, incident response, and security automation. This is one of the most technically demanding AWS certifications.',
      totalDuration: 170,
      passingScore: 75,
      tips: [
        'CI/CD pipelines are the core focus — know CodePipeline, CodeBuild, CodeDeploy in depth.',
        'CloudFormation advanced features (StackSets, macros, custom resources) are heavily tested.',
        'Know deployment strategies: blue/green, canary, rolling, and their implementations on AWS.',
        'Understand cross-account pipeline patterns and artifact sharing.',
        'EventBridge + Lambda + Systems Manager Automation is a common remediation pattern.',
        'Container orchestration with ECS/EKS and ECR image management are important topics.',
        'Time management matters — 75 questions in 170 minutes (~2.25 min per question).',
      ],
    },
    questionStyle: 'AWS DevOps Engineer Professional questions describe a complex operational scenario involving CI/CD pipelines, infrastructure deployments, monitoring, or security automation across multiple AWS accounts or regions. Questions ask which approach BEST achieves the desired automation, reliability, or compliance outcome with the LEAST operational overhead. Options describe multi-step solutions involving Code* services, CloudFormation, Systems Manager, EventBridge, and monitoring tools. Scenarios often require combining multiple services into an automated workflow.',
  },

  {
    id: 'aws-aip-c01',
    vendor: 'AWS',
    certName: 'AWS Certified Generative AI Developer - Professional',
    certCode: 'AIP-C01',
    aliases: [
      /aip-?c?0?1/i,
      /\baip\b/i,
      /gen\s*ai\s*developer/i,
      /generative\s*ai\s*developer/i,
      /aws\s+gen\s*ai\s+pro/i,
    ],
    passingThresholdPercent: 75,
    totalDurationMinutes: 205,
    questionCountTotal: 85,
    scoringScale: { passing: 750, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (complex scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '85 complex scenario-based multiple-choice and multiple-response questions in 205 minutes',
        timeAllocation: 205,
        pointWeight: 100,
        questionCount: 85,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'FM Integration, Data Management, and Compliance',
        weight: 31,
        topics: [
          { name: 'Select and integrate foundation models' },
          { name: 'Prepare and manage data for generative AI' },
          { name: 'Compliance and regulatory requirements' },
        ],
        chapters: [
          {
            name: 'Foundation Model Selection and Integration',
            topics: [
              { name: 'Amazon Bedrock model selection criteria (Anthropic, Meta, Cohere, Amazon Titan)' },
              { name: 'Model invocation APIs and inference parameters' },
              { name: 'Custom model import and fine-tuning on Bedrock' },
              { name: 'SageMaker JumpStart for open-source model deployment' },
            ],
          },
          {
            name: 'Data Preparation for Generative AI',
            topics: [
              { name: 'Knowledge Bases with vector databases (OpenSearch Serverless, Pinecone)' },
              { name: 'Embedding model selection and chunking strategies' },
              { name: 'Data ingestion pipelines for RAG' },
              { name: 'Data quality and deduplication for training data' },
            ],
          },
          {
            name: 'Compliance and Data Governance',
            topics: [
              { name: 'Data residency and model invocation logging' },
              { name: 'PII handling and data classification' },
              { name: 'Model evaluation and red-teaming' },
              { name: 'Audit trails for generative AI applications' },
            ],
          },
        ],
      },
      {
        name: 'Implementation and Integration of Generative AI',
        weight: 26,
        topics: [
          { name: 'Design and implement generative AI applications' },
          { name: 'Implement RAG and agentic workflows' },
          { name: 'Integrate generative AI into existing systems' },
        ],
        chapters: [
          {
            name: 'RAG and Knowledge Base Architecture',
            topics: [
              { name: 'RAG pipeline design (retrieval, augmentation, generation)' },
              { name: 'Vector store selection and indexing strategies' },
              { name: 'Hybrid search (keyword + semantic)' },
              { name: 'Context window management and relevance ranking' },
            ],
          },
          {
            name: 'Agents and Application Patterns',
            topics: [
              { name: 'Bedrock Agents with action groups and Lambda functions' },
              { name: 'Multi-step reasoning and tool use' },
              { name: 'Conversation memory and session management' },
              { name: 'Streaming responses and async patterns' },
              { name: 'Integration with enterprise APIs and workflows' },
            ],
          },
        ],
      },
      {
        name: 'AI Safety, Security, and Governance',
        weight: 20,
        topics: [
          { name: 'Implement guardrails and content filtering' },
          { name: 'Secure generative AI workloads' },
          { name: 'Responsible AI practices' },
        ],
        chapters: [
          {
            name: 'Guardrails and Safety',
            topics: [
              { name: 'Bedrock Guardrails configuration (content filters, denied topics)' },
              { name: 'Input validation and prompt injection prevention' },
              { name: 'Output filtering and toxicity detection' },
              { name: 'Human-in-the-loop review workflows' },
            ],
          },
          {
            name: 'Security and Access Control',
            topics: [
              { name: 'IAM policies for Bedrock and SageMaker' },
              { name: 'VPC endpoints for model invocation' },
              { name: 'KMS encryption for model customization data' },
              { name: 'CloudTrail logging for model invocations' },
            ],
          },
        ],
      },
      {
        name: 'Operational Efficiency',
        weight: 12,
        topics: [
          { name: 'Optimize cost and performance of generative AI solutions' },
          { name: 'Monitor generative AI applications' },
        ],
        chapters: [
          {
            name: 'Cost and Performance Optimization',
            topics: [
              { name: 'Model selection for cost-performance trade-offs' },
              { name: 'Caching strategies for repeated queries' },
              { name: 'Provisioned Throughput for Bedrock' },
              { name: 'Token usage optimization and prompt engineering' },
            ],
          },
        ],
      },
      {
        name: 'Testing, Validation, and Troubleshooting',
        weight: 11,
        topics: [
          { name: 'Evaluate generative AI outputs' },
          { name: 'Troubleshoot generative AI applications' },
        ],
        chapters: [
          {
            name: 'Evaluation and Testing',
            topics: [
              { name: 'LLM evaluation metrics (ROUGE, BLEU, BERTScore)' },
              { name: 'Bedrock model evaluation jobs' },
              { name: 'A/B testing for prompt and model variations' },
              { name: 'Debugging hallucinations and retrieval failures' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Generative AI Developer Professional (AIP-C01) is the newest professional-level certification validating the ability to design, implement, and optimize generative AI applications on AWS. It covers Amazon Bedrock, RAG architectures, agentic workflows, guardrails, and operational best practices for production generative AI systems.',
      totalDuration: 205,
      passingScore: 75,
      tips: [
        'Amazon Bedrock is the central service — know models, Knowledge Bases, Agents, and Guardrails deeply.',
        'RAG architecture is a major topic: embedding models, chunking, vector stores, and retrieval strategies.',
        'Understand prompt engineering techniques and when to fine-tune vs use RAG vs use agents.',
        'Guardrails configuration for content filtering and prompt injection prevention is heavily tested.',
        'Know the trade-offs between different foundation models (Claude, Titan, Llama, Command).',
        'Cost optimization: Provisioned Throughput, caching, token management, and model selection.',
        'This is a long exam (85 questions, 205 minutes) — pace yourself at ~2.4 min per question.',
      ],
    },
    questionStyle: 'AWS Generative AI Developer Professional questions present complex generative AI scenarios involving application design, RAG implementation, agent orchestration, safety/security, or operational optimization. Questions ask which approach BEST achieves the desired outcome using Amazon Bedrock, SageMaker, and supporting AWS services. Options describe multi-component architectures with specific model choices, retrieval strategies, guardrail configurations, and integration patterns. Scenarios may involve evaluating trade-offs between accuracy, latency, cost, and safety for production generative AI applications.',
  },

  // ═══════════════════════════════════════════════════════════════
  // SPECIALTY
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'aws-scs-c03',
    vendor: 'AWS',
    certName: 'AWS Certified Security - Specialty',
    certCode: 'SCS-C03',
    aliases: [
      /scs-?c?0?3/i,
      /\bscs\b/i,
      /security\s*specialty/i,
      /aws\s+security\s+spec/i,
    ],
    passingThresholdPercent: 75,
    totalDurationMinutes: 170,
    questionCountTotal: 65,
    scoringScale: { passing: 750, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (complex scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 complex scenario-based multiple-choice and multiple-response questions in 170 minutes',
        timeAllocation: 170,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Threat Detection and Incident Response',
        weight: 16,
        topics: [
          { name: 'Design and implement threat detection strategies' },
          { name: 'Respond to and remediate security events' },
        ],
        chapters: [
          {
            name: 'Threat Detection',
            topics: [
              { name: 'Amazon GuardDuty finding types and threat intelligence' },
              { name: 'Security Hub aggregation and automated findings' },
              { name: 'Amazon Detective for investigation' },
              { name: 'CloudWatch anomaly detection for security metrics' },
            ],
          },
        ],
      },
      {
        name: 'Security Logging and Monitoring',
        weight: 14,
        topics: [
          { name: 'Design and implement logging solutions' },
          { name: 'Analyze and troubleshoot security issues using logs' },
        ],
        chapters: [
          {
            name: 'Centralized Logging and Analysis',
            topics: [
              { name: 'CloudTrail organization trails and log file validation' },
              { name: 'VPC Flow Logs analysis and traffic mirroring' },
              { name: 'S3 access logging and CloudFront logs' },
              { name: 'OpenSearch and Athena for security log analysis' },
              { name: 'Cross-account log aggregation patterns' },
            ],
          },
        ],
      },
      {
        name: 'Infrastructure Security',
        weight: 18,
        topics: [
          { name: 'Design and implement secure network architectures' },
          { name: 'Secure compute and container workloads' },
        ],
        chapters: [
          {
            name: 'Network Security',
            topics: [
              { name: 'VPC architecture with public/private subnets and isolation' },
              { name: 'Security groups, NACLs, and AWS Network Firewall' },
              { name: 'WAF rules, rate limiting, and managed rule groups' },
              { name: 'Shield Advanced for DDoS protection' },
              { name: 'PrivateLink and VPC endpoints for service access' },
            ],
          },
          {
            name: 'Compute and Container Security',
            topics: [
              { name: 'EC2 instance metadata service (IMDSv2)' },
              { name: 'ECS/EKS security configurations and pod security' },
              { name: 'ECR image scanning and signed images' },
              { name: 'Systems Manager for patch management and compliance' },
            ],
          },
        ],
      },
      {
        name: 'Identity and Access Management',
        weight: 20,
        topics: [
          { name: 'Design and implement IAM strategies' },
          { name: 'Manage fine-grained access and permissions' },
        ],
        chapters: [
          {
            name: 'Advanced IAM',
            topics: [
              { name: 'IAM policy evaluation logic and conditions' },
              { name: 'Permission boundaries and SCPs' },
              { name: 'Session policies and cross-account delegation' },
              { name: 'IAM Access Analyzer for policy validation' },
            ],
          },
          {
            name: 'Identity Federation and SSO',
            topics: [
              { name: 'IAM Identity Center with external IdPs' },
              { name: 'SAML 2.0 and OIDC federation flows' },
              { name: 'Cognito User/Identity Pools for application access' },
              { name: 'Attribute-based access control (ABAC)' },
            ],
          },
        ],
      },
      {
        name: 'Data Protection',
        weight: 18,
        topics: [
          { name: 'Design and implement data encryption strategies' },
          { name: 'Manage keys and secrets' },
          { name: 'Design data protection for storage services' },
        ],
        chapters: [
          {
            name: 'Encryption and Key Management',
            topics: [
              { name: 'KMS key types (symmetric, asymmetric, HMAC)' },
              { name: 'KMS key policies, grants, and cross-account usage' },
              { name: 'CloudHSM for dedicated hardware security' },
              { name: 'Envelope encryption and data key caching' },
              { name: 'ACM certificate management and private CA' },
            ],
          },
          {
            name: 'Data Classification and Protection',
            topics: [
              { name: 'Macie for sensitive data discovery' },
              { name: 'S3 Object Lock and Glacier Vault Lock' },
              { name: 'Secrets Manager rotation and cross-account sharing' },
              { name: 'Database encryption (RDS, DynamoDB, Redshift)' },
            ],
          },
        ],
      },
      {
        name: 'Management and Security Governance',
        weight: 14,
        topics: [
          { name: 'Develop governance and compliance strategies' },
          { name: 'Implement security governance across accounts' },
        ],
        chapters: [
          {
            name: 'Security Governance',
            topics: [
              { name: 'AWS Config conformance packs and organizational rules' },
              { name: 'Control Tower preventive and detective controls' },
              { name: 'AWS Audit Manager for compliance evidence' },
              { name: 'Automated security response patterns (EventBridge + Lambda + SSM)' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Security Specialty (SCS-C03) validates deep expertise in securing AWS workloads and architectures. It covers threat detection, incident response, IAM, data protection, infrastructure security, and governance at an advanced level. This exam assumes strong knowledge of security services and their integration patterns.',
      totalDuration: 170,
      passingScore: 75,
      tips: [
        'KMS is the most-tested topic — understand key types, policies, grants, cross-account usage, and envelope encryption.',
        'Know IAM policy evaluation logic: explicit deny > explicit allow > implicit deny.',
        'GuardDuty, Security Hub, and Detective form the detection triad — know when to use each.',
        'Understand CloudTrail log file validation and cross-account log aggregation patterns.',
        'WAF vs Shield vs Network Firewall — know the layer and use case for each.',
        'Secrets Manager rotation with Lambda is a frequently tested pattern.',
        'Config rules and automatic remediation with SSM Automation is a common question pattern.',
      ],
    },
    questionStyle: 'AWS Security Specialty questions present a security scenario involving a potential threat, compliance requirement, data protection need, or access control challenge in an AWS environment. Questions ask which security service configuration or architectural approach BEST mitigates the risk or satisfies the compliance requirement. Options reference specific security service features, IAM policy conditions, encryption configurations, and audit mechanisms. Scenarios require understanding of defense-in-depth strategies and the interactions between multiple security services.',
  },

  {
    id: 'aws-ans-c01',
    vendor: 'AWS',
    certName: 'AWS Certified Advanced Networking - Specialty',
    certCode: 'ANS-C01',
    aliases: [
      /ans-?c?0?1/i,
      /\bans\b/i,
      /advanced\s*networking/i,
      /networking\s*specialty/i,
      /aws\s+networking\s*spec/i,
    ],
    passingThresholdPercent: 75,
    totalDurationMinutes: 170,
    questionCountTotal: 65,
    scoringScale: { passing: 750, max: 1000 },
    questionTypes: 'Multiple choice and multiple response (complex scenario-based)',
    performanceBased: false,
    formats: [
      {
        formatName: 'Standard Exam',
        description: '65 complex scenario-based multiple-choice and multiple-response questions in 170 minutes',
        timeAllocation: 170,
        pointWeight: 100,
        questionCount: 65,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],
    subjects: [
      {
        name: 'Network Design',
        weight: 30,
        topics: [
          { name: 'Design edge network solutions' },
          { name: 'Design DNS solutions' },
          { name: 'Design network connectivity solutions for hybrid environments' },
        ],
        chapters: [
          {
            name: 'VPC Architecture and Design',
            topics: [
              { name: 'VPC CIDR planning and IP address management (IPAM)' },
              { name: 'Multi-VPC and multi-account network architectures' },
              { name: 'Transit Gateway routing and route table associations' },
              { name: 'VPC peering vs Transit Gateway vs PrivateLink trade-offs' },
            ],
          },
          {
            name: 'Hybrid Network Design',
            topics: [
              { name: 'Direct Connect connections, LAGs, and virtual interfaces' },
              { name: 'Site-to-Site VPN with Transit Gateway' },
              { name: 'Direct Connect Gateway for multi-region access' },
              { name: 'Redundant hybrid connectivity patterns (DX + VPN failover)' },
            ],
          },
          {
            name: 'Edge and DNS Architecture',
            topics: [
              { name: 'CloudFront distributions, origins, and behaviors' },
              { name: 'Global Accelerator endpoints and health checks' },
              { name: 'Route 53 routing policies (weighted, latency, geolocation, failover)' },
              { name: 'Route 53 Resolver for hybrid DNS' },
            ],
          },
        ],
      },
      {
        name: 'Network Implementation',
        weight: 26,
        topics: [
          { name: 'Implement routing and connectivity solutions' },
          { name: 'Implement network segmentation' },
        ],
        chapters: [
          {
            name: 'Routing and Connectivity',
            topics: [
              { name: 'VPC route table configuration and propagation' },
              { name: 'Transit Gateway route tables and attachment routing' },
              { name: 'Direct Connect BGP configuration and route propagation' },
              { name: 'VPN tunnel configuration and failover' },
              { name: 'IPv6 networking and dual-stack VPCs' },
            ],
          },
          {
            name: 'Network Segmentation',
            topics: [
              { name: 'Security groups and NACLs for micro-segmentation' },
              { name: 'VPC endpoint policies for service access control' },
              { name: 'AWS Network Firewall for stateful inspection' },
              { name: 'Prefix lists and managed prefix lists' },
            ],
          },
        ],
      },
      {
        name: 'Network Management and Operations',
        weight: 20,
        topics: [
          { name: 'Monitor and troubleshoot network issues' },
          { name: 'Optimize network performance' },
        ],
        chapters: [
          {
            name: 'Network Monitoring and Troubleshooting',
            topics: [
              { name: 'VPC Flow Logs analysis and filtering' },
              { name: 'Traffic Mirroring for deep packet inspection' },
              { name: 'Reachability Analyzer for connectivity troubleshooting' },
              { name: 'Network Manager for global network visibility' },
              { name: 'CloudWatch metrics for network services' },
            ],
          },
          {
            name: 'Performance Optimization',
            topics: [
              { name: 'Enhanced networking (ENA, EFA) and placement groups' },
              { name: 'Jumbo frames and MTU configuration' },
              { name: 'Direct Connect MACsec encryption and LAG optimization' },
              { name: 'CloudFront cache behavior optimization' },
            ],
          },
        ],
      },
      {
        name: 'Network Security, Compliance, and Governance',
        weight: 24,
        topics: [
          { name: 'Implement security features across network services' },
          { name: 'Validate and audit security of network solutions' },
          { name: 'Implement network governance' },
        ],
        chapters: [
          {
            name: 'Network Security Controls',
            topics: [
              { name: 'AWS Network Firewall rules and rule groups' },
              { name: 'WAF web ACLs and rate-based rules' },
              { name: 'Shield Advanced protection and response team (SRT)' },
              { name: 'TLS termination and certificate management (ACM)' },
              { name: 'VPN encryption and IPSec configurations' },
            ],
          },
          {
            name: 'Network Compliance and Governance',
            topics: [
              { name: 'AWS Config rules for network compliance' },
              { name: 'CloudTrail logging for network API calls' },
              { name: 'VPC flow log analysis for compliance auditing' },
              { name: 'Network access control with RAM and Organizations' },
            ],
          },
        ],
      },
    ],
    examIntelligence: {
      overview: 'The AWS Advanced Networking Specialty (ANS-C01) validates deep expertise in designing, implementing, and troubleshooting complex AWS and hybrid network architectures. It covers VPC design, Transit Gateway, Direct Connect, VPN, DNS, edge networking, and network security at an expert level.',
      totalDuration: 170,
      passingScore: 75,
      tips: [
        'Direct Connect is the most-tested topic — know connection types, virtual interfaces, LAGs, DX Gateway, and failover patterns.',
        'Transit Gateway routing (route tables, attachments, route propagation) is critical.',
        'Understand VPC design: CIDR planning, subnet sizing, and multi-VPC patterns.',
        'Route 53 Resolver for hybrid DNS (inbound and outbound endpoints) is frequently tested.',
        'Know the differences between VPC peering, Transit Gateway, PrivateLink, and VPN.',
        'Network troubleshooting: VPC Flow Logs, Reachability Analyzer, Traffic Mirroring.',
        'BGP concepts (ASN, route propagation, communities) are tested in Direct Connect scenarios.',
      ],
    },
    questionStyle: 'AWS Advanced Networking Specialty questions present a complex networking scenario involving multi-VPC, hybrid, or global architectures with specific connectivity, performance, or security requirements. Questions ask which network architecture or configuration BEST meets the stated requirements. Options describe specific VPC configurations, Transit Gateway setups, Direct Connect architectures, DNS resolution patterns, or network security implementations. Scenarios require deep understanding of BGP, routing, DNS, and AWS networking service interactions.',
  },
]
