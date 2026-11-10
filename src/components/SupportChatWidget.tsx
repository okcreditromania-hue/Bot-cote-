import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, ShieldCheck, Clock, CheckCheck, Sparkles, Headphones } from 'lucide-react';
import { User } from '../types';

interface SupportChatWidgetProps {
  currentUser: User | null;
}

interface ChatMessage {
  id: string;
  sender: 'client' | 'admin';
  text: string;
  timestamp: string;
  read: boolean;
}

export const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // User identifier
  const userId = currentUser ? currentUser.id : 'guest_visitor';
  const userName = currentUser ? currentUser.fullName : 'Visiteur Client';
  const userPhone = currentUser ? currentUser.phone : '';
  const userCountry = currentUser ? currentUser.country : 'Bénin';

  // Fetch messages from backend
  const fetchMessages = async () => {
    try {
      const res = await fetch(
        `/api/support/messages/${userId}?userName=${encodeURIComponent(userName)}&userPhone=${encodeURIComponent(userPhone)}&userCountry=${encodeURIComponent(userCountry)}`
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
    } catch (err) {
      console.warn('Erreur polling support:', err);
    }
  };

  // Poll for messages every 3.5 seconds
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);
    return () => clearInterval(interval);
  }, [userId, isOpen, userName, userPhone, userCountry]);

  // Mark as read when opening
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      fetch('/api/support/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: 'client' }),
      }).catch(console.warn);
    }
  }, [isOpen, userId]);

  // Scroll to bottom on new messages
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

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: 'client',
      text: messageText,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

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
    } catch (err) {
      console.error('Erreur envoi message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickQuestion = (q: string) => {
    setInputText(q);
  };

  return (
    <>
      {/* Floating Trigger Button with Notification Bubble */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-full shadow-xl shadow-emerald-950/20 active:scale-95 transition-all cursor-pointer font-bold text-xs"
          aria-label="Ouvrir le service client"
        >
          <Headphones className="w-5 h-5 text-white" />
          <span className="hidden sm:inline">Service Client</span>

          {/* Bulle de notification rouge avec compteur d'unread */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-rose-600 text-white font-mono font-black text-[11px] rounded-full flex items-center justify-center border-2 border-white shadow-md animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Live Chat Window (Day Mode: White, Emerald, Blue) */}
      {isOpen && (
        <div className="fixed bottom-22 right-4 sm:right-6 z-50 w-[92vw] sm:w-[380px] h-[520px] max-h-[80vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-blue-700 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                  <Headphones className="w-4 h-4 text-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-300 border-2 border-emerald-700" />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-tight">Service Client Spribe Aviator</h3>
                <p className="text-[10px] text-emerald-100 flex items-center gap-1 font-mono">
                  <span>En ligne 24/7 · Réponse instantanée</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info pill */}
          <div className="bg-slate-50 px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Assistance officielle Mobile Money & VIP
            </span>
            <span className="font-mono text-[10px] font-bold text-slate-400">SasPay Live</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Chargement de la conversation...
              </div>
            ) : (
              messages.map((msg) => {
                const isAdmin = msg.sender === 'admin';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-slate-500">
                        {isAdmin ? 'Conseiller Aviator VIP' : 'Vous'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed ${
                        isAdmin
                          ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                          : 'bg-emerald-600 text-white rounded-tr-xs font-medium'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {!isAdmin && (
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-0.5 px-1">
                        <CheckCheck className="w-3 h-3 text-emerald-600" />
                        <span>Transmis à l'administrateur</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[10px] whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 shrink-0 font-medium">Suggestions :</span>
            <button
              onClick={() => handleQuickQuestion('Comment valider mon paiement Mobile Money ?')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
            >
              Paiement Mobile Money
            </button>
            <button
              onClick={() => handleQuickQuestion('Les cotes 1.50x à 49.00x sont-elles bien 100% sûres ?')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
            >
              Cotes VIP 1 (1.50 à 49x)
            </button>
            <button
              onClick={() => handleQuickQuestion('Comment accéder au bot Telegram après paiement ?')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
            >
              Accès Bot
            </button>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Posez votre question au support..."
              className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
