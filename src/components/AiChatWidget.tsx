'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Trash2, Minimize2 } from 'lucide-react';
import { useLanguage } from '@/lib/language';

// ==========================================
// AI Chat Widget - Floating Chat Bubble
// Burmese Digital Store
// ==========================================

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function AiChatWidget() {
  const { tr } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check if AI chat is enabled
  const isEnabled = process.env.NEXT_PUBLIC_AI_CHAT_ENABLED === 'true';

  // Initialize session
  useEffect(() => {
    const stored = sessionStorage.getItem('ai-chat-session');
    if (stored) {
      setSessionId(stored);
    } else {
      const newId = generateSessionId();
      sessionStorage.setItem('ai-chat-session', newId);
      setSessionId(newId);
    }
  }, []);

  // Load chat history when opened
  useEffect(() => {
    if (isOpen && sessionId && messages.length === 0) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/ai-chat?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success && data.data?.messages?.length > 0) {
        setMessages(
          data.data.messages
            .filter((m: ChatMessage) => m.role !== 'system')
            .map((m: ChatMessage) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }))
        );
      }
    } catch {
      // Ignore history load errors
    }
  };

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !sessionId) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    // Add placeholder for assistant
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          stream: true,
          page: window.location.pathname,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to send message');
      }

      // Check if streaming response
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('data: ')) continue;
            const data = trimmedLine.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                streamedContent += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx]?.role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: streamedContent,
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }
      } else {
        // Non-streaming JSON response
        const data = await res.json();
        if (data.success) {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === 'assistant') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: data.data.message,
              };
            }
            return updated;
          });
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: tr(
              'Sorry, I encountered an error. Please try again.',
              'တောင်းပန်ပါတယ်။ ပြဿနာတစ်ခုရှိပါတယ်။ ထပ်ကြိုးစားပါ။'
            ),
          };
        }
        return updated;
      });
      console.error('[Chat Widget] Error:', error);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [input, isLoading, sessionId, tr]);

  const sendQuickReply = useCallback(async (msg: string) => {
    if (isLoading || !sessionId) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsStreaming(true);

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          sessionId,
          stream: true,
          page: window.location.pathname,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      const contentType = res.headers.get('content-type');
      if (contentType?.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('data: ') || trimmedLine === 'data: [DONE]') continue;
            try {
              const parsed = JSON.parse(trimmedLine.slice(6));
              if (parsed.content) {
                streamedContent += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx]?.role === 'assistant') {
                    updated[lastIdx] = { ...updated[lastIdx], content: streamedContent };
                  }
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      } else {
        const data = await res.json();
        if (data.success) {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === 'assistant') {
              updated[lastIdx] = { ...updated[lastIdx], content: data.data.message };
            }
            return updated;
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: tr('Sorry, I encountered an error. Please try again.', 'တောင်းပန်ပါတယ်။ ပြဿနာတစ်ခုရှိပါတယ်။ ထပ်ကြိုးစားပါ။'),
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [isLoading, sessionId, tr]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    const newId = generateSessionId();
    sessionStorage.setItem('ai-chat-session', newId);
    setSessionId(newId);
  };

  const quickReplies = [
    { label: tr('VPN Plans', 'VPN အစီအစဉ်များ'), message: tr('Show me VPN plans and pricing', 'VPN အစီအစဉ်တွေနဲ့ ဈေးနှုန်းတွေ ပြပေးပါ') },
    { label: tr('How to buy?', 'ဘယ်လို ဝယ်ရမလဲ?'), message: tr('How do I purchase a VPN?', 'VPN ဘယ်လိုဝယ်ရမလဲ?') },
    { label: tr('Setup Help', 'တပ်ဆင်ခြင်း'), message: tr('How to setup VPN on my phone?', 'ဖုန်းမှာ VPN ဘယ်လိုတပ်ဆင်ရမလဲ?') },
  ];

  // Return null if AI chat is disabled (after all hooks)
  if (!isEnabled) return null;

  return (
    <>
      {/* Chat Bubble Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white rounded-full px-5 py-3.5 shadow-2xl shadow-purple-500/25 transition-all duration-300 hover:scale-105 hover:shadow-purple-500/40 group"
          aria-label="Open AI Chat"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">
            {tr('AI Assistant', 'AI အကူအညီ')}
          </span>
          {/* Pulse animation */}
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] sm:w-[400px] h-[560px] flex flex-col bg-[#0d0d24]/95 backdrop-blur-xl border border-purple-500/20 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600/20 to-blue-500/20 border-b border-purple-500/20">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0d0d24]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {tr('AI Assistant', 'AI အကူအညီ')}
                </h3>
                <p className="text-[10px] text-green-400">
                  {isStreaming ? tr('Typing...', 'ရေးနေပါသည်...') : tr('Online', 'အွန်လိုင်း')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 text-white/50 hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors"
                title={tr('New Chat', 'စကားပြောအသစ်')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/50 hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors"
                title={tr('Minimize', 'ချုံ့မည်')}
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/50 hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors"
                title={tr('Close', 'ပိတ်မည်')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth custom-scrollbar">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-3.5 py-2.5 max-w-[85%]">
                    <p className="text-sm text-white/90 leading-relaxed">
                      {tr(
                        "Hi! 👋 I'm the Burmese Digital Store AI Assistant. I can help you with VPN plans, pricing, setup instructions, and more. How can I help you today?",
                        'မင်္ဂလာပါ! 👋 ကျွန်တော်က Burmese Digital Store ရဲ့ AI အကူအညီပါ။ VPN အစီအစဉ်တွေ၊ ဈေးနှုန်းတွေ၊ တပ်ဆင်နည်းတွေနဲ့ အခြားအရာတွေကို ကူညီပေးနိုင်ပါတယ်။ ဘာကူညီပေးရမလဲခင်ဗျ?'
                      )}
                    </p>
                  </div>
                </div>

                {/* Quick Reply Buttons */}
                <div className="flex flex-wrap gap-2 ml-9">
                  {quickReplies.map((qr) => (
                    <button
                      key={qr.label}
                      onClick={() => sendQuickReply(qr.message)}
                      className="text-xs px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 rounded-full transition-colors"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message List */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                    msg.role === 'user'
                      ? 'bg-blue-500/30'
                      : 'bg-gradient-to-br from-purple-500 to-blue-500'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-blue-300" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-500/20 border border-blue-500/30 text-white rounded-tr-md'
                      : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-md'
                  }`}
                >
                  {msg.content ? (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      <span className="text-xs text-white/50">
                        {tr('Thinking...', 'စဉ်းစားနေပါသည်...')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-3 py-3 border-t border-purple-500/15 bg-[#0a0a1a]/50">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tr('Type a message...', 'မက်ဆေ့ရိုက်ပါ...')}
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-colors max-h-24"
                disabled={isLoading}
                style={{
                  height: 'auto',
                  minHeight: '40px',
                  maxHeight: '96px',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="p-2.5 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-4. h-4.5 animate-spin" />
                ) : (
                  <Send className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-white/20 text-center mt-1.5">
              {tr('Powered by AI • Responses may not always be accurate', 'AI ဖြင့်မောင်းနှင်သည် • အဖြေများ မှန်ကန်မှုမရှိနိုင်ပါ')}
            </p>
          </div>
        </div>
      )}

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
        @keyframes slide-in-from-bottom-4 {
          from {
            transform: translateY(16px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-in.slide-in-from-bottom-4 {
          animation: slide-in-from-bottom-4 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
