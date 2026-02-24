/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AI ENGINE - OpenAI Integration
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description מנוע תקשורת עם OpenAI API
 * @version 1.0.0
 * @created 2025-10-26
 *
 * @features
 * - שליחת הודעות ל-ChatGPT
 * - קבלת תשובות (רגילות או streaming)
 * - ניהול שגיאות
 * - היסטוריית שיחה
 *
 */

'use strict';

/**
 * @class AIEngine
 * @description מנוע ה-AI המרכזי
 */
class AIEngine {
  constructor() {
    this.config = window.AI_CONFIG;
    this.conversationHistory = [];
    this.isProcessing = false;

    // בדיקת תקינות
    this._validateConfig();
  }

  /**
   * בדיקה שה-API Key הוגדר
   * @private
   */
  _validateConfig() {
    if (!this.config) {
      throw new Error('AI_CONFIG not found. Make sure ai-config.js is loaded first.');
    }

    if (!this.config.apiKey || this.config.apiKey === 'YOUR_API_KEY_HERE') {
      console.error('⚠️ AI System: API Key not configured!');
      console.log('📝 Follow these steps:');
      console.log('1. Go to https://platform.openai.com/');
      console.log('2. Create an API key');
      console.log('3. Paste it in js/modules/ai-system/ai-config.js');
    }
  }

  /**
   * שולח הודעה ל-AI ומקבל תשובה
   * @param {string} userMessage - הודעת המשתמש
   * @param {string} userContext - הקשר המשתמש (נתונים מ-Firebase)
   * @returns {Promise<string>} תשובת ה-AI
   */
  async sendMessage(userMessage, userContext = '') {
    try {
      // בדיקות
      if (!userMessage || userMessage.trim().length === 0) {
        throw new Error('User message is empty');
      }

      if (!this.config.apiKey || this.config.apiKey === 'YOUR_API_KEY_HERE') {
        throw new Error(this.config.errorMessages.noApiKey);
      }

      this.isProcessing = true;

      // הוספת ההודעה להיסטוריה
      this._addToHistory('user', userMessage);

      // בניית ההודעות
      const messages = this._buildMessages(userMessage, userContext);

      if (this.config.debugMode) {
        console.log('[AI Engine] Sending request:', {
          model: this.config.model,
          messagesCount: messages.length,
          userMessage: userMessage.substring(0, 50) + '...'
        });
      }

      // שליחה ל-OpenAI
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
        })
      });

      // טיפול בשגיאות HTTP
      if (!response.ok) {
        await this._handleHTTPError(response);
      }

      // קבלת התשובה
      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI');
      }

      const aiResponse = data.choices[0].message.content;

      // הוספת התשובה להיסטוריה
      this._addToHistory('assistant', aiResponse);

      if (this.config.debugMode) {
        console.log('[AI Engine] Received response:', {
          tokensUsed: data.usage?.total_tokens || 'unknown',
          response: aiResponse.substring(0, 100) + '...'
        });
      }

      this.isProcessing = false;
      return aiResponse;

    } catch (error) {
      this.isProcessing = false;
      console.error('[AI Engine] Error:', error);
      throw error;
    }
  }

  /**
   * שולח הודעה עם streaming (תשובה מילה-אחר-מילה)
   * @param {string} userMessage - הודעת המשתמש
   * @param {string} userContext - הקשר המשתמש
   * @param {Function} onChunk - callback לכל חתיכת טקסט
   * @returns {Promise<string>} התשובה המלאה
   */
  async sendMessageStreaming(userMessage, userContext = '', onChunk) {
    try {
      if (!userMessage || userMessage.trim().length === 0) {
        throw new Error('User message is empty');
      }

      if (!this.config.apiKey || this.config.apiKey === 'YOUR_API_KEY_HERE') {
        throw new Error(this.config.errorMessages.noApiKey);
      }

      this.isProcessing = true;
      this._addToHistory('user', userMessage);

      const messages = this._buildMessages(userMessage, userContext);

      // שליחה ל-OpenAI עם streaming
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: true // ← זה מפעיל streaming!
        })
      });

      if (!response.ok) {
        await this._handleHTTPError(response);
      }

      // קריאת streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
