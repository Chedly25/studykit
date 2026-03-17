import { createContext, useContext } from 'react'

interface ChatContextValue {
  examProfileId: string | undefined
  getToken: () => Promise<string | null>
}

const ChatContext = createContext<ChatContextValue>({
  examProfileId: undefined,
  getToken: async () => null,
})

export const ChatContextProvider = ChatContext.Provider

export function useChatContext() {
  return useContext(ChatContext)
}
