// ChatBot Component
// ==================
// עוזר חכם מבוסס AI

import React, { useState, useRef, useEffect } from 'react';
import { useAI } from '@hooks/useAI';
import './ChatBot.css';

const QUICK_ACTIONS = [
  '📋 מה המשימות שלי?',
  '📊 תן לי סיכום שבועי',
  '⚠️ מה דורש תשומת לב?',
  '🎯 איך הביצועים שלי?',
];

export const ChatBot: React.FC = () => {
  const { messages, isOpen, isProcessing, error, sendMessage, clearConversation, toggleChat, closeChat } = useAI();

  const [inputValue, setInputValue] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Hide quick actions after first message
  useEffect(() => {
    if (messages.length > 0) {
      setShowQuickActions(false);
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message, false); // Use minimal context for faster responses
  };

  const handleQuickAction = async (action: string) => {
    setShowQuickActions(false);
    await sendMessage(action, true); // Use full context for complex queries
  };

  const handleClear = () => {
    if (window.confirm('האם למחוק את כל השיחה?')) {
      clearConversation();
      setShowQuickActions(true);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button className="chatbot-fab" onClick={toggleChat} title="פתח עוזר חכם">
          <i className="fas fa-robot"></i>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-title">
              <i className="fas fa-robot"></i>
              <span>עוזר חכם</span>
            </div>
            <div className="chatbot-actions">
              {messages.length > 0 && (
                <button
                  className="chatbot-header-btn"
                  onClick={handleClear}
                  title="נקה שיחה"
                  disabled={isProcessing}
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              )}
              <button className="chatbot-header-btn" onClick={closeChat} title="סגור">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="chatbot-welcome">
                <div className="chatbot-welcome-icon">
                  <i className="fas fa-robot"></i>
                </div>
                <h3>👋 שלום!</h3>
                <p>אני העוזר החכם שלך. שאל אותי כל שאלה על המשימות, התיקים או הנתונים שלך!</p>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((message) => (
              <div key={message.id} className={`chatbot-message chatbot-message-${message.role}`}>
                <div className="chatbot-message-avatar">
                  {message.role === 'user' ? (
                    <i className="fas fa-user"></i>
                  ) : (
                    <i className="fas fa-robot"></i>
                  )}
                </div>
                <div className="chatbot-message-content">
                  <div className="chatbot-message-text">{message.content}</div>
                  <div className="chatbot-message-time">
                    {message.timestamp.toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="chatbot-message chatbot-message-assistant">
                <div className="chatbot-message-avatar">
                  <i className="fas fa-robot"></i>
                </div>
                <div className="chatbot-message-content">
                  <div className="chatbot-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="chatbot-error">
                <i className="fas fa-exclamation-triangle"></i>
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {showQuickActions && messages.length === 0 && (
            <div className="chatbot-quick-actions">
              {QUICK_ACTIONS.map((action, index) => (
                <button
                  key={index}
                  className="chatbot-quick-action"
                  onClick={() => handleQuickAction(action)}
                  disabled={isProcessing}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form className="chatbot-input-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="chatbot-input"
              placeholder="שאל אותי משהו..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isProcessing}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={!inputValue.trim() || isProcessing}
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>
        </div>
      )}
    </>
  );
};
