/**
 * Tool definitions for the plan canvas agent.
 * 7 tools for manipulating the study plan canvas.
 */
import type { ToolDefinition } from './types'

export const canvasTools: ToolDefinition[] = [
  {
    name: 'addActivity',
    description: 'Add a study activity to a specific day in the plan.',
    input_schema: {
      type: 'object',
      properties: {
        day: { type: 'string', description: 'Day label (e.g., "Monday", "Tuesday")' },
        topicName: { type: 'string', description: 'Name of the topic to study' },
        activityType: { type: 'string', description: 'Activity type: read, flashcards, practice, socratic, explain-back, review' },
        durationMinutes: { type: 'number', description: 'Duration in minutes (15-120)' },
      },
      required: ['day', 'topicName', 'activityType', 'durationMinutes'],
    },
  },
  {
    name: 'removeActivity',
    description: 'Remove an activity from a specific day by its index (0-based).',
    input_schema: {
      type: 'object',
      properties: {
        day: { type: 'string', description: 'Day label (e.g., "Monday")' },
        activityIndex: { type: 'number', description: '0-based index of the activity to remove' },
      },
      required: ['day', 'activityIndex'],
    },
  },
  {
    name: 'moveActivity',
    description: 'Move an activity from one day to another.',
    input_schema: {
      type: 'object',
      properties: {
        fromDay: { type: 'string', description: 'Source day label' },
        fromIndex: { type: 'number', description: '0-based index of the activity to move' },
        toDay: { type: 'string', description: 'Destination day label' },
      },
      required: ['fromDay', 'fromIndex', 'toDay'],
    },
  },
  {
    name: 'replaceActivity',
    description: 'Replace an existing activity with new details.',
    input_schema: {
      type: 'object',
      properties: {
        day: { type: 'string', description: 'Day label' },
        activityIndex: { type: 'number', description: '0-based index of the activity to replace' },
        topicName: { type: 'string', description: 'New topic name' },
        activityType: { type: 'string', description: 'New activity type' },
        durationMinutes: { type: 'number', description: 'New duration in minutes' },
      },
      required: ['day', 'activityIndex', 'topicName', 'activityType', 'durationMinutes'],
    },
  },
  {
    name: 'clearDay',
    description: 'Remove all activities from a specific day.',
    input_schema: {
      type: 'object',
      properties: {
        day: { type: 'string', description: 'Day label to clear' },
      },
      required: ['day'],
    },
  },
  {
    name: 'rebalanceWeek',
    description: 'Regenerate the entire week plan using AI, optionally focusing on specific topics. Use this for major restructuring.',
    input_schema: {
      type: 'object',
      properties: {
        focusTopics: {
          type: 'array',
          description: 'Optional list of topic names to prioritize',
          items: { type: 'string' },
        },
      },
    },
  },
  {
    name: 'suggestChange',
    description: 'Show a non-blocking suggestion to the user as a dismissible bubble. Use this instead of making direct changes when you want to propose something.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The suggestion message to show the user' },
      },
      required: ['message'],
    },
  },
]
