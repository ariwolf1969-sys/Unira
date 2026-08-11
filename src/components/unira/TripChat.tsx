'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { MessageSquare, X, Send } from 'lucide-react';

interface TripChatProps {
  tripId: string | null;
  otherUserId: string | null;
  otherUserName: string;
  visible: boolean;
}

export function TripChat({ tripId, otherUserId, otherUserName, visible }: TripChatProps) {
  const { user } = useAppStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ id: string; fromUserId: string; text: string; createdAt: string }[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef<string>('');

  const fetchMessages = useCallback(async () => {
    if (!tripId || !user?.uid) return;
    try {
      const since = lastFetchRef.current ? `&since=${encodeURIComponent(lastFetchRef.current)}` : '';
      const res = await fetch(`/api/trips/${tripId}/messages?userId=${user.uid}${since}`);
      if (res.ok) {
        const data = await res.json();
        const newMsgs = data.messages || [];
        if (newMsgs.length > 0) {
          // Count new unread messages from the other user
          const newUnread = newMsgs.filter(
            (m: { fromUserId: string; read?: boolean }) => m.fromUserId !== user.uid
          ).length;
          if (!open) setUnread(prev => prev + newUnread);
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const unique = newMsgs.filter((m: { id: string }) => !ids.has(m.id));
            return [...prev, ...unique];
          });
          lastFetchRef.current = newMsgs[newMsgs.length - 1].createdAt;
        }
      }
    } catch { /* ignore */ }
  }, [tripId, user?.uid, open]);

  // Poll for new messages every 3s when visible
  useEffect(() => {
    if (!visible || !tripId) return;
    fetchMessages(); // Initial fetch
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visible, tripId, fetchMessages]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Reset when trip changes
  useEffect(() => {
    setMessages([]);
    setUnread(0);
    setInput('');
    setOpen(false);
    lastFetchRef.current = '';
  }, [tripId]);

  const sendMessage = async () => {
    if (!input.trim() || !tripId || !user?.uid) return;
    const text = input.trim();
    setInput('');
    try {
      await fetch(`/api/trips/${tripId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId: user.uid, text }),
      });
      // Optimistically add message
      setMessages(prev => [...prev, {
        id: 'temp-' + Date.now(),
        fromUserId: user.uid,
        text,
        createdAt: new Date().toISOString(),
      }]);
    } catch { /* ignore */ }
  };

  if (!visible || !tripId) return null;

  const isMe = (fromUserId: string) => fromUserId === user?.uid;

  return (
    <>
      {/* Floating chat button */}
      {!open && (
        <button
          data-trip-chat-fab
          onClick={() => { setOpen(true); setUnread(0); fetchMessages(); }}
          className="fixed bottom-24 right-4 z-[1000] w-14 h-14 rounded-full bg-[#0EA5A0] text-white shadow-lg shadow-[#0EA5A0]/30 flex items-center justify-center active:scale-90 transition-transform"
        >
          <MessageSquare className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[1000] bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Chat del viaje</h3>
              <p className="text-xs text-gray-500">{otherUserName}</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[150px]">
            {messages.length === 0 && (
              <p className="text-center text-gray-400 text-xs py-8">Aun no hay mensajes. Escribi algo para coordinar con {otherUserName.split(' ')[0]}.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${isMe(msg.fromUserId) ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMe(msg.fromUserId)
                    ? 'bg-[#0EA5A0] text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}>
                  <p>{msg.text}</p>
                  <p className={`text-[10px] mt-0.5 ${isMe(msg.fromUserId) ? 'text-white/60' : 'text-gray-400'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
              placeholder="Escribi un mensaje..."
              className="flex-1 h-10 px-4 rounded-full bg-gray-100 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#0EA5A0]/30"
              maxLength={500}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-10 h-10 rounded-full bg-[#0EA5A0] text-white flex items-center justify-center disabled:opacity-40 active:scale-90 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