break;
}

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);

            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';

              if (content) {
                fullResponse += content;
                if (onChunk) {
                  onChunk(content);
                }
              }
            } catch (e) {
              // שגיאת parsing - מתעלמים
            }
          }
        }
      }

      this._addToHistory('assistant', fullResponse);
      this.isProcessing = false;

      return fullResponse;

    } catch (error) {
      this.isProcessing = false;
      console.error('[AI Engine] Streaming error:', error);
      throw error;
    }
  }

  /**
   * בונה את מערך ההודעות לשליחה ל-API
   * @private
   */
  _buildMessages(userMessage, userContext) {
    const messages = [
      {
        role: 'system',
        content: this.config.systemPrompt
      }
    ];

    // הוספת היסטוריה (5 הודעות אחרונות)
    const recentHistory = this.conversationHistory.slice(-5);
    messages.push(...recentHistory);

    // הוספת ההודעה הנוכחית עם הקשר
    let userContent = userMessage;

    if (userContext && userContext.trim().length > 0) {
      userContent = `
[הקשר המשתמש]
${userContext}

[שאלת המשתמש]
${userMessage}
`.trim();
    }

    messages.push({
      role: 'user',
      content: userContent
    });

    return messages;
  }

  /**
   * מוסיף הודעה להיסטוריה
   * @private
   */
  _addToHistory(role, content) {
    this.conversationHistory.push({ role, content });

    // שמירה על אורך ההיסטוריה
    if (this.conversationHistory.length > this.config.historyLength) {
      this.conversationHistory.shift();
    }

    // שמירה ב-localStorage אם מופעל
    if (this.config.saveHistory) {
      this._saveHistoryToStorage();
    }
  }

  /**
   * שומר היסטוריה ל-localStorage
   * @private
   */
  _saveHistoryToStorage() {
    try {
      const userId = window.currentUser?.uid || 'anonymous';
      const key = `ai_history_${userId}`;
      localStorage.setItem(key, JSON.stringify(this.conversationHistory));
    } catch (e) {
      console.warn('[AI Engine] Failed to save history to localStorage:', e);
    }
  }

  /**
   * טוען היסטוריה מ-localStorage
   */
  loadHistoryFromStorage() {
    try {
      const userId = window.currentUser?.uid || 'anonymous';
      const key = `ai_history_${userId}`;
      const saved = localStorage.getItem(key);

      if (saved) {
        this.conversationHistory = JSON.parse(saved);
        if (this.config.debugMode) {
          console.log('[AI Engine] Loaded history:', this.conversationHistory.length, 'messages');
        }
      }
    } catch (e) {
      console.warn('[AI Engine] Failed to load history from localStorage:', e);
      this.conversationHistory = [];
    }
  }

  /**
   * מנקה את ההיסטוריה
   */
  clearHistory() {
    this.conversationHistory = [];

    try {
      const userId = window.currentUser?.uid || 'anonymous';
      const key = `ai_history_${userId}`;
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[AI Engine] Failed to clear history from localStorage:', e);
    }

    if (this.config.debugMode) {
      console.log('[AI Engine] History cleared');
    }
  }

  /**
   * טיפול בשגיאות HTTP
   * @private
   */
  async _handleHTTPError(response) {
    const status = response.status;
    let errorMessage = this.config.errorMessages.unknownError;

    try {
      const errorData = await response.json();
      const apiError = errorData.error?.message || '';

      if (status === 401) {
        errorMessage = this.config.errorMessages.invalidApiKey;
      } else if (status === 429) {
        errorMessage = this.config.errorMessages.rateLimitExceeded;
      } else if (apiError) {
        errorMessage = `OpenAI Error: ${apiError}`;
      }
    } catch (e) {
      // לא הצלחנו לקרוא את שגיאת ה-JSON
    }

    throw new Error(`HTTP ${status}: ${errorMessage}`);
  }

  /**
   * מחזיר את מצב המנוע
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      historyLength: this.conversationHistory.length,
      hasApiKey: this.config.apiKey && this.config.apiKey !== 'YOUR_API_KEY_HERE',
      model: this.config.model
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Export to global scope
// ═══════════════════════════════════════════════════════════════════════════
window.AIEngine = AIEngine;
window.aiEngine = new AIEngine();

if (window.AI_CONFIG?.debugMode) {
  console.log('[AI Engine] Initialized:', window.aiEngine.getStatus());
}
