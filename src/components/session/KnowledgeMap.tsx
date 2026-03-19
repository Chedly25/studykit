import { useMemo, useCallback } from 'react'
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
import { useConceptCards } from '../../hooks/useConceptCards'

interface KnowledgeMapProps {
  examProfileId: string
  topicId: string
  onSelectCard?: (cardId: string) => void
}

function ConceptNode({ data }: { data: { label: string; mastery: number; cardId: string; onSelect?: (id: string) => void } }) {
  const masteryPct = Math.round(data.mastery * 100)
  const color = data.mastery >= 0.8 ? '#22c55e' : data.mastery >= 0.3 ? '#eab308' : '#ef4444'

  return (
    <div
      className="glass-card px-3 py-2 min-w-[120px] cursor-pointer hover:ring-1 hover:ring-[var(--accent-text)]/30 transition-all"
      onClick={() => data.onSelect?.(data.cardId)}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--accent-text)] !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium text-[var(--text-heading)] truncate">{data.label}</span>
      </div>
      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{masteryPct}%</div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--accent-text)] !w-2 !h-2" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  concept: ConceptNode,
}

export function KnowledgeMap({ examProfileId, topicId, onSelectCard }: KnowledgeMapProps) {
  const { cards, connections } = useConceptCards(examProfileId, topicId)

  const { nodes, edges } = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(cards.length))
    const nodes: Node[] = cards.map((card, i) => ({
      id: card.id,
      type: 'concept',
      position: { x: (i % cols) * 200, y: Math.floor(i / cols) * 100 },
      data: { label: card.title, mastery: card.mastery, cardId: card.id, onSelect: onSelectCard },
    }))

    const edges: Edge[] = connections.map(conn => ({
      id: conn.id,
      source: conn.fromCardId,
      target: conn.toCardId,
      label: conn.label,
      style: { stroke: 'var(--accent-text)', strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: 'var(--text-muted)' },
    }))

    return { nodes, edges }
  }, [cards, connections, onSelectCard])

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-[var(--text-muted)]">No concept cards yet.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Build cards in the chat, then view them here as a knowledge map.</p>
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
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
