// ============================================================================
// CHATVISTA - Chat Panel Component
// Real-time chat panel for meeting participants
// ============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Smile, Paperclip, MoreVertical } from 'lucide-react';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'file' | 'reaction';
  isPrivate?: boolean;
  recipientId?: string;
}

interface ChatPanelProps {
  messages?: ChatMessage[];
  currentUserId?: string;
  participants?: Array<{ id: string; name: string }>;
  onSendMessage?: (content: string, recipientId?: string) => void;
  onClose?: () => void;
  meetingId?: string;
}

export function ChatPanel({
  messages = [],
  currentUserId = '',
  participants = [],
  onSendMessage,
  onClose,
  meetingId: _meetingId,
}: ChatPanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const [privateRecipient, setPrivateRecipient] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && onSendMessage) {
      onSendMessage(newMessage.trim(), privateRecipient || undefined);
      setNewMessage('');
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupedMessages = messages.reduce((groups, message) => {
    const dateKey = new Date(message.timestamp).toLocaleDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className="flex flex-col h-full bg-gray-900/95 backdrop-blur border-l border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-white">Chat</h2>
          <p className="text-sm text-gray-400">{messages.length} messages</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Private message selector */}
      <div className="p-3 border-b border-gray-700">
        <select
          value={privateRecipient || ''}
          onChange={(e) => setPrivateRecipient(e.target.value || null)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Everyone</option>
          {participants
            .filter((p) => p.id !== currentUserId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                Privately to {p.name}
              </option>
            ))}
        </select>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center justify-center my-4">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="px-3 text-xs text-gray-500">{date}</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Messages for this date */}
            {dateMessages.map((message, index) => {
              const isOwn = message.userId === currentUserId;
              const showAvatar =
                index === 0 || dateMessages[index - 1].userId !== message.userId;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] ${showAvatar ? 'mt-3' : 'mt-1'}`}
                  >
                    {/* Sender name (only for others) */}
                    {!isOwn && showAvatar && (
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          {message.userName[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-300">
                          {message.userName}
                        </span>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`
                        px-4 py-2 rounded-2xl
                        ${isOwn
                          ? 'bg-blue-500 text-white rounded-br-md'
                          : 'bg-gray-700 text-white rounded-bl-md'
                        }
                        ${message.isPrivate ? 'border-2 border-yellow-500/50' : ''}
                      `}
                    >
                      {message.isPrivate && (
                        <span className="text-xs text-yellow-300 block mb-1">
                          Private message
                        </span>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <span
                        className={`text-xs mt-1 block ${
                          isOwn ? 'text-blue-200' : 'text-gray-400'
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-center">
              No messages yet.
              <br />
              Start the conversation!
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              privateRecipient
                ? 'Type a private message...'
                : 'Type a message to everyone...'
            }
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {privateRecipient && (
          <p className="text-xs text-yellow-400 mt-2 text-center">
            Sending private message
          </p>
        )}
      </form>
    </div>
  );
}
