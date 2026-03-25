/**
 * Workflow reconstruction registry — maps JobType + serialized config
 * back into WorkflowDefinitions for resuming background jobs.
 */
import type { WorkflowDefinition } from './types'
import type { JobType } from '../../db/schema'
import { createSourceProcessingWorkflow } from '../workflows/sourceProcessing'
import { createArticleReviewWorkflow } from '../workflows/articleReview'
import { createArticleSynthesisWorkflow } from '../workflows/articleSynthesis'
import { createPracticeExamWorkflow } from '../workflows/practiceExam'
import { createGradingWorkflow } from '../workflows/practiceExamGrading'
import { createExamResearchWorkflow } from '../workflows/examResearch'
import { createExamExerciseProcessingWorkflow } from '../workflows/examExerciseProcessing'
import { createMisconceptionExerciseWorkflow } from '../workflows/misconceptionExercise'
import { createExamSimulationWorkflow } from '../workflows/examSimulation'
import { createDocumentExamWorkflow } from '../workflows/documentExam'
import { createDocumentExamGradingWorkflow } from '../workflows/documentExamGrading'
import { createSyntheseGenerationWorkflow } from '../workflows/syntheseGeneration'
import { createSyntheseGradingWorkflow } from '../workflows/syntheseGrading'
import { createCasPratiqueGenerationWorkflow } from '../workflows/casPratiqueGeneration'
import { createGrandOralGenerationWorkflow } from '../workflows/grandOralGeneration'
import { createFicheGenerationWorkflow } from '../workflows/ficheGeneration'

/**
 * Reconstruct a WorkflowDefinition from a job type and its serialized config.
 * This is needed because workflow definitions contain functions (execute, shouldRun)
 * and cannot be serialized — we store the config and re-call the factory.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function reconstructWorkflow(type: JobType, config: Record<string, unknown>): WorkflowDefinition<any> {
  switch (type) {
    case 'source-processing':
      return createSourceProcessingWorkflow({
        documentId: config.documentId as string,
        isPro: config.isPro as boolean,
      })

    case 'article-review-batch':
      // Batch items are reconstructed individually in executeBatchJob
      // This should not be called directly for batch jobs
      throw new Error('Use executeBatchJob for article-review-batch')

    case 'article-synthesis':
      return createArticleSynthesisWorkflow({
        projectId: config.projectId as string,
      })

    case 'practice-exam-generation':
      return createPracticeExamWorkflow({
        sessionId: config.sessionId as string,
        questionCount: config.questionCount as number,
        focusSubject: config.focusSubject as string | undefined,
        selectedTopics: config.selectedTopics as string[] | undefined,
        customFocus: config.customFocus as string | undefined,
        examSection: config.examSection as string | undefined,
        sourcesEnabled: config.sourcesEnabled as boolean,
        simulationMode: config.simulationMode as boolean | undefined,
        sections: config.sections as import('../workflows/practiceExam').SimulationSection[] | undefined,
      })

    case 'practice-exam-grading':
      return createGradingWorkflow({
        sessionId: config.sessionId as string,
      })

    case 'exam-research':
      return createExamResearchWorkflow({
        examProfileId: config.examProfileId as string,
        profileName: config.profileName as string,
        examType: config.examType as string,
      })

    case 'study-plan':
    case 'session-insight':
      // These use standalone async functions, not the workflow engine.
      // They are handled specially in JobRunner.executeJob.
      throw new Error(`${type} uses a standalone function, not a workflow definition`)

    case 'exam-exercise-processing':
      return createExamExerciseProcessingWorkflow({
        documentId: config.documentId as string,
        isPro: config.isPro as boolean,
      })

    case 'misconception-exercise':
      return createMisconceptionExerciseWorkflow({
        examProfileId: config.examProfileId as string,
        maxMisconceptions: config.maxMisconceptions as number | undefined,
      })

    case 'exam-simulation':
      return createExamSimulationWorkflow({
        sessionId: config.sessionId as string,
        sourcesEnabled: config.sourcesEnabled as boolean,
        sections: config.sections as import('../workflows/practiceExam').SimulationSection[],
      })

    case 'document-exam-generation':
      return createDocumentExamWorkflow({
        sessionId: config.sessionId as string,
        subject: config.subject as import('../prompts/documentExamPrompts').DocumentExamSubject,
        concours: config.concours as import('../prompts/documentExamPrompts').ConcoursType,
        sourcesEnabled: config.sourcesEnabled as boolean,
        timeLimitSeconds: config.timeLimitSeconds as number | undefined,
      })

    case 'document-exam-grading':
      return createDocumentExamGradingWorkflow({
        sessionId: config.sessionId as string,
      })

    case 'synthesis-generation':
      return createSyntheseGenerationWorkflow({
        sessionId: config.sessionId as string,
        sourcesEnabled: config.sourcesEnabled as boolean,
      })

    case 'synthesis-grading':
      return createSyntheseGradingWorkflow({
        sessionId: config.sessionId as string,
      })

    case 'cas-pratique-generation':
      return createCasPratiqueGenerationWorkflow({
        sessionId: config.sessionId as string,
        specialty: config.specialty as import('../prompts/casPratiquePrompts').CasPratiqueSpecialty,
        duration: config.duration as number,
      })

    case 'grand-oral-generation':
      return createGrandOralGenerationWorkflow({
        sessionId: config.sessionId as string,
      })

    case 'fiche-generation':
      return createFicheGenerationWorkflow({
        topicId: config.topicId as string,
        topicName: config.topicName as string,
        subjectId: config.subjectId as string,
        subjectName: config.subjectName as string,
        examName: config.examName as string,
        language: config.language as 'fr' | 'en' | undefined,
      })

    default:
      throw new Error(`Unknown job type: ${type}`)
  }
}

/**
 * Reconstruct a single article review workflow for batch item processing.
 * The ingestion step has already run — remaining steps don't need the File object.
 */
export function reconstructArticleWorkflow(itemConfig: Record<string, unknown>): WorkflowDefinition<unknown> {
  // Create a dummy File since ingestion was already done before enqueue.
  // The workflow's ingest step checks processingStatus and skips if already ingested.
  return createArticleReviewWorkflow({
    file: new File([], 'already-ingested.pdf'),
    articleId: itemConfig.articleId as string,
    projectId: itemConfig.projectId as string,
    projectDescription: itemConfig.projectDescription as string,
    examProfileId: itemConfig.examProfileId as string,
  })
}
