// AI Service - OpenAI Integration
// =================================
// שירות לתקשורת עם OpenAI API

/**
 * ⚠️ SECURITY WARNING:
 *
 * This implementation exposes the OpenAI API key in the client.
 * For production use, you MUST implement a Firebase Function proxy:
 *
 * Client → Firebase Function → OpenAI API
 *
 * This prevents:
 * - API key exposure in client code
 * - Unauthorized API usage
 * - Rate limiting bypass
 * - Cost control issues
 *
 * See: functions/ai-proxy.js (to be implemented)
 */

export interface AIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  message: string;
  tokensUsed?: number;
}

// Default configuration
const DEFAULT_CONFIG: AIConfig = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
  systemPrompt: `
אתה עוזר אישי חכם למערכת ניהול משרד עורכי דין.

📋 תפקידך:
- לעזור לעובדים לנהל משימות, תיקים ולקוחות
- לנתח נתונים ולתת תובנות
- לענות על שאלות בצורה ברורה ומקצועית
- לספק המלצות מעשיות

✅ אתה יכול:
- לנתח משימות ותיקים של המשתמש
- לתת סיכומים וסטטיסטיקות
- לזהות בעיות ולהציע פתרונות
- לעזור במעקב אחרי לוחות זמנים

❌ אתה לא יכול:
- לשנות נתונים במערכת (read-only)
- לתת ייעוץ משפטי (רק ניהול מנהלי)
- לגשת לנתונים של עובדים אחרים

🎯 סגנון תשובה:
- תמיד בעברית תקנית
- קצר וממוקד (עד 5-6 שורות, אלא אם מבקשים יותר)
- השתמש באמוג'י בשביל בהירות (✅ ❌ ⚠️ 💡 📊)
- אם משהו לא ברור, שאל שאלות הבהרה

💡 טיפ: המשתמש עובד במשרד עורכי דין, אז היה מקצועי אבל גם ידידותי.
  `.trim(),
};

class AIService {
  private config: AIConfig;
  private conversationHistory: AIMessage[] = [];

  constructor(config: Partial<AIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.apiKey || this.config.apiKey === 'your_openai_api_key_here') {
      console.warn(
        '⚠️ OpenAI API Key not configured! AI features will not work.\n' +
          'Set VITE_OPENAI_API_KEY in your .env file.'
      );
    }
  }

  /**
   * Send a message to the AI and get a response
   */
  async sendMessage(userMessage: string, context?: string): Promise<AIResponse> {
    if (!this.config.apiKey || this.config.apiKey === 'your_openai_api_key_here') {
      throw new Error(
        'OpenAI API Key not configured. Please set VITE_OPENAI_API_KEY in your .env file.'
      );
    }

    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    // Add user message to history
    const userContent = context
      ? `[הקשר המשתמש]\n${context}\n\n[שאלת המשתמש]\n${userMessage}`
      : userMessage;

    this.conversationHistory.push({
      role: 'user',
      content: userContent,
    });

    // Build messages array
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.config.systemPrompt,
      },
      // Include last 5 messages for context
      ...this.conversationHistory.slice(-5),
    ];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI');
      }

      const aiMessage = data.choices[0].message.content;

      // Add AI response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: aiMessage,
      });

      return {
        message: aiMessage,
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      console.error('[AI Service] Error:', error);
      throw error;
    }
  }

  /**
   * Send a message with streaming response (word-by-word)
   */
  async sendMessageStreaming(
    userMessage: string,
    context?: string,
    onChunk?: (chunk: string) => void
  ): Promise<AIResponse> {
    if (!this.config.apiKey || this.config.apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API Key not configured');
    }

    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    const userContent = context
      ? `[הקשר המשתמש]\n${context}\n\n[שאלת המשתמש]\n${userMessage}`
      : userMessage;

    this.conversationHistory.push({
      role: 'user',
      content: userContent,
    });

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.config.systemPrompt,
      },
      ...this.conversationHistory.slice(-5),
    ];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder('utf-8');
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

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
              // Ignore parsing errors
            }
          }
        }
      }

      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });

      return {
        message: fullResponse,
      };
    } catch (error) {
      console.error('[AI Service] Streaming error:', error);
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): AIMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const aiService = new AIService();
