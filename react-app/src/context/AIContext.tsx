// AI Context
// ===========
// ניהול state גלובלי למערכת ה-AI

import React, { createContext, useState, useCallback } from 'react';
import { aiService } from '@services/api/aiService';
import { useAuth } from '@hooks/useAuth';
import { useBudgetTasks } from '@hooks/useBudgetTasks';
import { useTimesheet } from '@hooks/useTimesheet';
import { useClients } from '@hooks/useClients';
import { buildUserContext, buildMinimalContext } from '@utils/buildUserContext';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIContextType {
  // State
  messages: ChatMessage[];
  isOpen: boolean;
  isProcessing: boolean;
  error: string | null;

  // Actions
  sendMessage: (message: string, useFullContext?: boolean) => Promise<void>;
  clearConversation: () => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
}

export const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { tasks } = useBudgetTasks();
  const { entries } = useTimesheet();
  const { clients } = useClients();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Send a message to the AI
   */
  const sendMessage = useCallback(
    async (message: string, useFullContext: boolean = false) => {
      if (!message.trim()) return;
      if (!user) {
        setError('יש להתחבר למערכת כדי להשתמש בעוזר החכם');
        return;
      }

      setError(null);
      setIsProcessing(true);

      // Add user message to chat
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        // Build context from user data
        const contextData = {
          user,
          tasks,
          timesheetEntries: entries,
          clients,
        };

        const context = useFullContext
          ? buildUserContext(contextData)
          : buildMinimalContext(contextData);

        // Send to AI
        const response = await aiService.sendMessage(message, context);

        // Add AI response to chat
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (err: any) {
        console.error('[AI Context] Error:', err);

        let errorMessage = 'אירעה שגיאה בתקשורת עם העוזר החכם';

        if (err.message.includes('API Key')) {
          errorMessage =
            '⚠️ מערכת ה-AI לא מוגדרת. אנא פנה למנהל המערכת להגדרת מפתח API של OpenAI.';
        } else if (err.message.includes('rate limit')) {
          errorMessage = '⏱️ חרגת ממכסת הבקשות. נסה שוב בעוד מספר דקות.';
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          errorMessage = '🌐 שגיאת רשת. בדוק את החיבור לאינטרנט.';
        }

        setError(errorMessage);

        // Add error message to chat
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `❌ ${errorMessage}`,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [user, tasks, entries, clients]
  );

  /**
   * Clear conversation
   */
  const clearConversation = useCallback(() => {
    setMessages([]);
    aiService.clearHistory();
    setError(null);
  }, []);

  /**
   * Toggle chat open/closed
   */
  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  /**
   * Open chat
   */
  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  /**
   * Close chat
   */
  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value: AIContextType = {
    messages,
    isOpen,
    isProcessing,
    error,
    sendMessage,
    clearConversation,
    toggleChat,
    openChat,
    closeChat,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};
