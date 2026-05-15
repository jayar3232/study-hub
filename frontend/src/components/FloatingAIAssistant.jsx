import React, { useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import aiFaceLogo from '../../aifacelogo.png';

const getAnswer = (input = '', user) => {
  const text = String(input || '').toLowerCase();
  const name = user?.name?.split(' ')?.[0] || 'there';

  if (!text.trim()) return `Hi ${name}. Ask me about Syncrova settings, marketplace access, messages, ranks, updates, or games.`;
  if (/market|sell|buy|verify|verification|id|cor/.test(text)) {
    if (user?.isDeveloper) return 'Your developer account can use Marketplace without student verification. Regular student accounts still need approved ID or COR before buy and sell actions.';
    return 'Marketplace buy and sell needs approved student verification. Open Marketplace, upload a clear ID or COR, then wait for developer review.';
  }
  if (/rank|season|highest|current/.test(text)) {
    return 'Game Hub rank is monthly. Current Rank can reset down at a new season, while Highest Rank is your lifetime best and only changes when you beat it.';
  }
  if (/dark|theme|blue|color|white/.test(text)) {
    return 'Theme controls are in Settings > App. Dark mode now uses neutral dark surfaces, while light mode stays white with readable contrast.';
  }
  if (/update|apk|download|version/.test(text)) {
    return 'Syncrova checks Android updates after opening the mobile app. When a newer build is available, the in-app update card shows download status and opens the installer after download.';
  }
  if (/knife|duel|game|fullscreen|full screen|aim/.test(text)) {
    return 'For games, use the Full Screen button for a wider view. Knife Duel now keeps the camera wider while aiming and applies HP changes at impact timing.';
  }
  if (/message|chat|developer|dev/.test(text)) {
    return 'Developer badges are shown from the actual message sender, so both sides of a chat can see when a sender is a developer.';
  }
  if (/profile|avatar|border|glow/.test(text)) {
    return 'Developer profile photos use a stronger blue supernova frame with animated sparks. Profile rank shows Current Rank and Highest Rank.';
  }

  return 'I can help with Syncrova app flows and account status. For private account changes, open Settings or the relevant page so the app can use your current signed-in state.';
};

export default function FloatingAIAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState(() => ([
    { role: 'assistant', text: 'Ask me about Syncrova settings, ranks, updates, marketplace, messages, or games.' }
  ]));
  const inputRef = useRef(null);

  const canSend = draft.trim() && !busy;

  if (!user) return null;

  const send = async (event) => {
    event?.preventDefault?.();
    const text = draft.trim();
    if (!text || busy) return;

    setDraft('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setBusy(true);
    try {
      const history = [...messages, { role: 'user', text }]
        .slice(-8)
        .map(item => ({ role: item.role, text: item.text }));
      const res = await api.post('/assistant/message', { message: text, history });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data?.answer || getAnswer(text, user) }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: getAnswer(text, user) }]);
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="syncrova-ai-assistant">
      {open && (
        <div className="syncrova-ai-panel">
          <div className="syncrova-ai-header">
            <span className="syncrova-ai-mark">
              <img src={aiFaceLogo} alt="" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black">Syncrova Assistant</span>
              <span className="block truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">Account-aware app help</span>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={17} />
            </button>
          </div>
          <div className="syncrova-ai-thread">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`syncrova-ai-message ${message.role}`}>
                {message.text}
              </div>
            ))}
            {busy && (
              <div className="syncrova-ai-message assistant inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Checking...
              </div>
            )}
          </div>
          <form onSubmit={send} className="syncrova-ai-composer">
            <input
              ref={inputRef}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder="Ask Syncrova..."
              autoComplete="off"
            />
            <button type="submit" disabled={!canSend} aria-label="Send assistant message">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className="syncrova-ai-fab developer-motion-zone"
        onClick={() => {
          setOpen(value => !value);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-label="Open Syncrova Assistant"
      >
        <img src={aiFaceLogo} alt="" />
      </button>
    </div>
  );
}
