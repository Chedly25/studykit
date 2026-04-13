/**
 * Miscellaneous certification catalog.
 * 29 certifications across Databricks, Kubernetes/CNCF, CompTIA, HashiCorp, Cisco, and others.
 */
import type { CertificationEntry } from './types'

export const MISC_CERTS: CertificationEntry[] = [

  // ═══════════════════════════════════════════════════════════════════
  //  DATABRICKS (3)
  // ═══════════════════════════════════════════════════════════════════

  // ─── 1. Databricks Data Engineer Associate ───────────────────────
  {
    id: 'databricks-data-engineer-associate',
    vendor: 'Databricks',
    certName: 'Data Engineer Associate',
    certCode: 'Databricks Certified Data Engineer Associate',
    aliases: [
      /\bdatabricks\b.*\bdata\s*engineer/i,
      /\bdatabricks\b.*\bdea\b/i,
      /\bdata\s*engineer\b.*\bdatabricks\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 90,
    questionCountTotal: 45,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice',
    performanceBased: false,

    formats: [
      {
        formatName: 'Data Engineer Associate Exam',
        description: '45 MCQ questions on Databricks lakehouse fundamentals and data engineering',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 45,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Databricks Intelligence Platform',
        weight: 10,
        topics: [
          { name: 'Databricks architecture and components' },
          { name: 'Unity Catalog fundamentals' },
          { name: 'Lakehouse paradigm and Delta Lake basics' },
        ],
        chapters: [
          {
            name: 'Platform Overview',
            topics: [
              { name: 'Workspace, clusters, and notebooks' },
              { name: 'Unity Catalog for data governance' },
              { name: 'Delta Lake ACID transactions and time travel' },
            ],
          },
        ],
      },
      {
        name: 'ELT with Spark SQL and Python',
        weight: 30,
        topics: [
          { name: 'Querying data with Spark SQL' },
          { name: 'Transforming data with DataFrames' },
          { name: 'Managing databases and tables' },
        ],
        chapters: [
          {
            name: 'Spark SQL Fundamentals',
            topics: [
              { name: 'SELECT, JOIN, GROUP BY, window functions in Spark SQL' },
              { name: 'Creating and managing Delta tables' },
              { name: 'Higher-order functions and complex data types' },
            ],
          },
          {
            name: 'Python for Data Engineering',
            topics: [
              { name: 'PySpark DataFrame API transformations' },
              { name: 'User-defined functions (UDFs)' },
              { name: 'Reading and writing different file formats' },
            ],
          },
        ],
      },
      {
        name: 'Incremental Data Processing',
        weight: 31,
        topics: [
          { name: 'Structured Streaming fundamentals' },
          { name: 'Auto Loader for incremental ingestion' },
          { name: 'Delta Live Tables (DLT) pipelines' },
        ],
        chapters: [
          {
            name: 'Streaming Ingestion',
            topics: [
              { name: 'Structured Streaming with Delta Lake sinks' },
              { name: 'Auto Loader (cloudFiles) configuration and schema evolution' },
              { name: 'Trigger modes: availableNow, processingTime, continuous' },
            ],
          },
          {
            name: 'Delta Live Tables',
            topics: [
              { name: 'DLT pipeline declaration with @dlt.table and @dlt.view' },
              { name: 'Expectations for data quality enforcement' },
              { name: 'Medallion architecture (bronze, silver, gold)' },
            ],
          },
        ],
      },
      {
        name: 'Production Pipelines',
        weight: 18,
        topics: [
          { name: 'Databricks Jobs and orchestration' },
          { name: 'Multi-task workflows' },
          { name: 'Error handling and retries' },
        ],
        chapters: [
          {
            name: 'Workflow Orchestration',
            topics: [
              { name: 'Creating and scheduling Databricks Jobs' },
              { name: 'Multi-task DAG workflows with dependencies' },
              { name: 'Job clusters vs all-purpose clusters for production' },
            ],
          },
        ],
      },
      {
        name: 'Data Governance and Quality',
        weight: 11,
        topics: [
          { name: 'Unity Catalog access controls' },
          { name: 'Data lineage and auditing' },
          { name: 'Data quality monitoring' },
        ],
        chapters: [
          {
            name: 'Governance',
            topics: [
              { name: 'Unity Catalog three-level namespace (catalog.schema.table)' },
              { name: 'Grants and privileges management' },
              { name: 'Data lineage tracking and audit logs' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Databricks Data Engineer Associate validates ability to build and manage data pipelines using Databricks and Apache Spark. Heavy focus on Delta Live Tables, Auto Loader, and Spark SQL. Assumes familiarity with the lakehouse architecture and Unity Catalog.',
      totalDuration: 90,
      passingScore: 70,
      tips: [
        'Delta Live Tables and Auto Loader make up a large portion of questions',
        'Know Structured Streaming trigger modes and checkpointing',
        'Understand the medallion architecture (bronze, silver, gold) deeply',
        'Unity Catalog governance and three-level namespace are frequently tested',
        'Practice Spark SQL and PySpark DataFrame operations',
      ],
    },

    questionStyle: 'Multiple-choice questions testing practical knowledge of Databricks platform features, Spark SQL, and data pipeline development. Questions present data engineering scenarios and ask for the correct Databricks approach, SQL syntax, or pipeline configuration.',
  },

  // ─── 2. Databricks Machine Learning Associate ────────────────────
  {
    id: 'databricks-ml-associate',
    vendor: 'Databricks',
    certName: 'Machine Learning Associate',
    certCode: 'Databricks Certified Machine Learning Associate',
    aliases: [
      /\bdatabricks\b.*\bmachine\s*learning\s*associate\b/i,
      /\bdatabricks\b.*\bml\s*associate\b/i,
      /\bml\s*associate\b.*\bdatabricks\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 90,
    questionCountTotal: 48,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice',
    performanceBased: false,

    formats: [
      {
        formatName: 'ML Associate Exam',
        description: '48 MCQ questions on ML workflows, model development, and deployment on Databricks',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 48,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Databricks ML',
        weight: 38,
        topics: [
          { name: 'MLflow tracking and experiment management' },
          { name: 'Databricks Feature Store' },
          { name: 'AutoML on Databricks' },
        ],
        chapters: [
          {
            name: 'MLflow',
            topics: [
              { name: 'MLflow Tracking: runs, parameters, metrics, artifacts' },
              { name: 'MLflow Model Registry: staging, production, archived' },
              { name: 'MLflow model flavors and model serving' },
            ],
          },
          {
            name: 'Databricks ML Tools',
            topics: [
              { name: 'Feature Store for feature sharing and lineage' },
              { name: 'AutoML for rapid prototyping' },
              { name: 'Databricks Runtime for Machine Learning' },
            ],
          },
        ],
      },
      {
        name: 'ML Workflows',
        weight: 19,
        topics: [
          { name: 'End-to-end ML workflow design' },
          { name: 'Data preparation for ML' },
          { name: 'Model selection strategies' },
        ],
        chapters: [
          {
            name: 'ML Lifecycle',
            topics: [
              { name: 'Data splitting strategies (train/validation/test)' },
              { name: 'Cross-validation and hyperparameter tuning' },
              { name: 'Experiment tracking and reproducibility' },
            ],
          },
        ],
      },
      {
        name: 'Model Development',
        weight: 31,
        topics: [
          { name: 'Spark ML for distributed training' },
          { name: 'Scikit-learn and single-node ML on Databricks' },
          { name: 'Feature engineering techniques' },
        ],
        chapters: [
          {
            name: 'Training',
            topics: [
              { name: 'Spark ML Pipelines (transformers, estimators, pipelines)' },
              { name: 'Pandas API on Spark for single-node ML at scale' },
              { name: 'Hyperopt for distributed hyperparameter tuning' },
            ],
          },
          {
            name: 'Feature Engineering',
            topics: [
              { name: 'Handling missing data and outliers' },
              { name: 'Encoding categorical variables and scaling' },
              { name: 'Feature importance and selection methods' },
            ],
          },
        ],
      },
      {
        name: 'Model Deployment',
        weight: 12,
        topics: [
          { name: 'Model serving with MLflow' },
          { name: 'Batch inference patterns' },
          { name: 'Real-time inference endpoints' },
        ],
        chapters: [
          {
            name: 'Deployment',
            topics: [
              { name: 'MLflow model serving endpoints' },
              { name: 'Batch scoring with Spark DataFrames' },
              { name: 'Model monitoring and drift detection' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Databricks ML Associate tests practical knowledge of ML workflows on the Databricks platform. Heavy emphasis on MLflow for experiment tracking and model management. Requires understanding of Spark ML, feature engineering, and model deployment patterns.',
      totalDuration: 90,
      passingScore: 70,
      tips: [
        'MLflow is the most tested topic — know tracking, model registry, and model flavors thoroughly',
        'Understand Spark ML Pipelines and when to use distributed vs single-node ML',
        'Feature Store concepts and best practices appear frequently',
        'Know Hyperopt for distributed hyperparameter tuning',
        'AutoML usage and limitations are commonly tested',
      ],
    },

    questionStyle: 'Multiple-choice questions on ML concepts applied to the Databricks platform. Presents practical scenarios about experiment tracking, model training, and deployment and asks for the best Databricks-specific approach.',
  },

  // ─── 3. Databricks Generative AI Engineer Associate ──────────────
  {
    id: 'databricks-genai-engineer-associate',
    vendor: 'Databricks',
    certName: 'Generative AI Engineer Associate',
    certCode: 'Databricks Certified Generative AI Engineer Associate',
    aliases: [
      /\bdatabricks\b.*\bgenerative\s*ai\b/i,
      /\bdatabricks\b.*\bgenai\s*engineer\b/i,
      /\bgenai\s*engineer\b.*\bdatabricks\b/i,
      /\bdatabricks\b.*\bgen\s*ai\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 90,
    questionCountTotal: 45,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice',
    performanceBased: false,

    formats: [
      {
        formatName: 'GenAI Engineer Associate Exam',
        description: '45 MCQ questions on designing and deploying generative AI applications on Databricks',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 45,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Design GenAI Applications',
        weight: 14,
        topics: [
          { name: 'GenAI application architecture patterns' },
          { name: 'LLM selection and evaluation criteria' },
          { name: 'Use case identification for generative AI' },
        ],
        chapters: [
          {
            name: 'Application Design',
            topics: [
              { name: 'RAG vs fine-tuning vs prompt engineering trade-offs' },
              { name: 'Foundation model selection criteria' },
              { name: 'Compound AI system design patterns' },
            ],
          },
        ],
      },
      {
        name: 'Data Preparation for GenAI',
        weight: 14,
        topics: [
          { name: 'Vector database fundamentals' },
          { name: 'Document chunking strategies' },
          { name: 'Embedding models and similarity search' },
        ],
        chapters: [
          {
            name: 'Data for RAG',
            topics: [
              { name: 'Databricks Vector Search configuration' },
              { name: 'Chunking strategies (fixed-size, recursive, semantic)' },
              { name: 'Embedding model selection and management' },
            ],
          },
        ],
      },
      {
        name: 'Application Development',
        weight: 30,
        topics: [
          { name: 'Building RAG applications' },
          { name: 'Prompt engineering techniques' },
          { name: 'Chain and agent development' },
        ],
        chapters: [
          {
            name: 'RAG Development',
            topics: [
              { name: 'RAG pipeline implementation with LangChain' },
              { name: 'Retrieval strategies and reranking' },
              { name: 'Prompt templates and few-shot learning' },
            ],
          },
          {
            name: 'Agents and Chains',
            topics: [
              { name: 'LangChain chains and agents on Databricks' },
              { name: 'Tool use and function calling' },
              { name: 'Multi-step reasoning and chain-of-thought' },
            ],
          },
        ],
      },
      {
        name: 'Assembling and Deploying Applications',
        weight: 22,
        topics: [
          { name: 'Model serving for GenAI' },
          { name: 'Application deployment patterns' },
          { name: 'MLflow for GenAI model management' },
        ],
        chapters: [
          {
            name: 'Deployment',
            topics: [
              { name: 'Model Serving endpoints for LLMs' },
              { name: 'MLflow logging for LLM chains and agents' },
              { name: 'Foundation Model APIs and external model endpoints' },
            ],
          },
          {
            name: 'Production Readiness',
            topics: [
              { name: 'Scaling inference endpoints' },
              { name: 'A/B testing for GenAI applications' },
              { name: 'Cost optimization for LLM serving' },
            ],
          },
        ],
      },
      {
        name: 'Governance',
        weight: 8,
        topics: [
          { name: 'Unity Catalog for AI assets' },
          { name: 'Access control for models and endpoints' },
          { name: 'Data lineage for GenAI pipelines' },
        ],
        chapters: [
          {
            name: 'AI Governance',
            topics: [
              { name: 'Unity Catalog for model and function governance' },
              { name: 'Access controls for serving endpoints' },
              { name: 'Responsible AI practices for LLMs' },
            ],
          },
        ],
      },
      {
        name: 'Evaluation and Monitoring',
        weight: 12,
        topics: [
          { name: 'LLM evaluation metrics' },
          { name: 'RAG quality assessment' },
          { name: 'Production monitoring for GenAI' },
        ],
        chapters: [
          {
            name: 'Evaluation',
            topics: [
              { name: 'MLflow Evaluate for LLM assessment' },
              { name: 'RAG evaluation: faithfulness, relevance, groundedness' },
              { name: 'Human feedback collection and RLHF concepts' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Databricks GenAI Engineer Associate validates ability to design, build, and deploy generative AI applications on the Databricks platform. Heavy focus on RAG pipelines, Vector Search, and model serving. Requires understanding of LangChain, prompt engineering, and MLflow for LLM management.',
      totalDuration: 90,
      passingScore: 70,
      tips: [
        'RAG pipeline development is the largest domain — know Vector Search, chunking, and retrieval deeply',
        'Understand MLflow integration for logging and serving LLM chains',
        'Know Databricks Model Serving endpoints and Foundation Model APIs',
        'LangChain concepts (chains, agents, tools) are heavily tested',
        'Evaluation metrics for RAG (faithfulness, relevance, groundedness) are important',
      ],
    },

    questionStyle: 'Multiple-choice questions on generative AI concepts applied to the Databricks platform. Scenarios focus on RAG pipeline design, model serving, prompt engineering, and GenAI application deployment. Tests practical knowledge of Databricks-specific GenAI tools.',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  KUBERNETES / CNCF (4)
  // ═══════════════════════════════════════════════════════════════════

  // ─── 4. CKA — Certified Kubernetes Administrator ─────────────────
  {
    id: 'cncf-cka',
    vendor: 'CNCF',
    certName: 'Certified Kubernetes Administrator',
    certCode: 'CKA',
    aliases: [
      /\bcka\b/i,
      /\bcertified\s*kubernetes\s*administrator\b/i,
      /\bkubernetes\s*administrator\b/i,
      /\bk8s\s*admin\b/i,
    ],

    passingThresholdPercent: 66,
    totalDurationMinutes: 120,
    questionCountTotal: 17,
    scoringScale: { passing: 66, max: 100 },
    questionTypes: 'Performance-based (hands-on CLI tasks)',
    performanceBased: true,

    formats: [
      {
        formatName: 'CKA Performance Exam',
        description: '15-20 hands-on tasks in a live Kubernetes cluster environment (K8s v1.34)',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 17,
        sectionType: 'practical',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: false,
        instructions: 'You have access to a live terminal with multiple Kubernetes clusters. Use kubectl and other CLI tools to complete each task.',
      },
    ],

    subjects: [
      {
        name: 'Cluster Architecture, Installation, and Configuration',
        weight: 25,
        topics: [
          { name: 'Cluster architecture and components' },
          { name: 'Cluster installation with kubeadm' },
          { name: 'Managing cluster upgrades' },
        ],
        chapters: [
          {
            name: 'Cluster Setup',
            topics: [
              { name: 'kubeadm init, join, and certificate management' },
              { name: 'etcd backup and restore' },
              { name: 'Cluster upgrade process (control plane and nodes)' },
            ],
          },
          {
            name: 'RBAC and Security',
            topics: [
              { name: 'RBAC roles, role bindings, cluster roles' },
              { name: 'Service accounts and token management' },
              { name: 'Admission controllers and Pod Security Standards' },
            ],
          },
        ],
      },
      {
        name: 'Workloads and Scheduling',
        weight: 15,
        topics: [
          { name: 'Deployments, ReplicaSets, and StatefulSets' },
          { name: 'Pod scheduling and resource management' },
          { name: 'DaemonSets and Jobs' },
        ],
        chapters: [
          {
            name: 'Workload Management',
            topics: [
              { name: 'Deployments: rolling updates, rollbacks, scaling' },
              { name: 'ConfigMaps and Secrets for configuration' },
              { name: 'Resource requests, limits, and LimitRanges' },
            ],
          },
          {
            name: 'Scheduling',
            topics: [
              { name: 'Node selectors, affinity, and anti-affinity rules' },
              { name: 'Taints and tolerations' },
              { name: 'Pod priority and preemption' },
            ],
          },
        ],
      },
      {
        name: 'Services and Networking',
        weight: 20,
        topics: [
          { name: 'Service types and networking' },
          { name: 'Ingress controllers and rules' },
          { name: 'Network policies' },
        ],
        chapters: [
          {
            name: 'Services',
            topics: [
              { name: 'ClusterIP, NodePort, LoadBalancer, and ExternalName services' },
              { name: 'DNS resolution and service discovery' },
              { name: 'Ingress resources and controllers' },
            ],
          },
          {
            name: 'Network Policies',
            topics: [
              { name: 'NetworkPolicy spec: ingress and egress rules' },
              { name: 'Pod-to-pod and pod-to-external communication controls' },
              { name: 'CNI plugin fundamentals' },
            ],
          },
        ],
      },
      {
        name: 'Storage',
        weight: 10,
        topics: [
          { name: 'Persistent Volumes and Claims' },
          { name: 'Storage Classes and dynamic provisioning' },
          { name: 'Volume types and access modes' },
        ],
        chapters: [
          {
            name: 'Persistent Storage',
            topics: [
              { name: 'PV, PVC lifecycle and reclaim policies' },
              { name: 'StorageClass for dynamic provisioning' },
              { name: 'Volume expansion and snapshot management' },
            ],
          },
        ],
      },
      {
        name: 'Troubleshooting',
        weight: 30,
        topics: [
          { name: 'Troubleshooting cluster components' },
          { name: 'Troubleshooting application failures' },
          { name: 'Troubleshooting networking' },
        ],
        chapters: [
          {
            name: 'Cluster Troubleshooting',
            topics: [
              { name: 'Diagnosing control plane failures (API server, scheduler, controller manager)' },
              { name: 'Node troubleshooting (kubelet, container runtime)' },
              { name: 'etcd health checks and recovery' },
            ],
          },
          {
            name: 'Application Troubleshooting',
            topics: [
              { name: 'Pod debugging: logs, exec, describe, events' },
              { name: 'Service endpoint and DNS resolution troubleshooting' },
              { name: 'Resource constraint issues (OOM, CPU throttling)' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The CKA is a performance-based exam where you complete hands-on tasks in live Kubernetes clusters via a browser-based terminal. Tests practical administration skills including cluster setup, upgrades, troubleshooting, and RBAC. Based on Kubernetes v1.34.',
      totalDuration: 120,
      passingScore: 66,
      tips: [
        'Time management is critical — skip difficult tasks and return to them later',
        'Master kubectl shortcuts: aliases, --dry-run=client -o yaml for generating manifests',
        'Practice etcd backup and restore — it appears on nearly every exam',
        'Know how to troubleshoot nodes, pods, and services from the CLI',
        'Bookmark Kubernetes docs — you have access to kubernetes.io during the exam',
        'Use imperative commands when possible to save time over writing YAML',
      ],
    },

    questionStyle: 'The real exam is 100% hands-on CLI tasks. These practice questions test the same knowledge domains conceptually. Real tasks require you to use kubectl and other tools to configure, deploy, troubleshoot, and manage Kubernetes clusters in a live terminal environment.',
  },

  // ─── 5. CKAD — Certified Kubernetes Application Developer ───────
  {
    id: 'cncf-ckad',
    vendor: 'CNCF',
    certName: 'Certified Kubernetes Application Developer',
    certCode: 'CKAD',
    aliases: [
      /\bckad\b/i,
      /\bcertified\s*kubernetes\s*application\s*developer\b/i,
      /\bkubernetes\s*app(lication)?\s*developer\b/i,
      /\bk8s\s*dev(eloper)?\b/i,
    ],

    passingThresholdPercent: 66,
    totalDurationMinutes: 120,
    questionCountTotal: 17,
    scoringScale: { passing: 66, max: 100 },
    questionTypes: 'Performance-based (hands-on CLI tasks)',
    performanceBased: true,

    formats: [
      {
        formatName: 'CKAD Performance Exam',
        description: 'Hands-on tasks in a live Kubernetes cluster environment (K8s v1.35)',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 17,
        sectionType: 'practical',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: false,
        instructions: 'You have access to a live terminal with multiple Kubernetes clusters. Use kubectl and other CLI tools to complete each task.',
      },
    ],

    subjects: [
      {
        name: 'Application Design and Build',
        weight: 20,
        topics: [
          { name: 'Defining, building, and modifying container images' },
          { name: 'Multi-container pod patterns' },
          { name: 'Resource requirements and limits' },
        ],
        chapters: [
          {
            name: 'Container Design',
            topics: [
              { name: 'Dockerfile best practices and multi-stage builds' },
              { name: 'Init containers, sidecars, and adapters' },
              { name: 'Jobs and CronJobs for batch workloads' },
            ],
          },
        ],
      },
      {
        name: 'Application Deployment',
        weight: 20,
        topics: [
          { name: 'Deployment strategies and rollbacks' },
          { name: 'Helm for package management' },
          { name: 'Blue-green and canary deployments' },
        ],
        chapters: [
          {
            name: 'Deployments',
            topics: [
              { name: 'Rolling updates, rollbacks, and scaling strategies' },
              { name: 'Helm chart creation and management' },
              { name: 'Kustomize for configuration overlays' },
            ],
          },
        ],
      },
      {
        name: 'Application Environment, Configuration, and Security',
        weight: 25,
        topics: [
          { name: 'ConfigMaps and Secrets' },
          { name: 'SecurityContexts and resource limits' },
          { name: 'Service accounts and RBAC for applications' },
        ],
        chapters: [
          {
            name: 'Configuration',
            topics: [
              { name: 'ConfigMaps: creation, mounting, and environment variables' },
              { name: 'Secrets: types, creation, and secure usage' },
              { name: 'ResourceQuotas and LimitRanges' },
            ],
          },
          {
            name: 'Security',
            topics: [
              { name: 'SecurityContext: runAsUser, readOnlyRootFilesystem, capabilities' },
              { name: 'Service accounts and token projection' },
              { name: 'Pod Security Admission and standards' },
            ],
          },
        ],
      },
      {
        name: 'Services and Networking',
        weight: 20,
        topics: [
          { name: 'Networking fundamentals and Services' },
          { name: 'Ingress controllers and TLS' },
          { name: 'Network policies for application security' },
        ],
        chapters: [
          {
            name: 'Networking',
            topics: [
              { name: 'Service types and when to use each' },
              { name: 'Ingress rules with TLS termination' },
              { name: 'NetworkPolicy for pod isolation' },
            ],
          },
        ],
      },
      {
        name: 'Application Observability and Maintenance',
        weight: 15,
        topics: [
          { name: 'Probes: liveness, readiness, startup' },
          { name: 'Monitoring and logging patterns' },
          { name: 'Debugging applications' },
        ],
        chapters: [
          {
            name: 'Observability',
            topics: [
              { name: 'Liveness, readiness, and startup probe configuration' },
              { name: 'Container logging and kubectl logs' },
              { name: 'Debugging with kubectl exec, describe, and events' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The CKAD is a performance-based exam focused on application development on Kubernetes. Tests ability to design, build, configure, and expose cloud-native applications. Based on Kubernetes v1.35.',
      totalDuration: 120,
      passingScore: 66,
      tips: [
        'Speed is essential — practice generating YAML with kubectl --dry-run=client -o yaml',
        'Know all probe types (liveness, readiness, startup) and their configuration',
        'Multi-container pod patterns (sidecar, init, adapter) appear frequently',
        'Practice Helm chart basics — template, install, upgrade, rollback',
        'NetworkPolicy YAML syntax is commonly tested — memorize the structure',
        'Use kubectl explain to quickly look up resource fields during the exam',
      ],
    },

    questionStyle: 'The real exam is 100% hands-on CLI tasks. These practice questions test the same knowledge domains conceptually. Real tasks require creating deployments, configuring pods, setting up services, and troubleshooting applications in a live Kubernetes environment.',
  },

  // ─── 6. CKS — Certified Kubernetes Security Specialist ───────────
  {
    id: 'cncf-cks',
    vendor: 'CNCF',
    certName: 'Certified Kubernetes Security Specialist',
    certCode: 'CKS',
    aliases: [
      /\bcks\b/i,
      /\bcertified\s*kubernetes\s*security\s*specialist\b/i,
      /\bkubernetes\s*security\b/i,
      /\bk8s\s*security\b/i,
    ],

    passingThresholdPercent: 67,
    totalDurationMinutes: 120,
    questionCountTotal: 17,
    scoringScale: { passing: 67, max: 100 },
    questionTypes: 'Performance-based (hands-on CLI tasks)',
    performanceBased: true,

    formats: [
      {
        formatName: 'CKS Performance Exam',
        description: 'Hands-on security tasks in a live Kubernetes cluster environment. Requires active CKA certification.',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 17,
        sectionType: 'practical',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: false,
        instructions: 'You have access to a live terminal. Use kubectl, trivy, falco, and other security tools to complete each task. Active CKA required.',
      },
    ],

    subjects: [
      {
        name: 'Cluster Setup',
        weight: 10,
        topics: [
          { name: 'CIS Benchmarks for Kubernetes' },
          { name: 'Network security policies' },
          { name: 'Ingress security and TLS' },
        ],
        chapters: [
          {
            name: 'Secure Cluster Configuration',
            topics: [
              { name: 'CIS Benchmark compliance scanning with kube-bench' },
              { name: 'Restrict API server access and audit logging' },
              { name: 'Ingress TLS configuration and certificate management' },
            ],
          },
        ],
      },
      {
        name: 'Cluster Hardening',
        weight: 15,
        topics: [
          { name: 'RBAC hardening' },
          { name: 'Service account security' },
          { name: 'Restricting API access' },
        ],
        chapters: [
          {
            name: 'Access Control Hardening',
            topics: [
              { name: 'Least-privilege RBAC role design' },
              { name: 'Service account token management and automount control' },
              { name: 'API server authentication and authorization modes' },
            ],
          },
          {
            name: 'Upgrade and Patch Management',
            topics: [
              { name: 'Kubernetes version upgrade security considerations' },
              { name: 'OS patching and node security maintenance' },
              { name: 'etcd encryption at rest' },
            ],
          },
        ],
      },
      {
        name: 'System Hardening',
        weight: 15,
        topics: [
          { name: 'Minimize host OS footprint' },
          { name: 'Kernel hardening with AppArmor and seccomp' },
          { name: 'Minimize external network access' },
        ],
        chapters: [
          {
            name: 'OS and Runtime Security',
            topics: [
              { name: 'AppArmor profiles for pod confinement' },
              { name: 'seccomp profiles for system call filtering' },
              { name: 'Reducing attack surface: unnecessary packages, services, ports' },
            ],
          },
        ],
      },
      {
        name: 'Minimize Microservice Vulnerabilities',
        weight: 20,
        topics: [
          { name: 'Pod Security Standards and admission' },
          { name: 'Container runtime sandboxing (gVisor, Kata)' },
          { name: 'Secrets management and encryption' },
        ],
        chapters: [
          {
            name: 'Pod Security',
            topics: [
              { name: 'Pod Security Admission: enforce, audit, warn modes' },
              { name: 'SecurityContext: runAsNonRoot, readOnlyRootFilesystem, drop capabilities' },
              { name: 'RuntimeClass for sandboxed containers' },
            ],
          },
          {
            name: 'Secrets and mTLS',
            topics: [
              { name: 'Encrypting Secrets at rest with EncryptionConfiguration' },
              { name: 'External secrets management (HashiCorp Vault, sealed-secrets)' },
              { name: 'mTLS with service mesh for pod-to-pod encryption' },
            ],
          },
        ],
      },
      {
        name: 'Supply Chain Security',
        weight: 20,
        topics: [
          { name: 'Image scanning and vulnerability detection' },
          { name: 'Image signing and admission control' },
          { name: 'Supply chain best practices' },
        ],
        chapters: [
          {
            name: 'Image Security',
            topics: [
              { name: 'Trivy and other scanners for vulnerability detection' },
              { name: 'Admission controllers for image policy (ImagePolicyWebhook)' },
              { name: 'Minimizing base image attack surface (distroless, scratch)' },
            ],
          },
          {
            name: 'Supply Chain',
            topics: [
              { name: 'Image signing with cosign and Sigstore' },
              { name: 'SBOM generation and vulnerability tracking' },
              { name: 'Private registry configuration and access controls' },
            ],
          },
        ],
      },
      {
        name: 'Monitoring, Logging, and Runtime Security',
        weight: 20,
        topics: [
          { name: 'Runtime threat detection with Falco' },
          { name: 'Audit logging and analysis' },
          { name: 'Immutable containers and forensics' },
        ],
        chapters: [
          {
            name: 'Runtime Security',
            topics: [
              { name: 'Falco rules for runtime anomaly detection' },
              { name: 'Kubernetes Audit Policy configuration and log analysis' },
              { name: 'Immutable containers and forensic investigation' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The CKS is an advanced performance-based exam focused on Kubernetes security. Requires active CKA certification. Tests ability to secure cluster infrastructure, workloads, and supply chain. Uses tools like Trivy, Falco, and kube-bench in a live environment.',
      totalDuration: 120,
      passingScore: 67,
      tips: [
        'CKA is a prerequisite — you must hold an active CKA before taking CKS',
        'Practice with Falco rules and Trivy scanning — they appear on most exams',
        'Know NetworkPolicy YAML for both ingress and egress restrictions',
        'AppArmor and seccomp profiles are commonly tested — practice applying them',
        'Understand Pod Security Admission (enforce, audit, warn) modes thoroughly',
        'Supply chain security (image scanning, signing, admission control) is a major focus',
      ],
    },

    questionStyle: 'The real exam is 100% hands-on CLI tasks. These practice questions test the same knowledge domains conceptually. Real tasks require securing clusters, scanning images, configuring RBAC, applying security policies, and investigating runtime threats in a live environment.',
  },

  // ─── 7. KCNA — Kubernetes and Cloud Native Associate ─────────────
  {
    id: 'cncf-kcna',
    vendor: 'CNCF',
    certName: 'Kubernetes and Cloud Native Associate',
    certCode: 'KCNA',
    aliases: [
      /\bkcna\b/i,
      /\bkubernetes\s*and\s*cloud\s*native\s*associate\b/i,
      /\bcloud\s*native\s*associate\b/i,
      /\bk8s\s*associate\b/i,
    ],

    passingThresholdPercent: 75,
    totalDurationMinutes: 90,
    questionCountTotal: 60,
    scoringScale: { passing: 75, max: 100 },
    questionTypes: 'Multiple choice',
    performanceBased: false,

    formats: [
      {
        formatName: 'KCNA Exam',
        description: '60 MCQ questions on Kubernetes and cloud-native fundamentals',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 60,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Kubernetes Fundamentals',
        weight: 46,
        topics: [
          { name: 'Kubernetes architecture and components' },
          { name: 'Kubernetes API and resource model' },
          { name: 'Container fundamentals' },
        ],
        chapters: [
          {
            name: 'Architecture',
            topics: [
              { name: 'Control plane components (API server, etcd, scheduler, controller manager)' },
              { name: 'Worker node components (kubelet, kube-proxy, container runtime)' },
              { name: 'Kubernetes networking model and CNI' },
            ],
          },
          {
            name: 'Core Resources',
            topics: [
              { name: 'Pods, Deployments, Services, and ConfigMaps' },
              { name: 'Namespaces, labels, and selectors' },
              { name: 'RBAC concepts and service accounts' },
            ],
          },
        ],
      },
      {
        name: 'Container Orchestration',
        weight: 22,
        topics: [
          { name: 'Container runtime fundamentals' },
          { name: 'Container networking and storage' },
          { name: 'Container security basics' },
        ],
        chapters: [
          {
            name: 'Orchestration Concepts',
            topics: [
              { name: 'Container lifecycle management' },
              { name: 'Scheduling, scaling, and self-healing' },
              { name: 'Service discovery and load balancing' },
            ],
          },
        ],
      },
      {
        name: 'Cloud Native Architecture',
        weight: 16,
        topics: [
          { name: 'Cloud native design principles' },
          { name: '12-factor app methodology' },
          { name: 'Microservices patterns' },
        ],
        chapters: [
          {
            name: 'Architecture Patterns',
            topics: [
              { name: 'Microservices vs monolith trade-offs' },
              { name: 'Serverless and Function-as-a-Service concepts' },
              { name: 'CNCF landscape and project categories' },
            ],
          },
        ],
      },
      {
        name: 'Cloud Native Observability',
        weight: 8,
        topics: [
          { name: 'Monitoring with Prometheus' },
          { name: 'Logging and tracing' },
          { name: 'Observability pillars' },
        ],
        chapters: [
          {
            name: 'Observability',
            topics: [
              { name: 'Prometheus metrics and Grafana dashboards' },
              { name: 'Distributed tracing concepts (Jaeger, OpenTelemetry)' },
              { name: 'Centralized logging patterns' },
            ],
          },
        ],
      },
      {
        name: 'Cloud Native Application Delivery',
        weight: 8,
        topics: [
          { name: 'GitOps fundamentals' },
          { name: 'CI/CD for cloud-native' },
          { name: 'Helm and package management' },
        ],
        chapters: [
          {
            name: 'Delivery',
            topics: [
              { name: 'GitOps with Argo CD and Flux' },
              { name: 'Helm charts and Kustomize overlays' },
              { name: 'CI/CD pipeline patterns for Kubernetes' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The KCNA is a foundational-level multiple-choice exam for Kubernetes and cloud-native technologies. It tests conceptual understanding rather than hands-on skills. Good preparation for CKA/CKAD. Covers Kubernetes architecture, CNCF ecosystem, and cloud-native principles.',
      totalDuration: 90,
      passingScore: 75,
      tips: [
        'Kubernetes Fundamentals is 46% of the exam — focus your study time there',
        'Understand the CNCF landscape and major project categories',
        'Know Kubernetes architecture (control plane vs worker node components)',
        'GitOps concepts (Argo CD, Flux) and Helm basics are tested',
        'This is conceptual, not hands-on — focus on understanding "what" and "why"',
      ],
    },

    questionStyle: 'Multiple-choice questions testing conceptual understanding of Kubernetes architecture, cloud-native principles, and the CNCF ecosystem. No hands-on tasks. Questions ask about architecture decisions, component roles, and best practices.',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  COMPTIA (9)
  // ═══════════════════════════════════════════════════════════════════

  // ─── 8. CompTIA A+ ───────────────────────────────────────────────
  {
    id: 'comptia-a-plus',
    vendor: 'CompTIA',
    certName: 'A+',
    certCode: '220-1201 / 220-1202',
    aliases: [
      /\bcomptia\s*a\+/i,
      /\bcomptia\s*a\s*plus\b/i,
      /\ba\+\s*cert(ification)?\b/i,
      /\b220-120[12]\b/i,
    ],

    passingThresholdPercent: 75,
    totalDurationMinutes: 180,
    questionCountTotal: 180,
    scoringScale: { passing: 675, max: 900 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'Core 1 (220-1201)',
        description: 'Mobile devices, networking, hardware, virtualization/cloud, and troubleshooting',
        timeAllocation: 90,
        pointWeight: 50,
        questionCount: 90,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        passingScore: 675,
      },
      {
        formatName: 'Core 2 (220-1202)',
        description: 'Operating systems, security, software troubleshooting, and operational procedures',
        timeAllocation: 90,
        pointWeight: 50,
        questionCount: 90,
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
        name: 'Mobile Devices',
        weight: 13,
        topics: [
          { name: 'Laptop hardware and components' },
          { name: 'Mobile device connectivity and accessories' },
          { name: 'Mobile device troubleshooting' },
        ],
        chapters: [
          {
            name: 'Laptop and Mobile Hardware',
            topics: [
              { name: 'Laptop display types, batteries, and input devices' },
              { name: 'Mobile device synchronization and connectivity' },
              { name: 'Mobile OS features (iOS, Android)' },
            ],
          },
        ],
      },
      {
        name: 'Networking',
        weight: 23,
        topics: [
          { name: 'TCP/IP and networking fundamentals' },
          { name: 'Network hardware and configurations' },
          { name: 'Wireless networking' },
        ],
        chapters: [
          {
            name: 'Network Fundamentals',
            topics: [
              { name: 'TCP/IP model, ports, and protocols' },
              { name: 'IPv4 and IPv6 addressing and subnetting basics' },
              { name: 'DNS, DHCP, and network services' },
            ],
          },
          {
            name: 'Network Hardware',
            topics: [
              { name: 'Routers, switches, access points, and firewalls' },
              { name: 'Cable types (Cat5e, Cat6, fiber) and connectors' },
              { name: 'Wireless standards (Wi-Fi 6/6E) and configuration' },
            ],
          },
        ],
      },
      {
        name: 'Hardware',
        weight: 25,
        topics: [
          { name: 'Motherboards, CPUs, and RAM' },
          { name: 'Storage devices and RAID' },
          { name: 'Peripherals and power supplies' },
        ],
        chapters: [
          {
            name: 'Core Components',
            topics: [
              { name: 'CPU architectures, sockets, and cooling' },
              { name: 'RAM types (DDR4, DDR5) and installation' },
              { name: 'Storage technologies (SSD, NVMe, HDD, RAID levels)' },
            ],
          },
          {
            name: 'Peripherals and Power',
            topics: [
              { name: 'Display technologies (LCD, OLED, resolution)' },
              { name: 'Printers: laser, inkjet, thermal, 3D' },
              { name: 'Power supply unit ratings and connector types' },
            ],
          },
        ],
      },
      {
        name: 'Virtualization and Cloud Computing',
        weight: 11,
        topics: [
          { name: 'Cloud computing models (IaaS, PaaS, SaaS)' },
          { name: 'Client-side virtualization' },
          { name: 'Cloud deployment models' },
        ],
        chapters: [
          {
            name: 'Virtualization and Cloud',
            topics: [
              { name: 'Hypervisor types (Type 1 and Type 2)' },
              { name: 'Virtual machine setup and resource allocation' },
              { name: 'Cloud service models and shared responsibility' },
            ],
          },
        ],
      },
      {
        name: 'Hardware and Network Troubleshooting',
        weight: 28,
        topics: [
          { name: 'Troubleshooting methodology' },
          { name: 'Hardware troubleshooting' },
          { name: 'Network troubleshooting' },
        ],
        chapters: [
          {
            name: 'Troubleshooting Process',
            topics: [
              { name: 'CompTIA troubleshooting model (identify, theory, test, plan, verify, document)' },
              { name: 'Common hardware failures (POST codes, beep codes, LED indicators)' },
              { name: 'Network connectivity troubleshooting tools (ping, tracert, ipconfig, nslookup)' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA A+ requires passing two separate exams (Core 1 and Core 2). Core 1 covers hardware, networking, and mobile devices. Core 2 covers OS, security, and operational procedures. This is the foundational IT certification and a prerequisite for many IT careers. Both exams must be passed to earn the A+ credential.',
      totalDuration: 180,
      passingScore: 675,
      tips: [
        'You must pass BOTH Core 1 and Core 2 — they are separate exam sessions',
        'Core 1 is more hardware-focused; Core 2 is more software and security-focused',
        'Troubleshooting is 28% of Core 1 — memorize the CompTIA troubleshooting methodology',
        'Know common ports (80, 443, 22, 23, 25, 53, 67/68, 110, 143, 3389)',
        'Performance-based questions (PBQs) appear first — skip and return to them if stuck',
        'Practice identifying hardware components by sight for drag-and-drop questions',
      ],
    },

    questionStyle: 'Mix of multiple-choice and performance-based questions (simulations). Questions test practical IT support knowledge — hardware identification, troubleshooting steps, network configuration. PBQs may simulate a command prompt, configuration screen, or hardware setup scenario.',
  },

  // ─── 9. CompTIA Network+ ─────────────────────────────────────────
  {
    id: 'comptia-network-plus',
    vendor: 'CompTIA',
    certName: 'Network+',
    certCode: 'N10-009',
    aliases: [
      /\bcomptia\s*network\+/i,
      /\bcomptia\s*network\s*plus\b/i,
      /\bnetwork\+/i,
      /\bn10-009\b/i,
    ],

    passingThresholdPercent: 80,
    totalDurationMinutes: 90,
    questionCountTotal: 90,
    scoringScale: { passing: 720, max: 900 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'Network+ Exam',
        description: '90 questions covering networking fundamentals, implementation, operations, security, and troubleshooting',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 90,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Networking Fundamentals',
        weight: 24,
        topics: [
          { name: 'OSI model and TCP/IP' },
          { name: 'Network topologies and types' },
          { name: 'IP addressing and subnetting' },
        ],
        chapters: [
          {
            name: 'Network Models',
            topics: [
              { name: 'OSI 7-layer model and encapsulation' },
              { name: 'TCP/IP model and protocol suite' },
              { name: 'IPv4 subnetting, CIDR, and IPv6 addressing' },
            ],
          },
          {
            name: 'Network Architecture',
            topics: [
              { name: 'WAN technologies (MPLS, SD-WAN, broadband)' },
              { name: 'Network types: LAN, WAN, MAN, PAN, SAN' },
              { name: 'Cloud and virtualization networking concepts' },
            ],
          },
        ],
      },
      {
        name: 'Network Implementations',
        weight: 19,
        topics: [
          { name: 'Routing and switching' },
          { name: 'Wireless technologies' },
          { name: 'Network device placement' },
        ],
        chapters: [
          {
            name: 'Routing and Switching',
            topics: [
              { name: 'Routing protocols (OSPF, EIGRP, BGP, RIP)' },
              { name: 'VLAN configuration and inter-VLAN routing' },
              { name: 'Spanning Tree Protocol and port aggregation' },
            ],
          },
          {
            name: 'Wireless',
            topics: [
              { name: 'Wi-Fi standards (802.11ax/Wi-Fi 6, 802.11be/Wi-Fi 7)' },
              { name: 'Wireless security (WPA3, EAP, RADIUS)' },
              { name: 'Access point placement and site survey' },
            ],
          },
        ],
      },
      {
        name: 'Network Operations',
        weight: 16,
        topics: [
          { name: 'Monitoring and management' },
          { name: 'High availability and disaster recovery' },
          { name: 'Documentation and policies' },
        ],
        chapters: [
          {
            name: 'Operations',
            topics: [
              { name: 'SNMP, syslog, and network monitoring tools' },
              { name: 'Backup strategies and disaster recovery planning' },
              { name: 'Network documentation (diagrams, baselines, change management)' },
            ],
          },
        ],
      },
      {
        name: 'Network Security',
        weight: 14,
        topics: [
          { name: 'Security concepts and threats' },
          { name: 'Network hardening' },
          { name: 'Remote access and VPN' },
        ],
        chapters: [
          {
            name: 'Security',
            topics: [
              { name: 'Common network attacks (DoS, MITM, ARP spoofing, DNS poisoning)' },
              { name: 'Firewall types, ACLs, and intrusion detection/prevention' },
              { name: 'VPN types (site-to-site, client-to-site, SSL/TLS, IPSec)' },
            ],
          },
        ],
      },
      {
        name: 'Network Troubleshooting',
        weight: 27,
        topics: [
          { name: 'Troubleshooting methodology' },
          { name: 'Connectivity and performance issues' },
          { name: 'Network tool usage' },
        ],
        chapters: [
          {
            name: 'Troubleshooting',
            topics: [
              { name: 'Troubleshooting tools (ping, traceroute, nslookup, netstat, Wireshark)' },
              { name: 'Cable testing and physical layer troubleshooting' },
              { name: 'Wireless troubleshooting (interference, signal strength, channel overlap)' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA Network+ validates networking knowledge required for IT infrastructure roles. Covers networking fundamentals, implementation, operations, security, and troubleshooting. Vendor-neutral certification recognized across the IT industry.',
      totalDuration: 90,
      passingScore: 720,
      tips: [
        'Subnetting is essential — practice until you can do it quickly and accurately',
        'Troubleshooting is 27% — know every command-line network tool and what it shows',
        'Memorize common ports and their protocols',
        'Understand OSI model layer functions and which protocols operate at each layer',
        'Wireless security and standards are frequently tested',
      ],
    },

    questionStyle: 'Mix of multiple-choice and performance-based questions testing practical networking knowledge. Scenarios present network diagrams, topologies, and real-world situations. PBQs may involve configuring network devices, troubleshooting connectivity, or analyzing packet captures.',
  },

  // ─── 10. CompTIA Security+ ──────────────────────────────────────
  {
    id: 'comptia-security-plus',
    vendor: 'CompTIA',
    certName: 'Security+',
    certCode: 'SY0-701',
    aliases: [
      /\bcomptia\s*security\+/i,
      /\bcomptia\s*security\s*plus\b/i,
      /\bsecurity\+/i,
      /\bsy0-701\b/i,
    ],

    passingThresholdPercent: 83,
    totalDurationMinutes: 90,
    questionCountTotal: 90,
    scoringScale: { passing: 750, max: 900 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'Security+ Exam',
        description: '90 questions on security concepts, threats, architecture, operations, and governance',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 90,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'General Security Concepts',
        weight: 12,
        topics: [
          { name: 'Security controls and frameworks' },
          { name: 'CIA triad and zero trust' },
          { name: 'Authentication and authorization' },
        ],
        chapters: [
          {
            name: 'Security Fundamentals',
            topics: [
              { name: 'CIA triad, AAA framework, and non-repudiation' },
              { name: 'Zero trust architecture principles' },
              { name: 'Security control types (technical, managerial, operational, physical)' },
            ],
          },
        ],
      },
      {
        name: 'Threats, Vulnerabilities, and Mitigations',
        weight: 22,
        topics: [
          { name: 'Threat actors and attack vectors' },
          { name: 'Common vulnerabilities and exploits' },
          { name: 'Mitigation techniques' },
        ],
        chapters: [
          {
            name: 'Threats and Attacks',
            topics: [
              { name: 'Social engineering (phishing, vishing, smishing, pretexting)' },
              { name: 'Malware types (ransomware, trojans, rootkits, fileless)' },
              { name: 'Application attacks (XSS, SQLi, CSRF, SSRF, injection)' },
            ],
          },
          {
            name: 'Vulnerability Management',
            topics: [
              { name: 'Vulnerability scanning and penetration testing' },
              { name: 'CVSS scoring and risk prioritization' },
              { name: 'Patch management and hardening' },
            ],
          },
        ],
      },
      {
        name: 'Security Architecture',
        weight: 18,
        topics: [
          { name: 'Network security architecture' },
          { name: 'Cloud and hybrid security' },
          { name: 'Cryptographic concepts' },
        ],
        chapters: [
          {
            name: 'Architecture Design',
            topics: [
              { name: 'Network segmentation, DMZ, and micro-segmentation' },
              { name: 'Cloud security models (CASB, CSPM, CWPP)' },
              { name: 'PKI, certificates, and encryption algorithms' },
            ],
          },
        ],
      },
      {
        name: 'Security Operations',
        weight: 28,
        topics: [
          { name: 'Security monitoring and detection' },
          { name: 'Incident response' },
          { name: 'Digital forensics basics' },
        ],
        chapters: [
          {
            name: 'Detection and Monitoring',
            topics: [
              { name: 'SIEM, SOAR, and log analysis' },
              { name: 'IDS/IPS types and placement' },
              { name: 'Endpoint detection and response (EDR/XDR)' },
            ],
          },
          {
            name: 'Incident Response',
            topics: [
              { name: 'IR phases (preparation, detection, containment, eradication, recovery, lessons learned)' },
              { name: 'Chain of custody and evidence handling' },
              { name: 'Business continuity and disaster recovery' },
            ],
          },
        ],
      },
      {
        name: 'Security Program Management and Oversight',
        weight: 20,
        topics: [
          { name: 'Governance and compliance' },
          { name: 'Risk management' },
          { name: 'Security awareness and training' },
        ],
        chapters: [
          {
            name: 'Governance',
            topics: [
              { name: 'Regulatory frameworks (GDPR, HIPAA, PCI-DSS, SOX)' },
              { name: 'Risk assessment methodologies (qualitative, quantitative)' },
              { name: 'Security policies, standards, and procedures' },
            ],
          },
          {
            name: 'Risk and Compliance',
            topics: [
              { name: 'Third-party risk management and vendor assessment' },
              { name: 'Data classification and handling' },
              { name: 'Security awareness training programs' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA Security+ (SY0-701) is the most widely recognized entry-level cybersecurity certification. Updated in 2023 with increased focus on zero trust, cloud security, and security operations. Required for many government and military IT positions (DoD 8570/8140).',
      totalDuration: 90,
      passingScore: 750,
      tips: [
        'Security Operations is 28% of the exam — master SIEM, incident response, and forensics',
        'Know attack types and their mitigations — this is the second-largest domain',
        'Understand cryptographic concepts (symmetric, asymmetric, hashing, PKI)',
        'PBQs test practical skills — expect scenarios involving firewall rules, log analysis, or certificate management',
        'Zero trust architecture is new to SY0-701 and heavily emphasized',
        'Memorize common ports and their security implications',
      ],
    },

    questionStyle: 'Mix of multiple-choice and performance-based questions. Scenario-based questions present security incidents, risk assessments, and architecture decisions. PBQs may simulate log analysis, firewall configuration, or incident response procedures.',
  },

  // ─── 11. CompTIA Cloud+ ─────────────────────────────────────────
  {
    id: 'comptia-cloud-plus',
    vendor: 'CompTIA',
    certName: 'Cloud+',
    certCode: 'CV0-004',
    aliases: [
      /\bcomptia\s*cloud\+/i,
      /\bcomptia\s*cloud\s*plus\b/i,
      /\bcloud\+/i,
      /\bcv0-004\b/i,
    ],

    passingThresholdPercent: 83,
    totalDurationMinutes: 90,
    questionCountTotal: 90,
    scoringScale: { passing: 750, max: 900 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'Cloud+ Exam',
        description: '90 questions on cloud architecture, deployment, security, operations, troubleshooting, and DevOps',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 90,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Cloud Architecture',
        weight: 23,
        topics: [
          { name: 'Cloud service and deployment models' },
          { name: 'High availability and disaster recovery' },
          { name: 'Capacity planning and sizing' },
        ],
        chapters: [
          {
            name: 'Architecture Design',
            topics: [
              { name: 'IaaS, PaaS, SaaS, and XaaS models' },
              { name: 'Public, private, hybrid, and multi-cloud architectures' },
              { name: 'HA design patterns (clustering, load balancing, auto-scaling)' },
            ],
          },
        ],
      },
      {
        name: 'Deployment',
        weight: 19,
        topics: [
          { name: 'Migration strategies' },
          { name: 'Compute, storage, and network provisioning' },
          { name: 'Containerization and orchestration' },
        ],
        chapters: [
          {
            name: 'Cloud Deployment',
            topics: [
              { name: 'Migration strategies (lift-and-shift, refactor, replatform)' },
              { name: 'Container deployment with Docker and Kubernetes' },
              { name: 'Infrastructure as code (Terraform, CloudFormation)' },
            ],
          },
        ],
      },
      {
        name: 'Security',
        weight: 19,
        topics: [
          { name: 'Identity and access management' },
          { name: 'Data security and encryption' },
          { name: 'Compliance and governance' },
        ],
        chapters: [
          {
            name: 'Cloud Security',
            topics: [
              { name: 'IAM policies, MFA, and federation' },
              { name: 'Encryption at rest and in transit' },
              { name: 'Network security (security groups, NACLs, WAF)' },
            ],
          },
        ],
      },
      {
        name: 'Operations',
        weight: 17,
        topics: [
          { name: 'Monitoring and alerting' },
          { name: 'Backup and restore operations' },
          { name: 'Configuration management' },
        ],
        chapters: [
          {
            name: 'Cloud Operations',
            topics: [
              { name: 'Monitoring tools and log aggregation' },
              { name: 'Backup strategies and RPO/RTO planning' },
              { name: 'Configuration management (Ansible, Puppet, Chef)' },
            ],
          },
        ],
      },
      {
        name: 'Troubleshooting',
        weight: 12,
        topics: [
          { name: 'Cloud connectivity issues' },
          { name: 'Performance troubleshooting' },
          { name: 'Security incident response' },
        ],
        chapters: [
          {
            name: 'Troubleshooting',
            topics: [
              { name: 'Network connectivity and latency diagnosis' },
              { name: 'Storage and compute performance issues' },
              { name: 'Authentication and authorization failures' },
            ],
          },
        ],
      },
      {
        name: 'DevOps Fundamentals',
        weight: 10,
        topics: [
          { name: 'CI/CD pipeline concepts' },
          { name: 'Version control and automation' },
          { name: 'Testing methodologies' },
        ],
        chapters: [
          {
            name: 'DevOps',
            topics: [
              { name: 'CI/CD pipeline stages and tools' },
              { name: 'Git branching strategies and version control' },
              { name: 'Automated testing in deployment pipelines' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA Cloud+ validates vendor-neutral cloud computing skills. Covers architecture, deployment, security, operations, troubleshooting, and DevOps. Good for IT professionals transitioning to cloud roles without vendor lock-in.',
      totalDuration: 90,
      passingScore: 750,
      tips: [
        'Cloud Architecture is the largest domain at 23% — know all service and deployment models',
        'This is vendor-neutral: understand concepts that apply across AWS, Azure, and GCP',
        'Know migration strategies and when to use each one',
        'Container and Kubernetes fundamentals are tested in the Deployment domain',
        'IAM, encryption, and network security are critical for the Security domain',
      ],
    },

    questionStyle: 'Vendor-neutral multiple-choice and performance-based questions testing cloud concepts applicable across providers. Scenarios present architecture decisions, migration challenges, and operational situations without reference to specific cloud vendor products.',
  },

  // ─── 12. CompTIA CySA+ ──────────────────────────────────────────
  {
    id: 'comptia-cysa-plus',
    vendor: 'CompTIA',
    certName: 'CySA+',
    certCode: 'CS0-003',
    retirementDate: '2026-06-30',
    aliases: [
      /\bcomptia\s*cysa\+/i,
      /\bcomptia\s*cysa\s*plus\b/i,
      /\bcysa\+/i,
      /\bcs0-003\b/i,
    ],

    passingThresholdPercent: 83,
    totalDurationMinutes: 165,
    questionCountTotal: 85,
    scoringScale: { passing: 750, max: 900 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'CySA+ Exam',
        description: '85 questions on security operations, vulnerability management, incident response, and reporting (retires June 30, 2026)',
        timeAllocation: 165,
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
        name: 'Security Operations',
        weight: 33,
        topics: [
          { name: 'Security monitoring and analysis' },
          { name: 'Threat intelligence' },
          { name: 'Security tool management' },
        ],
        chapters: [
          {
            name: 'Security Analysis',
            topics: [
              { name: 'SIEM configuration, queries, and correlation rules' },
              { name: 'Threat intelligence sources and frameworks (MITRE ATT&CK)' },
              { name: 'Indicator of compromise (IoC) analysis' },
            ],
          },
          {
            name: 'Monitoring Tools',
            topics: [
              { name: 'Network traffic analysis (packet capture, flow data)' },
              { name: 'Endpoint monitoring and EDR tools' },
              { name: 'Email security and phishing analysis' },
            ],
          },
        ],
      },
      {
        name: 'Vulnerability Management',
        weight: 30,
        topics: [
          { name: 'Vulnerability scanning and assessment' },
          { name: 'Vulnerability prioritization and remediation' },
          { name: 'Configuration and patch management' },
        ],
        chapters: [
          {
            name: 'Vulnerability Assessment',
            topics: [
              { name: 'Vulnerability scanner configuration (Nessus, Qualys, OpenVAS)' },
              { name: 'CVSS scoring and risk-based prioritization' },
              { name: 'False positive identification and validation' },
            ],
          },
          {
            name: 'Remediation',
            topics: [
              { name: 'Patch management processes and automation' },
              { name: 'Configuration hardening and baselines' },
              { name: 'Exception handling and risk acceptance' },
            ],
          },
        ],
      },
      {
        name: 'Incident Response Management',
        weight: 20,
        topics: [
          { name: 'Incident response process' },
          { name: 'Digital forensics techniques' },
          { name: 'Malware analysis basics' },
        ],
        chapters: [
          {
            name: 'Incident Response',
            topics: [
              { name: 'IR lifecycle phases and playbooks' },
              { name: 'Containment, eradication, and recovery steps' },
              { name: 'Forensic data collection and chain of custody' },
            ],
          },
        ],
      },
      {
        name: 'Reporting and Communication',
        weight: 17,
        topics: [
          { name: 'Security reporting and metrics' },
          { name: 'Stakeholder communication' },
          { name: 'Compliance reporting' },
        ],
        chapters: [
          {
            name: 'Reporting',
            topics: [
              { name: 'Vulnerability scan report interpretation and presentation' },
              { name: 'Incident report documentation and lessons learned' },
              { name: 'KPIs and KRIs for security operations' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA CySA+ (CS0-003) is an intermediate cybersecurity analyst certification. Focuses on security operations, threat detection, and vulnerability management. Note: This exam retires June 30, 2026. Aimed at SOC analysts and security operations roles.',
      totalDuration: 165,
      passingScore: 750,
      tips: [
        'WARNING: This exam retires June 30, 2026 — plan your exam date accordingly',
        'Security Operations is 33% — master SIEM usage, log analysis, and threat intelligence',
        'Vulnerability Management is 30% — know scanner tools, CVSS, and remediation workflows',
        'MITRE ATT&CK framework knowledge is heavily tested',
        'Practice reading and analyzing log outputs and packet captures',
        'The 165-minute time limit is generous — use it for PBQs',
      ],
    },

    questionStyle: 'Scenario-based questions presenting security operations situations. Includes log analysis, vulnerability scan output interpretation, and incident response scenarios. PBQs may simulate SIEM queries, vulnerability assessment, or network traffic analysis.',
  },

  // ─── 13. CompTIA SecurityX (CASP+) ──────────────────────────────
  {
    id: 'comptia-securityx',
    vendor: 'CompTIA',
    certName: 'SecurityX',
    certCode: 'CAS-005',
    aliases: [
      /\bcomptia\s*securityx\b/i,
      /\bsecurityx\b/i,
      /\bcas-005\b/i,
      /\bcomptia\s*casp\+/i,
      /\bcasp\+/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 165,
    questionCountTotal: 90,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'SecurityX Exam',
        description: '90 questions on advanced security architecture, operations, engineering, and GRC',
        timeAllocation: 165,
        pointWeight: 100,
        questionCount: 90,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Security Architecture',
        weight: 29,
        topics: [
          { name: 'Enterprise security architecture' },
          { name: 'Zero trust and defense in depth' },
          { name: 'Cloud and hybrid security design' },
        ],
        chapters: [
          {
            name: 'Architecture Design',
            topics: [
              { name: 'Zero trust architecture implementation' },
              { name: 'Micro-segmentation and software-defined networking' },
              { name: 'Cloud security architecture (CASB, CSPM, SASE)' },
            ],
          },
          {
            name: 'Secure Infrastructure',
            topics: [
              { name: 'Secure network design and segmentation' },
              { name: 'Cryptographic architecture decisions' },
              { name: 'IoT and embedded systems security' },
            ],
          },
        ],
      },
      {
        name: 'Security Operations',
        weight: 30,
        topics: [
          { name: 'Threat hunting and detection engineering' },
          { name: 'Incident response and forensics' },
          { name: 'Security automation and orchestration' },
        ],
        chapters: [
          {
            name: 'Advanced Operations',
            topics: [
              { name: 'Threat hunting methodologies and hypothesis-driven investigation' },
              { name: 'SOAR playbook development and automation' },
              { name: 'Advanced forensics and malware analysis' },
            ],
          },
          {
            name: 'Detection Engineering',
            topics: [
              { name: 'Detection rule creation (SIGMA, YARA)' },
              { name: 'Threat intelligence integration and enrichment' },
              { name: 'Attack simulation and purple teaming' },
            ],
          },
        ],
      },
      {
        name: 'Security Engineering and Cryptography',
        weight: 26,
        topics: [
          { name: 'Secure software development' },
          { name: 'Cryptographic systems and PKI' },
          { name: 'Application and API security' },
        ],
        chapters: [
          {
            name: 'Engineering',
            topics: [
              { name: 'Secure SDLC and DevSecOps integration' },
              { name: 'PKI architecture, certificate lifecycle, and key management' },
              { name: 'Cryptographic protocol selection and implementation' },
            ],
          },
          {
            name: 'Application Security',
            topics: [
              { name: 'API security and OAuth/OIDC flows' },
              { name: 'Web application security (OWASP Top 10)' },
              { name: 'Code review and static/dynamic analysis' },
            ],
          },
        ],
      },
      {
        name: 'Governance, Risk, and Compliance',
        weight: 15,
        topics: [
          { name: 'Risk management frameworks' },
          { name: 'Regulatory compliance' },
          { name: 'Third-party and supply chain risk' },
        ],
        chapters: [
          {
            name: 'GRC',
            topics: [
              { name: 'Risk assessment and quantification (ALE, ARO, SLE)' },
              { name: 'Compliance frameworks (NIST CSF, ISO 27001, COBIT)' },
              { name: 'Supply chain risk management and vendor assessments' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA SecurityX (formerly CASP+, CAS-005) is the most advanced CompTIA security certification. Tests expert-level security architecture, operations, and engineering. Uses pass/fail scoring. Targets security architects and senior security engineers.',
      totalDuration: 165,
      passingScore: 70,
      tips: [
        'This is pass/fail — no scaled score is reported',
        'Security Operations (30%) and Architecture (29%) dominate — focus there',
        'Expect very complex scenarios with multiple valid-looking answers',
        'Cryptographic concepts and PKI are tested at an advanced level',
        'Know threat hunting methodologies and detection engineering',
        'GRC questions focus on risk quantification and framework application',
      ],
    },

    questionStyle: 'Advanced scenario-based questions requiring expert-level security analysis. Questions present complex enterprise situations with multiple stakeholders and constraints. You must select the BEST answer among several technically valid options. Tests strategic thinking, not just technical knowledge.',
  },

  // ─── 14. CompTIA Linux+ ─────────────────────────────────────────
  {
    id: 'comptia-linux-plus',
    vendor: 'CompTIA',
    certName: 'Linux+',
    certCode: 'XK0-006',
    aliases: [
      /\bcomptia\s*linux\+/i,
      /\bcomptia\s*linux\s*plus\b/i,
      /\blinux\+/i,
      /\bxk0-006\b/i,
    ],

    passingThresholdPercent: 80,
    totalDurationMinutes: 90,
    questionCountTotal: 90,
    scoringScale: { passing: 720, max: 900 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'Linux+ Exam',
        description: '90 questions on Linux system management, services, security, scripting, and troubleshooting',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 90,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'System Management',
        weight: 23,
        topics: [
          { name: 'Package management and software installation' },
          { name: 'Filesystem management and storage' },
          { name: 'Kernel and boot process' },
        ],
        chapters: [
          {
            name: 'System Administration',
            topics: [
              { name: 'Package managers (apt, dnf/yum, zypper, pacman)' },
              { name: 'Filesystem types, partitioning, and LVM' },
              { name: 'Boot process (GRUB, systemd, runlevels/targets)' },
            ],
          },
        ],
      },
      {
        name: 'Services and User Management',
        weight: 20,
        topics: [
          { name: 'Service management with systemd' },
          { name: 'User and group management' },
          { name: 'Network services configuration' },
        ],
        chapters: [
          {
            name: 'Services',
            topics: [
              { name: 'systemctl commands, unit files, and targets' },
              { name: 'DNS, DHCP, SSH, and web server configuration' },
              { name: 'NFS, Samba, and network file sharing' },
            ],
          },
          {
            name: 'Users and Permissions',
            topics: [
              { name: 'useradd, usermod, groupadd, and passwd management' },
              { name: 'File permissions (chmod, chown, setuid, setgid, sticky bit)' },
              { name: 'ACLs and extended attributes' },
            ],
          },
        ],
      },
      {
        name: 'Security',
        weight: 18,
        topics: [
          { name: 'Firewall configuration' },
          { name: 'SELinux and AppArmor' },
          { name: 'SSH hardening and authentication' },
        ],
        chapters: [
          {
            name: 'Linux Security',
            topics: [
              { name: 'iptables/nftables and firewalld configuration' },
              { name: 'SELinux contexts, booleans, and troubleshooting' },
              { name: 'SSH key management and configuration hardening' },
            ],
          },
        ],
      },
      {
        name: 'Automation, Orchestration, and Scripting',
        weight: 17,
        topics: [
          { name: 'Bash scripting fundamentals' },
          { name: 'Task scheduling (cron, at, systemd timers)' },
          { name: 'Configuration management basics' },
        ],
        chapters: [
          {
            name: 'Automation',
            topics: [
              { name: 'Bash scripting: variables, loops, conditionals, functions' },
              { name: 'cron jobs and systemd timers for scheduling' },
              { name: 'Ansible basics for configuration management' },
            ],
          },
        ],
      },
      {
        name: 'Troubleshooting',
        weight: 22,
        topics: [
          { name: 'System performance troubleshooting' },
          { name: 'Network troubleshooting' },
          { name: 'Storage and filesystem issues' },
        ],
        chapters: [
          {
            name: 'Troubleshooting',
            topics: [
              { name: 'Performance tools (top, htop, vmstat, iostat, sar)' },
              { name: 'Log analysis with journalctl and /var/log' },
              { name: 'Network diagnostic tools (ss, ip, dig, tcpdump)' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA Linux+ validates Linux system administration skills. Covers system management, services, security, scripting, and troubleshooting. Vendor-neutral certification applicable to all Linux distributions.',
      totalDuration: 90,
      passingScore: 720,
      tips: [
        'Know command-line tools thoroughly — the exam is very CLI-focused',
        'System Management (23%) and Troubleshooting (22%) are the largest domains',
        'Practice systemd management: systemctl, journalctl, unit files',
        'SELinux troubleshooting commands (getenforce, setenforce, restorecon, audit2why) are important',
        'Know bash scripting syntax well enough to read and debug scripts',
      ],
    },

    questionStyle: 'Mix of multiple-choice and performance-based questions testing practical Linux administration. PBQs may simulate a terminal where you must execute commands, edit configuration files, or troubleshoot system issues. Strong emphasis on command-line proficiency.',
  },

  // ─── 15. CompTIA PenTest+ ───────────────────────────────────────
  {
    id: 'comptia-pentest-plus',
    vendor: 'CompTIA',
    certName: 'PenTest+',
    certCode: 'PT0-003',
    aliases: [
      /\bcomptia\s*pentest\+/i,
      /\bcomptia\s*pentest\s*plus\b/i,
      /\bpentest\+/i,
      /\bpt0-003\b/i,
    ],

    passingThresholdPercent: 83,
    totalDurationMinutes: 165,
    questionCountTotal: 85,
    scoringScale: { passing: 750, max: 900 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'PenTest+ Exam',
        description: '85 questions on penetration testing methodology, reconnaissance, exploitation, and reporting',
        timeAllocation: 165,
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
        name: 'Engagement Management',
        weight: 13,
        topics: [
          { name: 'Scoping and rules of engagement' },
          { name: 'Legal and compliance considerations' },
          { name: 'Communication and reporting' },
        ],
        chapters: [
          {
            name: 'Engagement Planning',
            topics: [
              { name: 'Scope definition, ROE, and authorization documents' },
              { name: 'Penetration testing standards (PTES, OSSTMM, OWASP)' },
              { name: 'Environmental considerations and risk mitigation' },
            ],
          },
        ],
      },
      {
        name: 'Reconnaissance and Enumeration',
        weight: 21,
        topics: [
          { name: 'Passive reconnaissance techniques' },
          { name: 'Active scanning and enumeration' },
          { name: 'OSINT and information gathering' },
        ],
        chapters: [
          {
            name: 'Reconnaissance',
            topics: [
              { name: 'OSINT tools (Maltego, Shodan, Recon-ng, theHarvester)' },
              { name: 'Nmap scanning techniques and script engine (NSE)' },
              { name: 'Service enumeration (SMB, SNMP, DNS, LDAP)' },
            ],
          },
        ],
      },
      {
        name: 'Vulnerability Discovery and Analysis',
        weight: 17,
        topics: [
          { name: 'Vulnerability scanning methodologies' },
          { name: 'Vulnerability analysis and prioritization' },
          { name: 'Common vulnerability types' },
        ],
        chapters: [
          {
            name: 'Vulnerability Analysis',
            topics: [
              { name: 'Vulnerability scanner usage (Nessus, OpenVAS)' },
              { name: 'Manual vulnerability verification and validation' },
              { name: 'Web application vulnerability assessment (Burp Suite, ZAP)' },
            ],
          },
        ],
      },
      {
        name: 'Attacks and Exploits',
        weight: 35,
        topics: [
          { name: 'Network-based attacks' },
          { name: 'Web application attacks' },
          { name: 'Wireless and social engineering attacks' },
        ],
        chapters: [
          {
            name: 'Network Attacks',
            topics: [
              { name: 'Exploitation frameworks (Metasploit, Cobalt Strike)' },
              { name: 'Password attacks (brute force, dictionary, pass-the-hash)' },
              { name: 'Privilege escalation techniques (Windows and Linux)' },
            ],
          },
          {
            name: 'Application and Wireless Attacks',
            topics: [
              { name: 'Web attacks (SQLi, XSS, SSRF, deserialization)' },
              { name: 'Wireless attacks (evil twin, deauthentication, WPA cracking)' },
              { name: 'Social engineering and physical penetration testing' },
            ],
          },
        ],
      },
      {
        name: 'Post-Exploitation and Lateral Movement',
        weight: 14,
        topics: [
          { name: 'Post-exploitation techniques' },
          { name: 'Lateral movement and pivoting' },
          { name: 'Data exfiltration and persistence' },
        ],
        chapters: [
          {
            name: 'Post-Exploitation',
            topics: [
              { name: 'Maintaining access and persistence mechanisms' },
              { name: 'Lateral movement techniques (pass-the-ticket, RDP, PSExec)' },
              { name: 'Data staging and exfiltration methods' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA PenTest+ validates hands-on penetration testing and vulnerability assessment skills. Covers the full penetration testing lifecycle from planning through exploitation and reporting. More practical than Security+, focused on offensive security.',
      totalDuration: 165,
      passingScore: 750,
      tips: [
        'Attacks and Exploits is 35% of the exam — know exploitation techniques thoroughly',
        'Know Nmap scan types, Metasploit modules, and Burp Suite features',
        'Reconnaissance and enumeration tools and techniques are heavily tested',
        'Understand the difference between passive and active reconnaissance',
        'PBQs often simulate tool usage scenarios — practice with actual tools',
        'Report writing and engagement management questions are straightforward but easy points',
      ],
    },

    questionStyle: 'Scenario-based questions presenting penetration testing situations. Includes tool output interpretation, attack methodology selection, and exploitation scenarios. PBQs may simulate using Nmap, analyzing Burp Suite output, or interpreting vulnerability scan results.',
  },

  // ─── 16. CompTIA Data+ ──────────────────────────────────────────
  {
    id: 'comptia-data-plus',
    vendor: 'CompTIA',
    certName: 'Data+',
    certCode: 'DA0-002',
    aliases: [
      /\bcomptia\s*data\+/i,
      /\bcomptia\s*data\s*plus\b/i,
      /\bdata\+/i,
      /\bda0-002\b/i,
    ],

    passingThresholdPercent: 80,
    totalDurationMinutes: 90,
    questionCountTotal: 90,
    scoringScale: { passing: 720, max: 900 },
    questionTypes: 'Multiple choice, performance-based questions',
    performanceBased: false,

    formats: [
      {
        formatName: 'Data+ Exam',
        description: '90 questions on data concepts, mining, analysis, visualization, and governance',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 90,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Data Concepts and Environments',
        weight: 15,
        topics: [
          { name: 'Data types and structures' },
          { name: 'Data warehousing and data lakes' },
          { name: 'Database concepts and schemas' },
        ],
        chapters: [
          {
            name: 'Data Fundamentals',
            topics: [
              { name: 'Structured, semi-structured, and unstructured data' },
              { name: 'Relational vs non-relational databases' },
              { name: 'Data warehouse, data lake, and data mart concepts' },
            ],
          },
        ],
      },
      {
        name: 'Data Mining',
        weight: 25,
        topics: [
          { name: 'ETL and data preparation' },
          { name: 'Data quality and cleansing' },
          { name: 'Data manipulation techniques' },
        ],
        chapters: [
          {
            name: 'Data Preparation',
            topics: [
              { name: 'ETL/ELT processes and tools' },
              { name: 'Data cleansing: deduplication, imputation, normalization' },
              { name: 'Data transformation and aggregation techniques' },
            ],
          },
        ],
      },
      {
        name: 'Data Analysis',
        weight: 23,
        topics: [
          { name: 'Statistical analysis methods' },
          { name: 'Descriptive and inferential statistics' },
          { name: 'Analysis techniques and tools' },
        ],
        chapters: [
          {
            name: 'Analysis Methods',
            topics: [
              { name: 'Descriptive statistics (mean, median, mode, standard deviation)' },
              { name: 'Hypothesis testing and p-values' },
              { name: 'Regression, correlation, and trend analysis' },
            ],
          },
        ],
      },
      {
        name: 'Visualization',
        weight: 23,
        topics: [
          { name: 'Chart and graph types' },
          { name: 'Dashboard design principles' },
          { name: 'Data storytelling' },
        ],
        chapters: [
          {
            name: 'Data Visualization',
            topics: [
              { name: 'Choosing the right chart type for the data' },
              { name: 'Dashboard design best practices' },
              { name: 'Color theory and accessibility in visualization' },
            ],
          },
        ],
      },
      {
        name: 'Data Governance, Quality, and Controls',
        weight: 14,
        topics: [
          { name: 'Data governance frameworks' },
          { name: 'Data security and privacy' },
          { name: 'Master data management' },
        ],
        chapters: [
          {
            name: 'Governance',
            topics: [
              { name: 'Data governance roles and responsibilities' },
              { name: 'Data classification and access controls' },
              { name: 'Regulatory compliance (GDPR, CCPA, HIPAA)' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'CompTIA Data+ validates data analytics skills for early-career data professionals. Covers data concepts, mining, analysis, visualization, and governance. Good entry-level certification for data analyst roles.',
      totalDuration: 90,
      passingScore: 720,
      tips: [
        'Data Mining (25%) and Data Analysis (23%) together make up nearly half the exam',
        'Know when to use each chart type (bar, line, scatter, pie, histogram, heatmap)',
        'Understand basic statistics: mean, median, mode, standard deviation, correlation',
        'ETL processes and data cleansing techniques are heavily tested',
        'Data governance and privacy regulations appear throughout the exam',
      ],
    },

    questionStyle: 'Multiple-choice and performance-based questions on data analytics concepts. Scenarios present data sets, business questions, and ask you to select the appropriate analysis technique, visualization, or data preparation approach. Vendor-neutral and practical.',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  HASHICORP (2)
  // ═══════════════════════════════════════════════════════════════════

  // ─── 17. HashiCorp Terraform Associate ──────────────────────────
  {
    id: 'hashicorp-terraform-associate',
    vendor: 'HashiCorp',
    certName: 'Terraform Associate',
    certCode: 'Terraform Associate (004)',
    aliases: [
      /\bterraform\s*associate\b/i,
      /\bhashicorp\b.*\bterraform\b/i,
      /\bterraform\s*cert(ification)?\b/i,
      /\bterraform\s*004\b/i,
      /\bterraform\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 60,
    questionCountTotal: 60,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select, fill-in-the-blank',
    performanceBased: false,

    formats: [
      {
        formatName: 'Terraform Associate Exam',
        description: '~60 questions on IaC concepts, Terraform fundamentals, workflow, and HCP Terraform',
        timeAllocation: 60,
        pointWeight: 100,
        questionCount: 60,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'IaC Concepts',
        weight: 15,
        topics: [
          { name: 'Infrastructure as Code fundamentals' },
          { name: 'IaC benefits and patterns' },
          { name: 'Terraform vs other IaC tools' },
        ],
        chapters: [
          {
            name: 'IaC Fundamentals',
            topics: [
              { name: 'What is Infrastructure as Code and why use it' },
              { name: 'Declarative vs imperative approaches' },
              { name: 'Terraform advantages over CloudFormation, Pulumi, Ansible' },
            ],
          },
        ],
      },
      {
        name: 'Terraform Fundamentals',
        weight: 15,
        topics: [
          { name: 'Terraform architecture and components' },
          { name: 'Providers and resources' },
          { name: 'Terraform CLI and configuration' },
        ],
        chapters: [
          {
            name: 'Core Concepts',
            topics: [
              { name: 'Providers: configuration, versions, and plugin architecture' },
              { name: 'Resources: lifecycle (create, update, destroy)' },
              { name: 'Data sources for reading external information' },
            ],
          },
        ],
      },
      {
        name: 'Terraform Core Workflow',
        weight: 15,
        topics: [
          { name: 'Init, plan, apply workflow' },
          { name: 'Writing Terraform configuration' },
          { name: 'terraform destroy and resource targeting' },
        ],
        chapters: [
          {
            name: 'Workflow',
            topics: [
              { name: 'terraform init (backend, provider installation)' },
              { name: 'terraform plan (execution plan, drift detection)' },
              { name: 'terraform apply and terraform destroy lifecycle' },
            ],
          },
        ],
      },
      {
        name: 'Terraform Configuration',
        weight: 15,
        topics: [
          { name: 'Variables and outputs' },
          { name: 'Expressions and functions' },
          { name: 'Provisioners and dynamic blocks' },
        ],
        chapters: [
          {
            name: 'HCL Configuration',
            topics: [
              { name: 'Input variables: types, defaults, validation, sensitive' },
              { name: 'Output values and local values' },
              { name: 'Built-in functions (string, collection, encoding, filesystem)' },
            ],
          },
        ],
      },
      {
        name: 'Terraform Modules',
        weight: 10,
        topics: [
          { name: 'Module structure and usage' },
          { name: 'Module sources and versioning' },
          { name: 'Terraform Registry' },
        ],
        chapters: [
          {
            name: 'Modules',
            topics: [
              { name: 'Module structure: main.tf, variables.tf, outputs.tf' },
              { name: 'Module sources (local, registry, Git, S3)' },
              { name: 'Module versioning and composition patterns' },
            ],
          },
        ],
      },
      {
        name: 'Terraform State',
        weight: 15,
        topics: [
          { name: 'State file purpose and management' },
          { name: 'Remote backends and state locking' },
          { name: 'State commands (import, mv, rm)' },
        ],
        chapters: [
          {
            name: 'State Management',
            topics: [
              { name: 'State file structure and purpose' },
              { name: 'Remote backends (S3, GCS, Azure Blob, HCP Terraform)' },
              { name: 'terraform state commands (list, show, mv, rm, import)' },
            ],
          },
        ],
      },
      {
        name: 'Maintain and Manage Infrastructure',
        weight: 10,
        topics: [
          { name: 'Resource dependencies and lifecycle' },
          { name: 'Workspaces for environment management' },
          { name: 'Debugging and troubleshooting' },
        ],
        chapters: [
          {
            name: 'Maintenance',
            topics: [
              { name: 'Resource dependencies (implicit and explicit)' },
              { name: 'Lifecycle meta-arguments (create_before_destroy, prevent_destroy)' },
              { name: 'Workspaces for managing multiple environments' },
            ],
          },
        ],
      },
      {
        name: 'HCP Terraform',
        weight: 5,
        topics: [
          { name: 'HCP Terraform features and benefits' },
          { name: 'Remote execution and state management' },
          { name: 'Team collaboration features' },
        ],
        chapters: [
          {
            name: 'HCP Terraform',
            topics: [
              { name: 'HCP Terraform workspaces and VCS integration' },
              { name: 'Remote runs and state management' },
              { name: 'Sentinel policy as code' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The HashiCorp Terraform Associate (004) validates foundational knowledge of Terraform and Infrastructure as Code. Covers core workflow, state management, modules, and HCP Terraform. Suitable for engineers who use Terraform regularly and want to validate their skills.',
      totalDuration: 60,
      passingScore: 70,
      tips: [
        'The exam is only 60 minutes for ~60 questions — about 1 minute per question, so be efficient',
        'State management is critical — know backends, locking, and state commands',
        'Understand the init > plan > apply workflow and what each step does',
        'Module structure and usage patterns are frequently tested',
        'Know variable types, validation, and precedence rules',
        'HCP Terraform is only 5% but easy points if you know the basics',
      ],
    },

    questionStyle: 'Multiple-choice and multiple-select questions testing Terraform concepts and configuration knowledge. Some fill-in-the-blank questions test specific HCL syntax. Questions present infrastructure scenarios and ask for the correct Terraform approach, command, or configuration.',
  },

  // ─── 18. HashiCorp Vault Associate ──────────────────────────────
  {
    id: 'hashicorp-vault-associate',
    vendor: 'HashiCorp',
    certName: 'Vault Associate',
    certCode: 'Vault Associate (003)',
    aliases: [
      /\bvault\s*associate\b/i,
      /\bhashicorp\b.*\bvault\b/i,
      /\bvault\s*cert(ification)?\b/i,
      /\bvault\s*003\b/i,
    ],

    passingThresholdPercent: 70,
    totalDurationMinutes: 60,
    questionCountTotal: 57,
    scoringScale: { passing: 70, max: 100 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'Vault Associate Exam',
        description: '~57 questions on Vault architecture, secrets management, auth methods, and policies',
        timeAllocation: 60,
        pointWeight: 100,
        questionCount: 57,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Authentication Methods',
        weight: 15,
        topics: [
          { name: 'Auth method types and configuration' },
          { name: 'Token, LDAP, and cloud-based auth' },
          { name: 'Identity and entity management' },
        ],
        chapters: [
          {
            name: 'Auth Methods',
            topics: [
              { name: 'Token auth and token types (service, batch)' },
              { name: 'Cloud auth methods (AWS, Azure, GCP, Kubernetes)' },
              { name: 'LDAP, OIDC, and AppRole authentication' },
            ],
          },
        ],
      },
      {
        name: 'Vault Policies',
        weight: 15,
        topics: [
          { name: 'HCL policy syntax and structure' },
          { name: 'Policy capabilities and paths' },
          { name: 'Policy assignment and evaluation' },
        ],
        chapters: [
          {
            name: 'Policies',
            topics: [
              { name: 'Policy syntax: path, capabilities (create, read, update, delete, list, sudo, deny)' },
              { name: 'Policy evaluation order and precedence' },
              { name: 'Default and root policies' },
            ],
          },
        ],
      },
      {
        name: 'Tokens',
        weight: 12,
        topics: [
          { name: 'Token types and properties' },
          { name: 'Token lifecycle and renewal' },
          { name: 'Token accessors and response wrapping' },
        ],
        chapters: [
          {
            name: 'Token Management',
            topics: [
              { name: 'Service tokens vs batch tokens' },
              { name: 'Token TTL, max TTL, and periodic tokens' },
              { name: 'Token accessors for audit and management' },
            ],
          },
        ],
      },
      {
        name: 'Leases',
        weight: 10,
        topics: [
          { name: 'Lease fundamentals' },
          { name: 'Lease renewal and revocation' },
          { name: 'Max TTL and lease management' },
        ],
        chapters: [
          {
            name: 'Lease Management',
            topics: [
              { name: 'Lease IDs and lease lookup' },
              { name: 'Renewing and revoking leases' },
              { name: 'Force revocation and prefix revocation' },
            ],
          },
        ],
      },
      {
        name: 'Secrets Engines',
        weight: 15,
        topics: [
          { name: 'KV secrets engine (v1 and v2)' },
          { name: 'Dynamic secrets engines (database, AWS, PKI)' },
          { name: 'Secrets engine lifecycle' },
        ],
        chapters: [
          {
            name: 'Secrets Engines',
            topics: [
              { name: 'KV v2: versioning, check-and-set, metadata' },
              { name: 'Dynamic secrets: database, AWS, and PKI engines' },
              { name: 'Enabling, configuring, and tuning secrets engines' },
            ],
          },
        ],
      },
      {
        name: 'Encryption as a Service',
        weight: 10,
        topics: [
          { name: 'Transit secrets engine' },
          { name: 'Encryption, decryption, and key rotation' },
          { name: 'Convergent encryption and data masking' },
        ],
        chapters: [
          {
            name: 'Transit Engine',
            topics: [
              { name: 'Transit encrypt/decrypt operations' },
              { name: 'Key rotation and rewrapping' },
              { name: 'Convergent encryption for deterministic ciphertext' },
            ],
          },
        ],
      },
      {
        name: 'Vault Architecture',
        weight: 10,
        topics: [
          { name: 'Vault architecture and seal/unseal' },
          { name: 'Storage backends' },
          { name: 'High availability and replication' },
        ],
        chapters: [
          {
            name: 'Architecture',
            topics: [
              { name: 'Seal/unseal process and auto-unseal' },
              { name: 'Storage backends (Consul, Integrated Raft, file)' },
              { name: 'HA architecture and performance replication' },
            ],
          },
        ],
      },
      {
        name: 'Vault Deployment and Operations',
        weight: 8,
        topics: [
          { name: 'Vault installation and configuration' },
          { name: 'Vault Agent and templating' },
          { name: 'Audit devices and logging' },
        ],
        chapters: [
          {
            name: 'Operations',
            topics: [
              { name: 'Vault server configuration (listener, storage, seal)' },
              { name: 'Vault Agent for auto-auth and templating' },
              { name: 'Audit devices (file, syslog, socket)' },
            ],
          },
        ],
      },
      {
        name: 'Access Management',
        weight: 5,
        topics: [
          { name: 'Identity and entity aliases' },
          { name: 'Groups and group aliases' },
          { name: 'Namespaces for multi-tenancy' },
        ],
        chapters: [
          {
            name: 'Access Management',
            topics: [
              { name: 'Entities, aliases, and identity groups' },
              { name: 'Internal vs external groups' },
              { name: 'Namespaces for multi-tenant isolation' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The HashiCorp Vault Associate (003) validates knowledge of secrets management, authentication, and encryption with HashiCorp Vault. Covers auth methods, policies, secrets engines, and architecture. Pass/fail scoring with estimated 70% threshold.',
      totalDuration: 60,
      passingScore: 70,
      tips: [
        'Auth methods and secrets engines together make up 30% — know each type and when to use it',
        'Understand the seal/unseal process and Shamir secret sharing',
        'Policy syntax is heavily tested — practice writing HCL policies',
        'Know the difference between service tokens and batch tokens',
        'Transit secrets engine (encryption as a service) is a popular topic',
        'The 60-minute time limit is tight — move quickly through questions',
      ],
    },

    questionStyle: 'Multiple-choice and multiple-select questions on Vault concepts and configuration. Questions present secrets management scenarios and ask for the correct Vault command, configuration, or architectural approach. Tests conceptual understanding rather than hands-on CLI skills.',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  CISCO (2)
  // ═══════════════════════════════════════════════════════════════════

  // ─── 19. Cisco CCNA ─────────────────────────────────────────────
  {
    id: 'cisco-ccna',
    vendor: 'Cisco',
    certName: 'CCNA',
    certCode: '200-301 v1.1',
    aliases: [
      /\bccna\b/i,
      /\bcisco\s*ccna\b/i,
      /\b200-301\b/i,
      /\bcisco\s*certified\s*network\s*associate\b/i,
    ],

    passingThresholdPercent: 82,
    totalDurationMinutes: 120,
    questionCountTotal: 110,
    scoringScale: { passing: 825, max: 1000 },
    questionTypes: 'Multiple choice, drag-and-drop, simulation',
    performanceBased: false,

    formats: [
      {
        formatName: 'CCNA Exam',
        description: '100-120 questions on networking fundamentals, IP connectivity, security, and automation',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 110,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: false,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Network Fundamentals',
        weight: 20,
        topics: [
          { name: 'Network components and topologies' },
          { name: 'TCP/IP and OSI models' },
          { name: 'IPv4 and IPv6 addressing' },
        ],
        chapters: [
          {
            name: 'Networking Basics',
            topics: [
              { name: 'OSI and TCP/IP model layers and encapsulation' },
              { name: 'IPv4 subnetting and VLSM' },
              { name: 'IPv6 addressing, EUI-64, and SLAAC' },
            ],
          },
          {
            name: 'Network Architecture',
            topics: [
              { name: 'Two-tier and three-tier campus architectures' },
              { name: 'WAN topologies and SD-WAN concepts' },
              { name: 'Small office/home office (SOHO) network design' },
            ],
          },
        ],
      },
      {
        name: 'Network Access',
        weight: 20,
        topics: [
          { name: 'VLANs and trunking' },
          { name: 'Spanning tree and EtherChannel' },
          { name: 'Wireless LAN fundamentals' },
        ],
        chapters: [
          {
            name: 'Switching',
            topics: [
              { name: 'VLAN configuration, native VLANs, and voice VLANs' },
              { name: '802.1Q trunking and DTP' },
              { name: 'Rapid STP (802.1w) and EtherChannel (LACP, PAgP)' },
            ],
          },
          {
            name: 'Wireless',
            topics: [
              { name: 'WLAN components: WLC, lightweight APs, autonomous APs' },
              { name: 'Wireless security (WPA2, WPA3, 802.1X)' },
              { name: 'AP modes and wireless troubleshooting' },
            ],
          },
        ],
      },
      {
        name: 'IP Connectivity',
        weight: 25,
        topics: [
          { name: 'Static and dynamic routing' },
          { name: 'OSPF fundamentals' },
          { name: 'First hop redundancy' },
        ],
        chapters: [
          {
            name: 'Routing',
            topics: [
              { name: 'Static routing and default routes' },
              { name: 'OSPFv2 single-area configuration and verification' },
              { name: 'Administrative distance and route selection' },
            ],
          },
          {
            name: 'IP Services',
            topics: [
              { name: 'FHRP: HSRP concepts and configuration' },
              { name: 'NAT/PAT types and configuration' },
              { name: 'DHCP server and relay configuration' },
            ],
          },
        ],
      },
      {
        name: 'IP Services',
        weight: 10,
        topics: [
          { name: 'NAT and DHCP' },
          { name: 'NTP and QoS basics' },
          { name: 'SNMP and syslog' },
        ],
        chapters: [
          {
            name: 'Services',
            topics: [
              { name: 'NTP configuration and verification' },
              { name: 'QoS concepts (marking, queuing, trust boundaries)' },
              { name: 'SNMP versions and syslog severity levels' },
            ],
          },
        ],
      },
      {
        name: 'Security Fundamentals',
        weight: 15,
        topics: [
          { name: 'Network security concepts' },
          { name: 'Access control lists' },
          { name: 'Device hardening' },
        ],
        chapters: [
          {
            name: 'Security',
            topics: [
              { name: 'Standard and extended ACL configuration' },
              { name: 'Port security, DHCP snooping, dynamic ARP inspection' },
              { name: 'AAA concepts and 802.1X authentication' },
            ],
          },
        ],
      },
      {
        name: 'Automation and Programmability',
        weight: 10,
        topics: [
          { name: 'Network automation concepts' },
          { name: 'REST APIs and JSON' },
          { name: 'Configuration management tools' },
        ],
        chapters: [
          {
            name: 'Automation',
            topics: [
              { name: 'REST API concepts (CRUD, HTTP verbs, JSON)' },
              { name: 'Cisco DNA Center and SD-WAN basics' },
              { name: 'Puppet, Chef, and Ansible for network automation' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The CCNA (200-301 v1.1) is the most popular networking certification worldwide. Covers networking fundamentals, switching, routing (OSPF), security, and automation. Important: you cannot go back to previous questions once answered. Cisco uses a scaled score out of 1000.',
      totalDuration: 120,
      passingScore: 825,
      tips: [
        'CRITICAL: You CANNOT go back to previous questions — answer carefully the first time',
        'IP Connectivity (25%) is the largest domain — master OSPF and routing concepts',
        'Subnetting speed is essential — practice until you can subnet in your head',
        'Know VLAN, trunking, and STP configuration commands and verification',
        'ACL configuration (standard and extended) appears on every exam',
        'Automation is only 10% but it is easy points if you study REST APIs and JSON basics',
      ],
    },

    questionStyle: 'Mix of multiple-choice, drag-and-drop, and simulation questions. Simulations present a Cisco IOS CLI where you must configure or troubleshoot network devices. Questions are scenario-based with network diagrams. You CANNOT go back to previous questions.',
  },

  // ─── 20. Cisco CCNP ENCOR ──────────────────────────────────────
  {
    id: 'cisco-ccnp-encor',
    vendor: 'Cisco',
    certName: 'CCNP Enterprise Core',
    certCode: '350-401 v1.2 ENCOR',
    aliases: [
      /\bccnp\s*encor\b/i,
      /\b350-401\b/i,
      /\bencor\b/i,
      /\bccnp\s*enterprise\s*core\b/i,
      /\bccnp\s*enterprise\b/i,
    ],

    passingThresholdPercent: 82,
    totalDurationMinutes: 120,
    questionCountTotal: 100,
    scoringScale: { passing: 825, max: 1000 },
    questionTypes: 'Multiple choice, drag-and-drop, simulation',
    performanceBased: false,

    formats: [
      {
        formatName: 'CCNP ENCOR Exam',
        description: '90-110 questions on enterprise architecture, virtualization, infrastructure, security, and automation',
        timeAllocation: 120,
        pointWeight: 100,
        questionCount: 100,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: false,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Architecture',
        weight: 15,
        topics: [
          { name: 'Enterprise network design' },
          { name: 'SD-WAN and SD-Access' },
          { name: 'QoS architecture' },
        ],
        chapters: [
          {
            name: 'Enterprise Architecture',
            topics: [
              { name: 'Cisco SD-WAN architecture and components' },
              { name: 'Cisco SD-Access fabric architecture' },
              { name: 'QoS models (DiffServ, IntServ, best effort)' },
            ],
          },
        ],
      },
      {
        name: 'Virtualization',
        weight: 10,
        topics: [
          { name: 'Network virtualization' },
          { name: 'Path virtualization (VRF, GRE, IPsec)' },
          { name: 'Device virtualization' },
        ],
        chapters: [
          {
            name: 'Virtualization',
            topics: [
              { name: 'VRF and VRF-Lite configuration' },
              { name: 'GRE and IPsec tunnels' },
              { name: 'LISP and VXLAN fundamentals' },
            ],
          },
        ],
      },
      {
        name: 'Infrastructure',
        weight: 25,
        topics: [
          { name: 'Layer 2 and Layer 3 protocols' },
          { name: 'Routing protocols (OSPF, EIGRP, BGP)' },
          { name: 'Wireless infrastructure' },
        ],
        chapters: [
          {
            name: 'Routing',
            topics: [
              { name: 'OSPF multi-area, LSA types, and route filtering' },
              { name: 'EIGRP named mode and optimization' },
              { name: 'BGP path selection, attributes, and peering' },
            ],
          },
          {
            name: 'Wireless and Switching',
            topics: [
              { name: 'Wireless deployment models (centralized, FlexConnect, Mobility Express)' },
              { name: 'Layer 2 protocols (STP, RSTP, MST, EtherChannel)' },
              { name: 'Multicast routing (PIM-SM, RP, IGMP)' },
            ],
          },
        ],
      },
      {
        name: 'Network Assurance',
        weight: 10,
        topics: [
          { name: 'Diagnostics and monitoring' },
          { name: 'Cisco DNA Center assurance' },
          { name: 'NetFlow, SPAN, and IP SLA' },
        ],
        chapters: [
          {
            name: 'Network Assurance',
            topics: [
              { name: 'SNMP, syslog, and NetFlow for monitoring' },
              { name: 'SPAN, RSPAN, and ERSPAN for traffic analysis' },
              { name: 'IP SLA for network performance measurement' },
            ],
          },
        ],
      },
      {
        name: 'Security',
        weight: 20,
        topics: [
          { name: 'Network security design' },
          { name: 'Infrastructure security features' },
          { name: 'Authentication and access control' },
        ],
        chapters: [
          {
            name: 'Security',
            topics: [
              { name: 'CoPP (Control Plane Policing) and infrastructure ACLs' },
              { name: 'AAA with RADIUS and TACACS+ integration' },
              { name: 'Wireless security (802.1X, EAP methods, WPA3)' },
            ],
          },
          {
            name: 'Threat Defense',
            topics: [
              { name: 'TrustSec and MACsec encryption' },
              { name: 'Endpoint security and posture assessment' },
              { name: 'Network segmentation strategies' },
            ],
          },
        ],
      },
      {
        name: 'Automation',
        weight: 20,
        topics: [
          { name: 'Network programmability concepts' },
          { name: 'APIs and automation tools' },
          { name: 'Python scripting for network automation' },
        ],
        chapters: [
          {
            name: 'Programmability',
            topics: [
              { name: 'REST APIs, NETCONF, RESTCONF, and gRPC' },
              { name: 'Python scripting for network automation' },
              { name: 'Cisco DNA Center APIs and intent-based networking' },
            ],
          },
          {
            name: 'Automation Tools',
            topics: [
              { name: 'Ansible for network device configuration' },
              { name: 'YANG data models and model-driven programmability' },
              { name: 'CI/CD concepts for network automation' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The CCNP ENCOR (350-401) is the core exam for Cisco CCNP Enterprise. Covers advanced routing (OSPF, EIGRP, BGP), SD-WAN/SD-Access, wireless, security, and automation. Like CCNA, you cannot go back to previous questions. Prerequisite for CCNP Enterprise concentration exams.',
      totalDuration: 120,
      passingScore: 825,
      tips: [
        'CRITICAL: You CANNOT go back to previous questions — answer carefully the first time',
        'Infrastructure (25%) is the largest domain — master OSPF, EIGRP, and BGP',
        'Security (20%) and Automation (20%) are equally weighted and critical',
        'Know SD-WAN and SD-Access architectures at a conceptual level',
        'Wireless deployment models and security are significant portions',
        'Python scripting and REST API concepts are required for the Automation domain',
      ],
    },

    questionStyle: 'Mix of multiple-choice, drag-and-drop, and simulation questions at an advanced level. Simulations require Cisco IOS/IOS-XE CLI configuration. Questions involve complex network diagrams with multiple protocols. You CANNOT go back to previous questions.',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  OTHERS (9 remaining: Snowflake, PMP, ITIL, PSM I, Docker DCA)
  // ═══════════════════════════════════════════════════════════════════

  // ─── 21. Snowflake SnowPro Core ─────────────────────────────────
  {
    id: 'snowflake-snowpro-core',
    vendor: 'Snowflake',
    certName: 'SnowPro Core',
    certCode: 'COF-C03',
    aliases: [
      /\bsnowpro\b/i,
      /\bsnowflake\b/i,
      /\bcof-c03\b/i,
    ],

    passingThresholdPercent: 75,
    totalDurationMinutes: 115,
    questionCountTotal: 100,
    scoringScale: { passing: 750, max: 1000 },
    questionTypes: 'Multiple choice, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'SnowPro Core Exam',
        description: '100 questions (MC + MS) on Snowflake architecture, security, performance, data loading, and sharing',
        timeAllocation: 115,
        pointWeight: 100,
        questionCount: 100,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'AI Data Cloud Architecture and Features',
        weight: 25,
        topics: [
          { name: 'Snowflake architecture (storage, compute, services)' },
          { name: 'Virtual warehouses and scaling' },
          { name: 'Micro-partitions and data clustering' },
        ],
        chapters: [
          {
            name: 'Architecture',
            topics: [
              { name: 'Three-layer architecture (storage, compute, cloud services)' },
              { name: 'Virtual warehouse sizing, scaling, and multi-cluster' },
              { name: 'Micro-partitions, pruning, and clustering keys' },
            ],
          },
          {
            name: 'Features',
            topics: [
              { name: 'Time Travel and Fail-safe' },
              { name: 'Zero-copy cloning' },
              { name: 'Snowflake editions and feature availability' },
            ],
          },
        ],
      },
      {
        name: 'Account Access and Security',
        weight: 20,
        topics: [
          { name: 'User and role management' },
          { name: 'Access control and privileges' },
          { name: 'Security features and encryption' },
        ],
        chapters: [
          {
            name: 'Security',
            topics: [
              { name: 'RBAC: roles, privileges, and inheritance' },
              { name: 'Network policies and IP whitelisting' },
              { name: 'Data masking and row access policies' },
            ],
          },
        ],
      },
      {
        name: 'Performance Concepts',
        weight: 15,
        topics: [
          { name: 'Query performance optimization' },
          { name: 'Caching layers (metadata, result, warehouse)' },
          { name: 'Resource monitoring' },
        ],
        chapters: [
          {
            name: 'Performance',
            topics: [
              { name: 'Query profiling and EXPLAIN plans' },
              { name: 'Three caching layers and their impact' },
              { name: 'Resource monitors and cost controls' },
            ],
          },
        ],
      },
      {
        name: 'Data Loading and Transformation',
        weight: 20,
        topics: [
          { name: 'Bulk and continuous data loading' },
          { name: 'Stages and file formats' },
          { name: 'Data transformation with SQL' },
        ],
        chapters: [
          {
            name: 'Data Loading',
            topics: [
              { name: 'COPY INTO command and bulk loading' },
              { name: 'Snowpipe for continuous ingestion' },
              { name: 'Internal and external stages' },
            ],
          },
          {
            name: 'Transformation',
            topics: [
              { name: 'Streams and tasks for change data capture' },
              { name: 'Semi-structured data (VARIANT, FLATTEN, LATERAL)' },
              { name: 'Stored procedures and UDFs' },
            ],
          },
        ],
      },
      {
        name: 'Data Protection and Data Sharing',
        weight: 10,
        topics: [
          { name: 'Data protection features' },
          { name: 'Data sharing and marketplace' },
          { name: 'Replication and failover' },
        ],
        chapters: [
          {
            name: 'Protection and Sharing',
            topics: [
              { name: 'Time Travel retention and Fail-safe periods' },
              { name: 'Secure data sharing and Snowflake Marketplace' },
              { name: 'Database and account replication' },
            ],
          },
        ],
      },
      {
        name: 'Data Pipelines',
        weight: 10,
        topics: [
          { name: 'Snowpipe and auto-ingest' },
          { name: 'Tasks and streams for ELT' },
          { name: 'Scheduling and monitoring pipelines' },
        ],
        chapters: [
          {
            name: 'Pipelines',
            topics: [
              { name: 'Snowpipe auto-ingest with cloud event notifications' },
              { name: 'Task scheduling, DAGs, and error handling' },
              { name: 'Stream types (standard, append-only, insert-only)' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The SnowPro Core (COF-C03) validates foundational knowledge of the Snowflake AI Data Cloud. Covers architecture, security, performance, data loading, and sharing. Essential certification for anyone working with Snowflake in data engineering or analytics roles.',
      totalDuration: 115,
      passingScore: 750,
      tips: [
        'Architecture is 25% — deeply understand the three-layer architecture and virtual warehouses',
        'Know all three caching layers (metadata, result, warehouse) and when each is used',
        'Time Travel, Fail-safe, and zero-copy cloning are tested heavily',
        'Understand COPY INTO options and Snowpipe configuration',
        'Streams and tasks for ELT pipelines are increasingly important',
        'Data sharing is unique to Snowflake — know how reader accounts and shares work',
      ],
    },

    questionStyle: 'Multiple-choice and multiple-select questions on Snowflake concepts and architecture. Questions present data platform scenarios and ask for the correct Snowflake feature, configuration, or SQL approach. Tests understanding of Snowflake-specific concepts like micro-partitions, Time Travel, and virtual warehouses.',
  },

  // ─── 22. PMI PMP ────────────────────────────────────────────────
  {
    id: 'pmi-pmp',
    vendor: 'PMI',
    certName: 'Project Management Professional',
    certCode: 'PMP',
    aliases: [
      /\bpmp\b/i,
      /\bproject\s*management\s*professional\b/i,
      /\bpmi\s*pmp\b/i,
    ],

    passingThresholdPercent: 60,
    totalDurationMinutes: 230,
    questionCountTotal: 180,
    scoringScale: { passing: 60, max: 100 },
    questionTypes: 'Multiple choice, multiple select, matching, hotspot, fill-in-the-blank',
    performanceBased: false,

    formats: [
      {
        formatName: 'PMP Exam',
        description: '180 questions across People, Process, and Business Environment domains (includes 2 ten-minute breaks)',
        timeAllocation: 230,
        pointWeight: 100,
        questionCount: 180,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
        instructions: 'The exam is divided into 3 sections of 60 questions each with optional 10-minute breaks between sections.',
      },
    ],

    subjects: [
      {
        name: 'People',
        weight: 42,
        topics: [
          { name: 'Team management and leadership' },
          { name: 'Stakeholder engagement' },
          { name: 'Conflict resolution and negotiation' },
        ],
        chapters: [
          {
            name: 'Team Leadership',
            topics: [
              { name: 'Servant leadership and emotional intelligence' },
              { name: 'Team development stages (Tuckman model)' },
              { name: 'Conflict resolution strategies (collaborate, compromise, accommodate)' },
            ],
          },
          {
            name: 'Stakeholder Management',
            topics: [
              { name: 'Stakeholder identification and analysis' },
              { name: 'Communication management and engagement strategies' },
              { name: 'Negotiation techniques and expectation management' },
            ],
          },
          {
            name: 'Team Performance',
            topics: [
              { name: 'Virtual team management and collaboration tools' },
              { name: 'Mentoring, coaching, and training' },
              { name: 'Performance appraisals and recognition' },
            ],
          },
        ],
      },
      {
        name: 'Process',
        weight: 50,
        topics: [
          { name: 'Project planning and execution' },
          { name: 'Agile, hybrid, and predictive methodologies' },
          { name: 'Risk and change management' },
        ],
        chapters: [
          {
            name: 'Planning',
            topics: [
              { name: 'Scope definition, WBS, and requirements management' },
              { name: 'Schedule management (critical path, critical chain)' },
              { name: 'Cost management and earned value management (EVM)' },
            ],
          },
          {
            name: 'Execution and Monitoring',
            topics: [
              { name: 'Agile ceremonies (sprint planning, daily standup, retrospective)' },
              { name: 'Risk identification, analysis, and response strategies' },
              { name: 'Change control process and integrated change control' },
            ],
          },
          {
            name: 'Delivery',
            topics: [
              { name: 'Quality management and continuous improvement' },
              { name: 'Procurement management and contracts' },
              { name: 'Project closure and lessons learned' },
            ],
          },
        ],
      },
      {
        name: 'Business Environment',
        weight: 8,
        topics: [
          { name: 'Benefits realization and value delivery' },
          { name: 'Organizational change management' },
          { name: 'Compliance and external factors' },
        ],
        chapters: [
          {
            name: 'Business Context',
            topics: [
              { name: 'Business case and benefits management plan' },
              { name: 'Organizational project management maturity' },
              { name: 'External business environment factors and compliance' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The PMP is the most recognized project management certification globally. The current exam is ~50% predictive (waterfall) and ~50% agile/hybrid. 180 questions in 230 minutes with two optional breaks. Domains are changing July 2026 — check PMI website for updates.',
      totalDuration: 230,
      passingScore: 60,
      tips: [
        'The exam is roughly 50% agile and 50% predictive — study both equally',
        'People domain is 42% — focus on leadership, team dynamics, and stakeholder management',
        'Know Earned Value Management formulas (EV, PV, AC, SPI, CPI, EAC, VAC)',
        'The exam uses "best answer" format — there may be multiple correct-seeming options',
        'Take the optional breaks to stay fresh — the exam is mentally exhausting at 230 minutes',
        'PMI Agile Practice Guide is now essential reading alongside the PMBOK',
      ],
    },

    questionStyle: 'Scenario-based questions presenting project management situations. Questions describe a project context and ask what the project manager should do NEXT or what is the BEST approach. Tests judgment and decision-making rather than memorization. Mix of predictive and agile scenarios.',
  },

  // ─── 23. ITIL 4 Foundation ──────────────────────────────────────
  {
    id: 'itil-4-foundation',
    vendor: 'PeopleCert/Axelos',
    certName: 'ITIL 4 Foundation',
    certCode: 'ITIL 4 Foundation',
    aliases: [
      /\bitil\s*4?\s*foundation\b/i,
      /\bitil\b/i,
      /\bitil\s*4\b/i,
    ],

    passingThresholdPercent: 65,
    totalDurationMinutes: 60,
    questionCountTotal: 40,
    scoringScale: { passing: 26, max: 40 },
    questionTypes: 'Multiple choice',
    performanceBased: false,

    formats: [
      {
        formatName: 'ITIL 4 Foundation Exam',
        description: '40 MCQ questions on ITIL service management framework fundamentals',
        timeAllocation: 60,
        pointWeight: 100,
        questionCount: 40,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Service Management Key Concepts',
        weight: 25,
        topics: [
          { name: 'Service and service management definitions' },
          { name: 'Value, outcomes, costs, and risks' },
          { name: 'Service relationships and offerings' },
        ],
        chapters: [
          {
            name: 'Key Concepts',
            topics: [
              { name: 'Value co-creation between provider and consumer' },
              { name: 'Utility and warranty of services' },
              { name: 'Service consumers: users, customers, and sponsors' },
            ],
          },
        ],
      },
      {
        name: 'ITIL Service Value System',
        weight: 20,
        topics: [
          { name: 'SVS components and purpose' },
          { name: 'Governance and continual improvement' },
          { name: 'Opportunity, demand, and value' },
        ],
        chapters: [
          {
            name: 'Service Value System',
            topics: [
              { name: 'SVS inputs (opportunity/demand) and outputs (value)' },
              { name: 'Governance role within the SVS' },
              { name: 'Continual improvement model' },
            ],
          },
        ],
      },
      {
        name: 'Four Dimensions of Service Management',
        weight: 10,
        topics: [
          { name: 'Organizations and people' },
          { name: 'Information and technology' },
          { name: 'Partners, suppliers, value streams, and processes' },
        ],
        chapters: [
          {
            name: 'Four Dimensions',
            topics: [
              { name: 'Organizations and people dimension' },
              { name: 'Information and technology dimension' },
              { name: 'Partners and suppliers / Value streams and processes dimensions' },
            ],
          },
        ],
      },
      {
        name: 'ITIL Guiding Principles',
        weight: 15,
        topics: [
          { name: 'Focus on value' },
          { name: 'Start where you are and progress iteratively' },
          { name: 'Collaborate, keep it simple, optimize and automate' },
        ],
        chapters: [
          {
            name: 'Guiding Principles',
            topics: [
              { name: 'Seven guiding principles and their application' },
              { name: 'Think and work holistically' },
              { name: 'Optimize and automate' },
            ],
          },
        ],
      },
      {
        name: 'Service Value Chain',
        weight: 15,
        topics: [
          { name: 'Six value chain activities' },
          { name: 'Value streams and their design' },
          { name: 'Interconnection of activities' },
        ],
        chapters: [
          {
            name: 'Value Chain',
            topics: [
              { name: 'Plan, improve, engage, design & transition, obtain/build, deliver & support' },
              { name: 'How value chain activities interconnect' },
              { name: 'Designing value streams for specific scenarios' },
            ],
          },
        ],
      },
      {
        name: 'ITIL Management Practices',
        weight: 15,
        topics: [
          { name: 'General management practices' },
          { name: 'Service management practices' },
          { name: 'Technical management practices' },
        ],
        chapters: [
          {
            name: 'Key Practices',
            topics: [
              { name: 'Incident management and service desk' },
              { name: 'Change enablement and problem management' },
              { name: 'Service level management and continual improvement' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'ITIL 4 Foundation is the entry-level certification for IT service management. Covers the ITIL service value system, guiding principles, four dimensions, and key management practices. Widely recognized in enterprise IT and required for many IT management roles.',
      totalDuration: 60,
      passingScore: 26,
      tips: [
        'You need 26 out of 40 (65%) to pass — this is achievable with focused study',
        'Memorize the 7 guiding principles and the 6 value chain activities',
        'Know the four dimensions of service management',
        'The 15 most important practices and their purpose statements are heavily tested',
        'Understand the difference between incidents, problems, and known errors',
        'The official ITIL 4 Foundation book is the definitive study resource',
      ],
    },

    questionStyle: 'Straightforward multiple-choice questions testing ITIL concepts and terminology. Questions ask about definitions, purposes, and applications of ITIL principles and practices. Less scenario-based than other certifications — more direct knowledge recall.',
  },

  // ─── 24. Scrum.org PSM I ────────────────────────────────────────
  {
    id: 'scrum-psm-i',
    vendor: 'Scrum.org',
    certName: 'Professional Scrum Master I',
    certCode: 'PSM I',
    aliases: [
      /\bpsm\s*[i1]\b/i,
      /\bprofessional\s*scrum\s*master\b.*\b[i1]\b/i,
      /\bscrum\s*master\s*[i1]\b/i,
      /\bpsm\b/i,
    ],

    passingThresholdPercent: 85,
    totalDurationMinutes: 60,
    questionCountTotal: 80,
    scoringScale: { passing: 68, max: 80 },
    questionTypes: 'Multiple choice, true/false, multiple select',
    performanceBased: false,

    formats: [
      {
        formatName: 'PSM I Exam',
        description: '80 questions on Scrum theory, roles, events, and artifacts per the Scrum Guide',
        timeAllocation: 60,
        pointWeight: 100,
        questionCount: 80,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: true,
        negativeMarking: false,
        shuffleQuestions: true,
      },
    ],

    subjects: [
      {
        name: 'Scrum Theory and Values',
        weight: 25,
        topics: [
          { name: 'Empiricism pillars (transparency, inspection, adaptation)' },
          { name: 'Scrum values (commitment, courage, focus, openness, respect)' },
          { name: 'Lean thinking and complexity theory' },
        ],
        chapters: [
          {
            name: 'Scrum Foundations',
            topics: [
              { name: 'Three pillars of empiricism and their application' },
              { name: 'Five Scrum values and their importance' },
              { name: 'Agile Manifesto principles and their relationship to Scrum' },
            ],
          },
        ],
      },
      {
        name: 'The Scrum Team',
        weight: 20,
        topics: [
          { name: 'Scrum Master accountabilities' },
          { name: 'Product Owner accountabilities' },
          { name: 'Developers accountabilities' },
        ],
        chapters: [
          {
            name: 'Roles and Accountabilities',
            topics: [
              { name: 'Scrum Master as servant-leader and coach' },
              { name: 'Product Owner and Product Backlog management' },
              { name: 'Developers: self-managing, cross-functional team' },
            ],
          },
        ],
      },
      {
        name: 'Scrum Events',
        weight: 25,
        topics: [
          { name: 'Sprint and Sprint Planning' },
          { name: 'Daily Scrum' },
          { name: 'Sprint Review and Sprint Retrospective' },
        ],
        chapters: [
          {
            name: 'Events',
            topics: [
              { name: 'Sprint: time-box, Sprint Goal, and cancellation rules' },
              { name: 'Sprint Planning: What, How, and Why (Sprint Goal)' },
              { name: 'Daily Scrum: purpose, time-box, and participants' },
            ],
          },
          {
            name: 'Review and Retrospective',
            topics: [
              { name: 'Sprint Review: inspect Increment and adapt Product Backlog' },
              { name: 'Sprint Retrospective: inspect and improve process' },
              { name: 'Time-boxes for all events' },
            ],
          },
        ],
      },
      {
        name: 'Scrum Artifacts',
        weight: 20,
        topics: [
          { name: 'Product Backlog and Product Goal' },
          { name: 'Sprint Backlog and Sprint Goal' },
          { name: 'Increment and Definition of Done' },
        ],
        chapters: [
          {
            name: 'Artifacts and Commitments',
            topics: [
              { name: 'Product Backlog: ordering, refinement, and Product Goal' },
              { name: 'Sprint Backlog: selected items, Sprint Goal, and plan' },
              { name: 'Increment: Definition of Done and releasability' },
            ],
          },
        ],
      },
      {
        name: 'Self-Managing Teams',
        weight: 10,
        topics: [
          { name: 'Self-management principles' },
          { name: 'Cross-functional team dynamics' },
          { name: 'Scaling Scrum and working with multiple teams' },
        ],
        chapters: [
          {
            name: 'Team Dynamics',
            topics: [
              { name: 'Self-management vs self-organization' },
              { name: 'Cross-functionality and T-shaped skills' },
              { name: 'Scrum team size and composition guidelines' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The PSM I exam is based entirely on the Scrum Guide (2020 edition). It tests precise understanding of Scrum theory, roles, events, and artifacts. The 85% passing threshold is high, requiring deep knowledge rather than surface-level understanding. Online exam with no proctor.',
      totalDuration: 60,
      passingScore: 68,
      tips: [
        '85% passing score means you can only miss 12 questions out of 80 — accuracy is critical',
        'Read the Scrum Guide 2020 multiple times — every word matters',
        'The exam is 80 questions in 60 minutes — less than 1 minute per question, so be fast',
        'True/False questions can be tricky — watch for absolute words like "always" or "never"',
        'Focus on the Scrum Master as a servant-leader, not a project manager',
        'Take the free Scrum Open assessment on Scrum.org to gauge readiness',
      ],
    },

    questionStyle: 'Mix of multiple-choice, true/false, and multiple-select questions directly from the Scrum Guide. Questions test precise understanding of Scrum terminology, roles, events, and artifacts. Many questions use subtle wording to test deep comprehension vs surface-level memorization.',
  },

  // ─── 25. Docker Certified Associate (DCA) ──────────────────────
  {
    id: 'docker-dca',
    vendor: 'Mirantis',
    certName: 'Docker Certified Associate',
    certCode: 'DCA',
    aliases: [
      /\bdocker\s*certified\s*associate\b/i,
      /\bdca\b/i,
      /\bdocker\s*cert(ification)?\b/i,
      /\bmirantis\b.*\bdocker\b/i,
    ],

    passingThresholdPercent: 65,
    totalDurationMinutes: 90,
    questionCountTotal: 55,
    scoringScale: { passing: 65, max: 100 },
    questionTypes: 'Multiple choice, discrete option multiple choice (DOMC)',
    performanceBased: false,

    formats: [
      {
        formatName: 'DCA Exam',
        description: '55 questions on Docker container management, orchestration, networking, and security',
        timeAllocation: 90,
        pointWeight: 100,
        questionCount: 55,
        questionFormat: 'multiple-choice',
        sectionType: 'written',
        canGoBack: false,
        negativeMarking: false,
        shuffleQuestions: true,
        instructions: 'Uses DOMC format — options are presented one at a time and you cannot go back.',
      },
    ],

    subjects: [
      {
        name: 'Orchestration',
        weight: 25,
        topics: [
          { name: 'Docker Swarm setup and management' },
          { name: 'Service deployment and scaling' },
          { name: 'Stack and compose for orchestration' },
        ],
        chapters: [
          {
            name: 'Swarm Orchestration',
            topics: [
              { name: 'Swarm initialization, joining, and node management' },
              { name: 'Service creation, scaling, and rolling updates' },
              { name: 'Docker Compose and docker stack deploy' },
            ],
          },
          {
            name: 'Advanced Orchestration',
            topics: [
              { name: 'Placement constraints and preferences' },
              { name: 'Secrets and configs management in Swarm' },
              { name: 'Raft consensus and quorum in Swarm' },
            ],
          },
        ],
      },
      {
        name: 'Image Creation, Management, and Registry',
        weight: 20,
        topics: [
          { name: 'Dockerfile best practices' },
          { name: 'Image layers and caching' },
          { name: 'Docker registries (DTR, Docker Hub)' },
        ],
        chapters: [
          {
            name: 'Images',
            topics: [
              { name: 'Dockerfile instructions (FROM, RUN, COPY, ADD, ENTRYPOINT, CMD)' },
              { name: 'Multi-stage builds for minimal images' },
              { name: 'Image tagging, pushing, and pulling from registries' },
            ],
          },
        ],
      },
      {
        name: 'Installation and Configuration',
        weight: 15,
        topics: [
          { name: 'Docker Engine installation' },
          { name: 'Storage drivers and daemon configuration' },
          { name: 'Logging and monitoring' },
        ],
        chapters: [
          {
            name: 'Setup',
            topics: [
              { name: 'Docker Engine installation on various Linux distributions' },
              { name: 'Storage drivers (overlay2, devicemapper) selection' },
              { name: 'Docker daemon configuration (daemon.json)' },
            ],
          },
        ],
      },
      {
        name: 'Networking',
        weight: 15,
        topics: [
          { name: 'Docker networking drivers' },
          { name: 'Overlay networks for Swarm' },
          { name: 'Network troubleshooting' },
        ],
        chapters: [
          {
            name: 'Networking',
            topics: [
              { name: 'Network drivers: bridge, host, overlay, macvlan, none' },
              { name: 'Service discovery and DNS in Docker networks' },
              { name: 'Publishing ports and load balancing' },
            ],
          },
        ],
      },
      {
        name: 'Security',
        weight: 15,
        topics: [
          { name: 'Docker content trust and image signing' },
          { name: 'Security scanning and best practices' },
          { name: 'User namespaces and capabilities' },
        ],
        chapters: [
          {
            name: 'Container Security',
            topics: [
              { name: 'Docker Content Trust (DCT) and image signing' },
              { name: 'Docker secrets for sensitive data management' },
              { name: 'User namespaces, seccomp, and AppArmor profiles' },
            ],
          },
        ],
      },
      {
        name: 'Storage and Volumes',
        weight: 10,
        topics: [
          { name: 'Volume types and management' },
          { name: 'Bind mounts and tmpfs' },
          { name: 'Storage drivers and persistence' },
        ],
        chapters: [
          {
            name: 'Storage',
            topics: [
              { name: 'Named volumes, anonymous volumes, and bind mounts' },
              { name: 'Volume drivers and plugins' },
              { name: 'Data persistence patterns for containerized apps' },
            ],
          },
        ],
      },
    ],

    examIntelligence: {
      overview: 'The Docker Certified Associate (DCA) exam is now administered by Mirantis (who acquired Docker Enterprise). Validates Docker container management skills including orchestration with Swarm, image management, networking, security, and storage. Uses DOMC question format where you cannot go back.',
      totalDuration: 90,
      passingScore: 65,
      tips: [
        'CRITICAL: Uses DOMC format — options appear one at a time and you CANNOT go back',
        'Orchestration (25%) is the largest domain — know Docker Swarm thoroughly',
        'Dockerfile best practices and multi-stage builds are heavily tested',
        'Understand all network drivers and when to use each one',
        'Docker Content Trust and secrets management are key security topics',
        'Despite low passing score (65%), the DOMC format makes it harder than expected',
      ],
    },

    questionStyle: 'Discrete Option Multiple Choice (DOMC) format — options are presented one at a time and you must decide yes/no for each before moving on. Cannot go back to previous options or questions. Tests practical Docker knowledge including CLI commands, Dockerfile syntax, and Swarm configuration.',
  },
]
