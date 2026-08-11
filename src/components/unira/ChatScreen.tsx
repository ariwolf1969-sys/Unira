'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { quickMessages } from '@/lib/places';
import { generateId } from '@/lib/utils';
import { ArrowLeft, Send, MessageCircle, CheckCheck } from 'lucide-react';

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

// ─── Sample Messages ─────────────────────────────────────────────────────────

const sampleMessages = [
  { senderId: 'driver', text: 'Hola, soy Marcelo. Estoy en camino a tu ubicación.', delay: 0 },
  { senderId: 'user', text: 'Perfecto, estoy en la puerta del edificio.', delay: 0 },
  { senderId: 'driver', text: 'Voy a tardar unos 5 minutos. ¿Todo bien?', delay: 0 },
  { senderId: 'user', text: 'Sí, tranquilo. Te espero acá.', delay: 0 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatScreen() {
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    goBack,
    showToast,
  } = useAppStore();

  const [inputText, setInputText] = useState('');
  const [driverOnline, setDriverOnline] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Pre-populate sample messages on first render
  useEffect(() => {
    if (!initializedRef.current && chatMessages.length === 0) {
      initializedRef.current = true;

      const now = Date.now();
      sampleMessages.forEach((msg, idx) => {
        const t = setTimeout(() => {
          addChatMessage({
            id: generateId(),
            senderId: msg.senderId,
            text: msg.text,
            timestamp: new Date(now - (sampleMessages.length - idx) * 60000),
            type: 'text',
          });
        }, idx * 80);
        timeoutsRef.current.push(t);
      });
    }

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length, scrollToBottom]);

  // Send message handler
  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;

    addChatMessage({
      id: generateId(),
      senderId: 'user',
      text: inputText.trim(),
      timestamp: new Date(),
      type: 'text',
    });

    setInputText('');

    // Simulate driver reply after 2 seconds
    const replyTimeout = setTimeout(() => {
      const randomReply = quickMessages[Math.floor(Math.random() * quickMessages.length)];
      addChatMessage({
        id: generateId(),
        senderId: 'driver',
        text: randomReply,
        timestamp: new Date(),
        type: 'quick',
      });
    }, 2000);

    timeoutsRef.current.push(replyTimeout);
  }, [inputText, addChatMessage]);

  // Send quick message
  const handleQuickMessage = useCallback((msg: string) => {
    addChatMessage({
      id: generateId(),
      senderId: 'user',
      text: msg,
      timestamp: new Date(),
      type: 'quick',
    });

    // Simulate driver reply after 2 seconds
    const replyTimeout = setTimeout(() => {
      const randomReply = quickMessages[Math.floor(Math.random() * quickMessages.length)];
      addChatMessage({
        id: generateId(),
        senderId: 'driver',
        text: randomReply,
        timestamp: new Date(),
        type: 'quick',
      });
    }, 2000);

    timeoutsRef.current.push(replyTimeout);
  }, [addChatMessage]);

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleClearChat = () => {
    clearChat();
    initializedRef.current = false;
    showToast('Chat limpiado', 'info');
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white px-4 pt-12 pb-3 shadow-[0_1px_8px_rgba(0,0,0,0.06)] flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          <div className="flex-1 flex items-center gap-3 min-w-0">
            {/* Driver avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0EA5A0] to-[#0B8A86] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">MG</span>
            </div>

            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 truncate">
                Chat con conductor
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${driverOnline ? 'bg-emerald-400' : 'bg-gray-300'}`}
                />
                <span className={`text-xs font-medium ${driverOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                  Marcelo Gómez · En línea
                </span>
              </div>
            </div>
          </div>

          {/* Clear chat button */}
          {chatMessages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
              aria-label="Limpiar chat"
            >
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Chat Messages Area ────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#0EA5A0]/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-[#0EA5A0]" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Sin mensajes aún
            </h3>
            <p className="text-sm text-gray-500 max-w-[220px]">
              Enviale un mensaje al conductor o usá los mensajes rápidos
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isUser = msg.senderId === 'user';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isUser
                      ? 'bg-[#0EA5A0] text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${isUser ? 'text-white/70' : 'text-gray-400'}`}>
                      {formatTime(msg.timestamp)}
                    </span>
                    {isUser && (
                      <CheckCheck className="w-3 h-3 text-white/70" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </motion.div>

      {/* ── Quick Messages Bar ────────────────────────────────────────────── */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {quickMessages.map((msg) => (
            <button
              key={msg}
              onClick={() => handleQuickMessage(msg)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full bg-white border border-[#0EA5A0]/20 text-[#0EA5A0] text-xs font-medium hover:bg-[#0EA5A0]/5 active:scale-95 transition-all shadow-sm"
            >
              {msg}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escribí un mensaje..."
            className="flex-1 bg-[#F5F7FA] rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5A0]/30 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              inputText.trim()
                ? 'bg-[#0EA5A0] text-white shadow-md shadow-[#0EA5A0]/25'
                : 'bg-gray-100 text-gray-400'
            }`}
            aria-label="Enviar mensaje"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
