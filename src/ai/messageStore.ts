/**
 * Conversation CRUD — stores chat history in IndexedDB.
 */
import { db } from '../db'
import type { Conversation, ChatMessage } from '../db/schema'
import type { Message } from './types'

export async function createConversation(examProfileId: string, title = 'New Conversation', id?: string): Promise<string> {
  const convId = id ?? crypto.randomUUID()
  const now = new Date().toISOString()

  const conversation: Conversation = {
    id: convId,
    examProfileId,
    title,
    createdAt: now,
    updatedAt: now,
  }
  await db.conversations.put(conversation)
  return convId
}

export async function getConversations(examProfileId: string): Promise<Conversation[]> {
  return db.conversations
    .where('examProfileId')
    .equals(examProfileId)
    .reverse()
    .sortBy('updatedAt')
}

export async function loadMessages(conversationId: string): Promise<Message[]> {
  const chatMessages = await db.chatMessages
    .where('conversationId')
    .equals(conversationId)
    .sortBy('timestamp')

  return chatMessages.map(cm => ({
    id: cm.id || crypto.randomUUID(),
    role: cm.role as 'user' | 'assistant',
    content: cm.toolCalls ? (() => { try { return JSON.parse(cm.toolCalls) } catch { return cm.content } })() : cm.content,
  }))
}

export async function saveMessages(conversationId: string, messages: Message[]): Promise<void> {
  const chatMessages: ChatMessage[] = messages.map((m, i) => ({
    id: m.id || `${conversationId}-${i}`,
    conversationId,
    role: m.role as 'user' | 'assistant' | 'system',
    content: typeof m.content === 'string' ? m.content : '',
    toolCalls: typeof m.content !== 'string' ? JSON.stringify(m.content) : undefined,
    timestamp: new Date(Date.now() + i).toISOString(), // preserve order
  }))

  // Atomic: delete + re-insert in a single transaction to prevent data loss on crash
  await db.transaction('rw', db.chatMessages, db.conversations, async () => {
    await db.chatMessages.where('conversationId').equals(conversationId).delete()
    await db.chatMessages.bulkPut(chatMessages)
    await db.conversations.update(conversationId, { updatedAt: new Date().toISOString() })
  })
}

export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  await db.conversations.update(conversationId, { title })
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await db.chatMessages.where('conversationId').equals(conversationId).delete()
  await db.conversations.delete(conversationId)
}
