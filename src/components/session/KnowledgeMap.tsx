import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Subject, Topic, Chapter } from '../../db/schema'
import { isTopicLocked } from '../../lib/knowledgeGraph'

interface KnowledgeMapProps {
  subject: Subject | undefined
  chapters: Chapter[]
  topics: Topic[]
  currentTopicId?: string
  exerciseStatsByTopic?: Map<string, { total: number; completed: number }>
}

function masteryColor(m: number): string {
  if (m >= 0.7) return '#22c55e'
  if (m >= 0.3) return '#eab308'
  return '#ef4444'
}

// Chapter header node
function ChapterNode({ data }: { data: { label: string; color: string } }) {
  return (
    <div className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: data.color + '15', color: data.color, borderLeft: `3px solid ${data.color}` }}>
      {data.label}
    </div>
  )
}

// Topic node
function TopicNode({ data }: { data: { label: string; mastery: number; exercises: string; isCurrent: boolean; topicName: string; locked?: boolean } }) {
  const navigate = useNavigate()
  const pct = Math.round(data.mastery * 100)
  const color = data.locked ? '#9ca3af' : masteryColor(data.mastery)
  const ringClass = data.isCurrent ? 'ring-2 ring-[var(--accent-text)]' : ''

  return (
    <div
      className={`glass-card px-3 py-2 min-w-[140px] max-w-[200px] cursor-pointer hover:ring-1 hover:ring-[var(--accent-text)]/30 transition-all ${ringClass} ${data.locked ? 'opacity-60' : ''}`}
      onClick={() => navigate(`/session?topic=${encodeURIComponent(data.topicName)}`)}
    >
      <Handle type="target" position={Position.Left} className="!bg-[var(--accent-text)] !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}>
          {data.locked && <span className="text-[6px] flex items-center justify-center h-full text-white">🔒</span>}
        </div>
        <span className="text-xs font-medium text-[var(--text-heading)] leading-tight">{data.label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold" style={{ color }}>{pct}%</span>
        {data.exercises && (
          <span className="text-[10px] text-[var(--text-muted)]">{data.exercises}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-[var(--accent-text)] !w-2 !h-2" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  chapter: ChapterNode,
  topic: TopicNode,
}

export function KnowledgeMap({ subject, chapters, topics, currentTopicId, exerciseStatsByTopic }: KnowledgeMapProps) {
  const topicMasteryMap = useMemo(() => new Map(topics.map(t => [t.id, t.mastery])), [topics])

  const { nodes, edges } = useMemo(() => {
    if (!subject || chapters.length === 0) return { nodes: [], edges: [] }

    const nodes: Node[] = []
    const edges: Edge[] = []

    const CHAPTER_GAP_Y = 40
    const TOPIC_GAP_Y = 70
    const TOPIC_START_X = 200
    const TOPIC_GAP_X = 230
    let currentY = 0

    for (const chapter of chapters) {
      const chapterTopics = topics.filter(t => t.chapterId === chapter.id)

      // Chapter label node
      nodes.push({
        id: `ch-${chapter.id}`,
        type: 'chapter',
        position: { x: 0, y: currentY },
        data: { label: chapter.name, color: subject.color },
        draggable: false,
        selectable: false,
      })

      // Topic nodes in a column to the right
      for (let ti = 0; ti < chapterTopics.length; ti++) {
        const topic = chapterTopics[ti]
        const stats = exerciseStatsByTopic?.get(topic.id)
        const exerciseLabel = stats && stats.total > 0 ? `${stats.completed}/${stats.total} ex.` : ''

        const lockInfo = isTopicLocked(topic, topicMasteryMap)

        nodes.push({
          id: topic.id,
          type: 'topic',
          position: { x: TOPIC_START_X + (ti % 3) * TOPIC_GAP_X, y: currentY + Math.floor(ti / 3) * TOPIC_GAP_Y },
          data: {
            label: topic.name,
            mastery: topic.mastery,
            exercises: exerciseLabel,
            isCurrent: topic.id === currentTopicId,
            topicName: topic.name,
            locked: lockInfo.locked,
          },
        })

        // Edge from chapter to first topic in each row
        if (ti % 3 === 0) {
          edges.push({
            id: `ch-${chapter.id}-to-${topic.id}`,
            source: `ch-${chapter.id}`,
            target: topic.id,
            style: { stroke: subject.color + '40', strokeWidth: 1 },
            type: 'straight',
          })
        }
      }

      // Prerequisite edges between topics
      for (const topic of chapterTopics) {
        if (topic.prerequisiteTopicIds && topic.prerequisiteTopicIds.length > 0) {
          for (const prereqId of topic.prerequisiteTopicIds) {
            // Only show edges for topics that are in the current view
            if (topics.some(t => t.id === prereqId)) {
              edges.push({
                id: `prereq-${prereqId}-${topic.id}`,
                source: prereqId,
                target: topic.id,
                animated: true,
                style: { stroke: '#6366f1', strokeWidth: 2 },
                label: 'requires',
                labelStyle: { fontSize: 9, fill: '#6366f1' },
              })
            }
          }
        }
      }

      const topicRows = Math.max(1, Math.ceil(chapterTopics.length / 3))
      currentY += topicRows * TOPIC_GAP_Y + CHAPTER_GAP_Y
    }

    return { nodes, edges }
  }, [subject, chapters, topics, currentTopicId, exerciseStatsByTopic, topicMasteryMap])

  if (!subject || topics.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-[var(--text-muted)]">No topics yet. Set up your subjects to see the knowledge map.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1" style={{ height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
