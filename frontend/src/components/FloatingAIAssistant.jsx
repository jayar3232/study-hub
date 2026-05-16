import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import aiFaceLogo from '../../aifacelogo.png';

const ASSISTANT_POSITION_KEY = 'syncrova-ai-assistant-position';
const ASSISTANT_FAB_SIZE = 58;
const ASSISTANT_EDGE_GAP = 12;

const isMobileViewport = () => (
  typeof window !== 'undefined'
  && window.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches
);

const clampPosition = (position = {}) => {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  const maxX = Math.max(ASSISTANT_EDGE_GAP, window.innerWidth - ASSISTANT_FAB_SIZE - ASSISTANT_EDGE_GAP);
  const bottomReserve = isMobileViewport() ? 92 : ASSISTANT_EDGE_GAP;
  const maxY = Math.max(ASSISTANT_EDGE_GAP, window.innerHeight - ASSISTANT_FAB_SIZE - bottomReserve);
  return {
    x: Math.min(maxX, Math.max(ASSISTANT_EDGE_GAP, Number(position.x) || ASSISTANT_EDGE_GAP)),
    y: Math.min(maxY, Math.max(ASSISTANT_EDGE_GAP, Number(position.y) || ASSISTANT_EDGE_GAP))
  };
};

const getDefaultPosition = () => {
  if (typeof window === 'undefined') return { x: ASSISTANT_EDGE_GAP, y: ASSISTANT_EDGE_GAP };
  return clampPosition({
    x: window.innerWidth - ASSISTANT_FAB_SIZE - ASSISTANT_EDGE_GAP,
    y: window.innerHeight - ASSISTANT_FAB_SIZE - (isMobileViewport() ? 104 : 18)
  });
};

const getStoredPosition = () => {
  if (typeof window === 'undefined') return getDefaultPosition();
  try {
    const stored = JSON.parse(localStorage.getItem(ASSISTANT_POSITION_KEY) || 'null');
    if (stored && Number.isFinite(Number(stored.x)) && Number.isFinite(Number(stored.y))) {
      return clampPosition(stored);
    }
  } catch {
    // Ignore bad persisted coordinates.
  }
  return getDefaultPosition();
};

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
  const [position, setPosition] = useState(getStoredPosition);
  const [messages, setMessages] = useState(() => ([
    { role: 'assistant', text: 'Ask me anything about Syncrova, your account, app setup, calls, uploads, or APK updates.' }
  ]));
  const inputRef = useRef(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0, suppressClick: false });

  const canSend = draft.trim() && !busy;
  const panelSide = useMemo(() => {
    if (typeof window === 'undefined') return 'left';
    return position.x > window.innerWidth / 2 ? 'left' : 'right';
  }, [position.x]);
  const panelVertical = useMemo(() => {
    if (typeof window === 'undefined') return 'top';
    return position.y > window.innerHeight / 2 ? 'top' : 'bottom';
  }, [position.y]);
  const panelStyle = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const panelWidth = Math.min(352, Math.max(280, window.innerWidth - 24));
    const panelHeight = Math.min(544, Math.max(320, window.innerHeight - 96));
    const maxLeft = Math.max(ASSISTANT_EDGE_GAP, window.innerWidth - panelWidth - ASSISTANT_EDGE_GAP);
    const centeredLeft = position.x + (ASSISTANT_FAB_SIZE / 2) - (panelWidth / 2);
    const left = Math.min(maxLeft, Math.max(ASSISTANT_EDGE_GAP, centeredLeft));
    const opensAbove = position.y > window.innerHeight / 2;
    const top = opensAbove
      ? Math.max(ASSISTANT_EDGE_GAP, position.y - panelHeight - ASSISTANT_EDGE_GAP)
      : Math.min(
          Math.max(ASSISTANT_EDGE_GAP, window.innerHeight - panelHeight - ASSISTANT_EDGE_GAP),
          position.y + ASSISTANT_FAB_SIZE + ASSISTANT_EDGE_GAP
        );

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      right: 'auto',
      bottom: 'auto',
      width: `min(22rem, calc(100vw - ${ASSISTANT_EDGE_GAP * 2}px))`,
      maxHeight: `min(34rem, calc(100svh - ${ASSISTANT_EDGE_GAP * 2}px))`
    };
  }, [position.x, position.y]);

  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const next = clampPosition(prev);
        localStorage.setItem(ASSISTANT_POSITION_KEY, JSON.stringify(next));
        return next;
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const savePosition = (nextPosition) => {
    try {
      localStorage.setItem(ASSISTANT_POSITION_KEY, JSON.stringify(nextPosition));
    } catch {
      // Position persistence is optional.
    }
  };

  const moveAssistant = useCallback((clientX, clientY) => {
    const drag = dragRef.current;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;

    setPosition(() => clampPosition({
      x: drag.originX + dx,
      y: drag.originY + dy
    }));
  }, []);

  const stopDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;

    setPosition(prev => {
      const next = clampPosition(prev);
      savePosition(next);
      return next;
    });

    if (drag.moved) {
      drag.suppressClick = true;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      window.setTimeout(() => {
        dragRef.current.suppressClick = false;
      }, 0);
    }
  }, []);

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      suppressClick: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

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
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: res.data?.answer || getAnswer(text, user),
        source: res.data?.source || 'syncrova'
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: getAnswer(text, user), source: 'offline' }]);
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  if (!user) return null;

  return (
    <div
      className={`syncrova-ai-assistant is-${panelSide} is-${panelVertical}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {open && (
        <div className="syncrova-ai-panel" style={panelStyle}>
          <div className="syncrova-ai-header">
            <span className="syncrova-ai-mark">
              <img src={aiFaceLogo} alt="" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black">Syncrova Assistant</span>
              <span className="block truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">Live app assistant</span>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={17} />
            </button>
          </div>
          <div className="syncrova-ai-thread">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`syncrova-ai-message ${message.role}`}>
                {message.text}
                {message.role === 'assistant' && message.source && message.source !== 'openai' && (
                  <span className="syncrova-ai-source">{message.source === 'offline' ? 'offline fallback' : 'syncrova fallback'}</span>
                )}
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
        onPointerDown={startDrag}
        onPointerMove={(event) => {
          if (dragRef.current.active) moveAssistant(event.clientX, event.clientY);
        }}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClick={(event) => {
          if (dragRef.current.suppressClick) {
            event.preventDefault();
            return;
          }
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
