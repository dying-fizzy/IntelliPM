import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Loader2, RotateCcw, ChevronDown } from 'lucide-react';
import { AIBadge } from './AILabel';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

const WELCOME_MESSAGE = `Hi! I'm the IntelliPM Assistant 👋

I can help you with:
• Creating and managing projects
• Understanding roles and permissions
• Using AI Task Generation & Smart Assign
• Navigating the platform
• Sprint planning, risk assessment, and more

What would you like to know?`;

const AIChatDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: WELCOME_MESSAGE }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    const updatedMessages = [...messages, { role: 'user' as const, text: userMessage }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Send to backend — keeps the API key secure on the server
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          // Send last 10 messages as history for multi-turn context
          history: updatedMessages.slice(-10).map(m => ({ role: m.role, text: m.text }))
        }),
      });

      const data = await response.json();
      const aiText = data.reply || 'I could not generate a response. Please try again.';
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: 'Connection error. Please check that the backend server is running and try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([{ role: 'ai', text: WELCOME_MESSAGE }]);
    setInput('');
    inputRef.current?.focus();
  };

  // Render message text with basic formatting (bold **text**, newlines, bullet points)
  const renderText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold: **text**
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="font-black">{part}</strong> : part
          )}
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <>
      {/* ── Floating Trigger Button ── */}
      {!isOpen && (
        <div className="fixed bottom-8 right-8 z-50">
          <button
            id="ai-chat-trigger"
            onClick={() => setIsOpen(true)}
            title="IntelliPM AI Assistant"
            className="w-14 h-14 bg-[var(--accent)] text-black rounded-sm shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 animate-in fade-in zoom-in duration-300"
            style={{ boxShadow: '0 0 24px rgba(var(--accent-rgb), 0.4)' }}
          >
            <Sparkles size={22} />
          </button>

          {/* Tooltip — only shown when closed */}
          <div className="absolute bottom-[calc(100%+10px)] right-0 pointer-events-none bg-[var(--bg-card)] border border-[var(--border-color)] rounded-sm px-3 py-2 shadow-xl whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles size={9} className="text-[var(--accent)]" />
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--accent)]">AI Assistant</span>
            </div>
            <p className="text-[10px] mono opacity-60">Ask anything about IntelliPM</p>
          </div>
        </div>
      )}

      {/* ── Chat Drawer ── */}
      <div
        className={`fixed bottom-0 right-0 w-[400px] h-[560px] glass-panel-elevated !rounded-none !rounded-tl-xl border-l border-t border-white/10 z-40 flex flex-col transition-all duration-400 ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-white/[0.03] shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                loading ? 'bg-yellow-400 animate-ping' : 'bg-green-400 animate-pulse'
              }`}
            />
            <span className="font-black text-[12px] uppercase tracking-widest">IntelliPM Assistant</span>
            <AIBadge label="Gemini" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              title="Reset conversation"
              className="opacity-30 hover:opacity-100 transition-opacity p-1"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="opacity-30 hover:opacity-100 transition-opacity p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-sm text-[12px] mono leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/20 text-right'
                    : 'bg-white/4 border border-white/8'
                }`}
              >
                {/* Role label */}
                <div className={`text-[9px] font-black uppercase tracking-widest mb-1.5 opacity-40 ${
                  msg.role === 'user' ? 'text-right text-[var(--accent)]' : ''
                }`}>
                  {msg.role === 'user' ? 'You' : '⚡ IntelliPM AI'}
                </div>
                <div className="opacity-90 whitespace-pre-line">{renderText(msg.text)}</div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/4 border border-white/8 px-4 py-3 rounded-sm">
                <div className="text-[9px] font-black uppercase tracking-widest mb-1.5 opacity-40">⚡ IntelliPM AI</div>
                <div className="flex items-center gap-2 text-[12px] mono opacity-50">
                  <Loader2 size={12} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested questions — shown only on welcome state */}
        {messages.length === 1 && !loading && (
          <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
            {[
              'How do I create a project?',
              'What can a PM do?',
              'How does AI task generation work?',
            ].map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="text-[10px] mono px-3 py-1.5 border border-[var(--accent)]/20 rounded-sm hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/40 transition-all text-left opacity-70 hover:opacity-100"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/8 flex gap-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            id="ai-chat-input"
            placeholder="Ask about IntelliPM..."
            className="flex-1 glass-input px-4 py-2.5 text-[12px] mono rounded-sm"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            id="ai-chat-send"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-[var(--accent)] text-black px-3 py-2.5 rounded-sm disabled:opacity-40 transition-all hover:opacity-90 active:scale-95"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </>
  );
};

export default AIChatDrawer;
