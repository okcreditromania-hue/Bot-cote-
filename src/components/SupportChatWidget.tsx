import React, { useState, useEffect, useRef } from 'react';
import { X, Send, ShieldCheck, CheckCheck, Headphones } from 'lucide-react';
import { User } from '../types';

interface SupportChatWidgetProps {
  currentUser: User | null;
  hasBottomNav?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'client' | 'admin';
  text: string;
  timestamp: string;
  read: boolean;
}

export const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({
  currentUser,
  hasBottomNav = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userId = currentUser ? currentUser.id : 'guest_visitor';
  const userName = currentUser ? currentUser.fullName : 'Visiteur Client';
  const userPhone = currentUser ? currentUser.phone : '';
  const userCountry = currentUser ? currentUser.country : 'Bénin';

  const fetchMessages = async () => {
    try {
      const res = await fetch(
        `/api/support/messages/${userId}?userName=${encodeURIComponent(userName)}&userPhone=${encodeURIComponent(
          userPhone
        )}&userCountry=${encodeURIComponent(userCountry)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.conversation) {
          setMessages(data.conversation.messages || []);
          if (!isOpen) {
            setUnreadCount(data.conversation.unreadCountClient || 0);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchMessages();

    const sseUrl = `/api/events/stream?userId=${encodeURIComponent(userId)}&userPhone=${encodeURIComponent(
      userPhone
    )}&role=client`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('support:updated', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.conversation) {
          setMessages(payload.conversation.messages || []);
          if (!isOpen) {
            setUnreadCount(payload.conversation.unreadCountClient || 0);
          }
          return;
        }
      } catch {
        // fallback to fetch
      }
      fetchMessages();
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const interval = setInterval(fetchMessages, 3000);
    return () => {
      eventSource.close();
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [userId, isOpen, userName, userPhone, userCountry]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      fetch('/api/support/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: 'client' }),
      }).catch(() => {});
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsSending(true);

    const tempId = `temp_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender: 'client',
        text: messageText,
        timestamp: new Date().toISOString(),
        read: false,
      },
    ]);

    try {
      const res = await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName,
          userPhone,
          userCountry,
          text: messageText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.conversation) {
          setMessages(data.conversation.messages);
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating Support Trigger positioned cleanly inside mobile viewport */}
      <div
        className={`fixed z-40 transition-all ${
          hasBottomNav ? 'bottom-16 right-3' : 'bottom-4 right-3'
        }`}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center justify-center w-12 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg active:scale-95 transition-all cursor-pointer"
          aria-label="Service client"
        >
          <Headphones className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-rose-600 text-white font-mono font-black text-[10px] rounded-full flex items-center justify-center border-2 border-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Chat Drawer */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] h-[75vh] bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="text-xs font-bold">Service Client Aviator VIP</h3>
                <p className="text-[10px] text-slate-300 font-mono">Réponse directe</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Assistance officielle Mobile Money & VIP</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/60">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Posez votre question ci-dessous...
              </div>
            ) : (
              messages.map((msg) => {
                const isAdmin = msg.sender === 'admin';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        isAdmin
                          ? 'bg-white text-slate-800 border border-slate-200'
                          : 'bg-emerald-600 text-white font-medium'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {!isAdmin && (
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5 px-1">
                        <CheckCheck className="w-3 h-3 text-emerald-600" />
                        <span>Envoyé</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Votre message..."
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="min-w-[44px] min-h-[42px] bg-emerald-600 text-white rounded-xl flex items-center justify-center cursor-pointer disabled:bg-slate-300"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
