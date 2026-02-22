'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  Loader2,
  User,
  Server,
  Terminal,
  Trash2,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';
import toast from 'react-hot-toast';

// ==========================================
// Admin AI Control Panel
// Server management + AI assistant
// ==========================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AiCommand {
  action: string;
  target: string;
  params: Record<string, unknown>;
}

interface CommandResult {
  action: string;
  success: boolean;
  result?: string;
}

function generateSessionId(): string {
  return `admin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function AdminAiPage() {
  const { tr } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoExecute, setAutoExecute] = useState(false);
  const [pendingCommands, setPendingCommands] = useState<AiCommand[]>([]);
  const [commandResults, setCommandResults] = useState<CommandResult[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('admin-ai-session');
    if (stored) {
      setSessionId(stored);
    } else {
      const newId = generateSessionId();
      sessionStorage.setItem('admin-ai-session', newId);
      setSessionId(newId);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setPendingCommands([]);
    setCommandResults([]);

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch('/api/admin/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          stream: true,
          executeCommands: autoExecute,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to send message');
      }

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
              // Skip
            }
          }
        }

        // Parse commands from the streamed response
        const commands = parseAiCommands(streamedContent);
        if (commands.length > 0) {
          setPendingCommands(commands);
        }
      } else {
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

          if (data.data.commands) {
            setPendingCommands(data.data.commands);
          }
          if (data.data.commandResults) {
            setCommandResults(data.data.commandResults);
          }
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
              'Error communicating with AI assistant.',
              'AI အကူအညီနှင့် ဆက်သွယ်ရာတွင် အမှားရှိပါသည်။'
            ),
          };
        }
        return updated;
      });
      console.error('[Admin AI] Error:', error);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [input, isLoading, sessionId, autoExecute, tr]);

  const executeCommand = async (cmd: AiCommand) => {
    try {
      const res = await fetch('/api/admin/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Execute: ${cmd.action} on ${cmd.target}`,
          sessionId,
          executeCommands: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.data.commandResults) {
        setCommandResults((prev) => [...prev, ...data.data.commandResults]);
        for (const result of data.data.commandResults) {
          if (result.success) {
            toast.success(`✅ ${result.result}`);
          } else {
            toast.error(`❌ ${result.result}`);
          }
        }
      }
    } catch {
      toast.error('Failed to execute command');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPendingCommands([]);
    setCommandResults([]);
    const newId = generateSessionId();
    sessionStorage.setItem('admin-ai-session', newId);
    setSessionId(newId);
  };

  const parseAiCommands = (content: string): AiCommand[] => {
    const commands: AiCommand[] = [];
    const regex = /```ai-command\s*\n([\s\S]*?)\n```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.action && parsed.target) {
          commands.push({
            action: parsed.action,
            target: parsed.target,
            params: parsed.params || {},
          });
        }
      } catch { /* skip */ }
    }
    return commands;
  };

  const quickCommands = [
    { label: tr('Server Status', 'ဆာဗာ အခြေအနေ'), message: 'Show me all server statuses' },
    { label: tr('Analytics', 'ခွဲခြမ်းစိတ်ဖြာ'), message: 'Give me a summary of today\'s analytics' },
    { label: tr('Pending Orders', 'ဆိုင်းငံ့ အော်ဒါ'), message: 'How many pending orders are there?' },
  ];

  // Format message content - highlight command blocks
  const formatContent = (content: string) => {
    const parts = content.split(/(```ai-command[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```ai-command')) {
        return (
          <div key={idx} className="my-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-1.5 mb-1 text-yellow-400">
              <Terminal className="w-3.5 h-3.5" />
              <span className="font-semibold">Command Block</span>
            </div>
            <pre className="text-yellow-200/80 overflow-x-auto">{part.replace(/```ai-command\s*\n?/, '').replace(/\n?```$/, '')}</pre>
          </div>
        );
      }
      return <span key={idx} className="whitespace-pre-wrap break-words">{part}</span>;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            {tr('AI Control Panel', 'AI ထိန်းချုပ်ရေး')}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {tr(
              'Manage servers and get insights using AI assistant',
              'AI အကူအညီဖြင့် ဆာဗာများထိန်းချုပ်ပြီး အချက်အလက်များရယူပါ'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-Execute Toggle */}
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={autoExecute}
              onChange={(e) => setAutoExecute(e.target.checked)}
              className="w-4 h-4 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500/50"
            />
            {tr('Auto-execute commands', 'Command များ အလိုအလျောက် လုပ်ဆောင်မည်')}
          </label>

          <button
            onClick={clearChat}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            {tr('Clear', 'ရှင်းမည်')}
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      {autoExecute && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {tr(
            'Auto-execute is ON. AI commands will be executed automatically.',
            'အလိုအလျောက်လုပ်ဆောင်ခြင်း ဖွင့်ထားသည်။ AI command များ အလိုအလျောက် လုပ်ဆောင်ပါမည်။'
          )}
        </div>
      )}

      {/* Main Chat Area */}
      <div className="bg-white/5 border border-purple-500/15 rounded-xl overflow-hidden">
        {/* Messages */}
        <div className="h-[500px] overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
          {/* Welcome */}
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0 flex items-center justify-center">
                  <Bot className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                  <p className="text-sm text-white/90 leading-relaxed">
                    {tr(
                      "Hello Admin! 🛡️ I'm your AI assistant for server management. I can check server status, enable/disable servers, show analytics, and more. What would you like to do?",
                      'မင်္ဂလာပါ Admin! 🛡️ ကျွန်တော်က ဆာဗာ ထိန်းချုပ်ရေး AI အကူအညီပါ။ ဆာဗာ အခြေအနေ စစ်ဆေးခြင်း၊ ဆာဗာ ဖွင့်/ပိတ်ခြင်း၊ ခွဲခြမ်းစိတ်ဖြာခြင်းတွေ လုပ်ပေးနိုင်ပါတယ်။'
                    )}
                  </p>
                </div>
              </div>

              {/* Quick Commands */}
              <div className="flex flex-wrap gap-2 ml-11">
                {quickCommands.map((qc) => (
                  <button
                    key={qc.label}
                    onClick={() => {
                      setInput(qc.message);
                      setTimeout(() => sendMessage(), 100);
                    }}
                    className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 text-purple-300 rounded-lg text-sm transition-colors flex items-center gap-1.5"
                  >
                    <Server className="w-3.5 h-3.5" />
                    {qc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message List */}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
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

              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-500/20 border border-blue-500/30 text-white rounded-tr-md'
                    : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-md'
                }`}
              >
                {msg.content ? (
                  <div>{formatContent(msg.content)}</div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span className="text-xs text-white/50">
                      {tr('Analyzing...', 'ခွဲခြမ်းစိတ်ဖြာနေသည်...')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Pending Commands */}
        {pendingCommands.length > 0 && !autoExecute && (
          <div className="px-5 py-3 border-t border-purple-500/15 bg-yellow-500/5">
            <p className="text-xs text-yellow-400 mb-2 font-medium">
              {tr('Pending Commands:', 'ဆိုင်းငံ့ Command များ:')}
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => executeCommand(cmd)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-yellow-300 rounded-lg text-xs transition-colors"
                >
                  <Play className="w-3 h-3" />
                  {cmd.action}: {cmd.target}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Command Results */}
        {commandResults.length > 0 && (
          <div className="px-5 py-3 border-t border-purple-500/15 bg-green-500/5">
            <p className="text-xs text-green-400 mb-2 font-medium">
              {tr('Command Results:', 'Command ရလဒ်များ:')}
            </p>
            <div className="space-y-1">
              {commandResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`text-xs px-3 py-1.5 rounded ${
                    result.success
                      ? 'text-green-300 bg-green-500/10'
                      : 'text-red-300 bg-red-500/10'
                  }`}
                >
                  {result.success ? '✅' : '❌'} {result.result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-5 py-4 border-t border-purple-500/15 bg-[#0a0a1a]/30">
          <form
            id="admin-ai-form"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-end gap-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tr(
                'Ask about servers, analytics, or give commands...',
                'ဆာဗာ၊ ခွဲခြမ်းစိတ်ဖြာခြင်း သို့မဟုတ် command များ ရိုက်ပါ...'
              )}
              rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-colors max-h-28"
              disabled={isLoading}
              style={{ minHeight: '44px', maxHeight: '112px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 112)}px`;
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 flex items-center gap-2 text-sm font-medium"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {tr('Send', 'ပို့မည်')}
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 9999px;
        }
      `}</style>
    </div>
  );
}
