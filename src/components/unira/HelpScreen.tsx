'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { timeAgo } from '@/lib/utils';
import {
  ArrowLeft,
  Send,
  Bot,
  User,
  Headphones,
  MessageCircle,
  Loader2,
  Sparkles,
  History,
  Send as SendIcon,
  ChevronRight,
  Mail,
  Phone,
  FileText,
  CheckCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

interface HelpTicket {
  id: string;
  subject: string;
  question: string;
  aiAnswer: string;
  escalatedToHuman: boolean;
  createdAt: string;
  resolvedAt?: string | null;
}

// ─── Suggested questions ─────────────────────────────────────────────────────

const SUGGESTED = [
  '¿Cómo pido un viaje?',
  'Perdí un objeto en mi último viaje',
  '¿Cómo recargo la billetera?',
  '¿Cómo me hago conductor?',
  '¿Cuánto cuesta un viaje?',
  'Hablar con un operador',
];

// ─── Contact Form Component ──────────────────────────────────────────────

function ContactForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(onSuccess, 2000);
      } else {
        const d = await res.json();
        alert(d.error || 'Error al enviar');
      }
    } catch { alert('Error de conexión'); }
    finally { setSending(false); }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
        <p className="text-sm font-semibold text-gray-900">Mensaje enviado</p>
        <p className="text-xs text-gray-500 mt-1">Te responderemos a la brevedad</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre *" required className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-300" />
      <div className="grid grid-cols-2 gap-2">
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-300" />
        <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="Teléfono" className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-300" />
      </div>
      <select value={subject} onChange={e => setSubject(e.target.value)} required className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-300 text-gray-700">
        <option value="">Seleccionar asunto *</option>
        <option value="consulta">Consulta general</option>
        <option value="queja">Queja o reclamo</option>
        <option value="objeto_perdido">Objeto perdido</option>
        <option value="conductor">Problema con conductor</option>
        <option value="pago">Problema de pago</option>
        <option value="socio">Quiero ser socio</option>
        <option value="otro">Otro</option>
      </select>
      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tu mensaje *" required minLength={10} rows={3} className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-300 resize-none" />
      <button type="submit" disabled={sending} className="w-full py-2.5 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        {sending ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </form>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HelpScreen() {
  const store = useAppStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [pastTickets, setPastTickets] = useState<HelpTicket[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initial greeting from bot
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content:
          '¡Hola! Soy el asistente virtual de TEYEVO. Preguntame lo que necesites sobre viajes, pagos, objetos perdidos o cómo usar la app. Si no puedo ayudarte, te derivo con un operador humano.',
        ts: new Date().toISOString(),
      },
    ]);
  }, []);

  // Fetch past tickets on mount
  const fetchTickets = useCallback(async () => {
    if (!store.user) return;
    try {
      const res = await fetch(`/api/help-tickets?userId=${store.user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setPastTickets(data.tickets || []);
      }
    } catch (err) {
      console.warn('[help] fetch tickets failed', err);
    }
  }, [store.user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // ─── Send message ──────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !store.user) return;

      const userMsg: ChatMsg = {
        role: 'user',
        content: trimmed,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        // Build history (last 6 messages, excluding greeting)
        const history = messages
          .slice(1)
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch('/api/help-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: store.user.uid,
            question: trimmed,
            history,
          }),
        });

        if (!res.ok) throw new Error('API error');
        const data = await res.json();

        const botMsg: ChatMsg = {
          role: 'assistant',
          content: data.answer,
          ts: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMsg]);

        if (data.escalated) {
          setEscalated(true);
        }
      } catch (err) {
        console.warn('[help] send failed', err);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Tuvimos un problema técnico. Intentá de nuevo en unos segundos, o tocá "Hablar con operador" para asistencia humana inmediata.',
            ts: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
        // Refetch tickets so the new one appears in history
        fetchTickets();
      }
    },
    [loading, messages, store.user, fetchTickets]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleEscalate = () => {
    sendMessage('Necesito hablar con un operador humano por favor');
  };

  const handleBack = () => {
    store.setCurrentScreen('profile');
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F5F7FA]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 bg-white shadow-sm sticky top-0 z-10">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Centro de ayuda</h1>
            <p className="text-[11px] text-gray-500 leading-tight">
              Asistente IA · Operario humano disponible
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowHistory(false); setShowContactForm(!showContactForm); }}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            showContactForm ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
          aria-label="Formulario"
          title="Formulario de contacto"
        >
          <FileText className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setShowContactForm(false); setShowHistory(!showHistory); }}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            showHistory ? 'bg-sky-100 text-sky-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
          aria-label="Historial"
          title="Mis consultas previas"
        >
          <History className="w-5 h-5" />
        </button>
      </div>

      {/* Escalation banner */}
      {escalated && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
          <Headphones className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-900">
              Tu consulta fue derivada a un operador humano
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Te contactaremos al {store.user?.phone || 'tu teléfono'} dentro del horario L-V 9-18h. Si es urgente, llamá al +54 9 11 5597-6414.
            </p>
          </div>
          <button
            onClick={() => setEscalated(false)}
            className="text-amber-400 hover:text-amber-600 text-xs font-bold"
          >
            OK
          </button>
        </div>
      )}

      {/* Contact form panel */}
      {showContactForm && (
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Formulario de contacto</h3>
            <button onClick={() => setShowContactForm(false)} className="text-[10px] text-gray-400 hover:text-gray-600">Cerrar</button>
          </div>
          <ContactForm onSuccess={() => setShowContactForm(false)} />
        </div>
      )}

      {/* History panel (collapsible) */}
      {showHistory && (
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-3 max-h-64 overflow-y-auto hide-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Consultas previas</h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-[10px] text-gray-400 hover:text-gray-600"
            >
              Cerrar
            </button>
          </div>
          {pastTickets.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              Aún no tenés consultas previas.
            </p>
          ) : (
            <div className="space-y-2">
              {pastTickets.map((t) => (
                <div key={t.id} className="bg-gray-50 rounded-xl p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-700 line-clamp-1 flex-1">
                      {t.subject}
                    </p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {timeAgo(t.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">{t.aiAnswer}</p>
                  {t.escalatedToHuman && (
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Derivada a operador
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 space-y-3"
      >
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} />
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm px-3 py-2.5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin" />
              <span className="text-xs text-gray-500">Pensando...</span>
            </div>
          </div>
        )}

        {/* Suggested questions (only shown when conversation is just the greeting) */}
        {messages.length === 1 && !loading && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Preguntas frecuentes</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left bg-white rounded-xl px-3 py-2.5 text-xs text-gray-700 hover:bg-sky-50 hover:text-sky-700 transition-colors flex items-center justify-between gap-2 shadow-sm"
                >
                  <span>{q}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-gray-50 rounded-2xl px-3 py-2 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu consulta..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none resize-none max-h-24 leading-relaxed"
              disabled={loading}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-full bg-[#0EA5A0] text-white flex items-center justify-center hover:bg-[#0C8F8A] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={handleEscalate}
            disabled={loading}
            className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 disabled:opacity-40"
          >
            <Headphones className="w-3.5 h-3.5" />
            Hablar con operador
          </button>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            L-V 9-18h
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-gradient-to-br from-[#0EA5A0] to-[#0C8F8A]'
            : 'bg-gradient-to-br from-sky-400 to-sky-600'
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-white" />
        )}
      </div>
      <div
        className={`max-w-[78%] rounded-2xl shadow-sm px-3 py-2.5 ${
          isUser
            ? 'bg-[#0EA5A0] text-white rounded-tr-sm'
            : 'bg-white text-gray-800 rounded-tl-sm'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        <p
          className={`text-[10px] mt-1 ${
            isUser ? 'text-white/60' : 'text-gray-400'
          }`}
        >
          {new Date(msg.ts).toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
