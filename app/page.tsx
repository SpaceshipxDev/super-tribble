// -----------------------------------------------------------------------------
// FILE: app/page.tsx (Version 3 - Ultra-Minimalist & Mobile-First)
//
// This version embodies the "Steve Jobs" philosophy of elegant simplicity.
// It is designed mobile-first with a pitch-black interface, and all
// non-essential UI elements have been removed as requested. The sidebar is
// hidden by default on mobile and slides in, providing a clean, focused
// chat experience. The layout gracefully adapts for larger screens.
// -----------------------------------------------------------------------------

'use client';

import { useState, useRef, useEffect, FormEvent, SVGProps } from 'react';
import type { NextPage } from 'next';
import {
  Plus, ArrowUp, Menu, X,
  Copy, ThumbsUp, ThumbsDown, RefreshCw, Info, BarChart3
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

// --- TYPE DEFINITIONS ---
type UiMessage = {
  id?: string;
  text: string;
  sender: 'user' | 'ai';
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
};

// --- CUSTOM SVG LOGO ---
const CustomLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="28" height="28" rx="6" fill="white"/>
    <path d="M19.3493 9.38281C19.3493 8.35156 19.0963 7.51562 18.5893 6.875C18.0823 6.23438 17.2213 5.91406 16.0063 5.91406C14.7343 5.91406 13.8033 6.25781 13.2123 6.94531C12.6213 7.63281 12.3263 8.53906 12.3263 9.66406V10.4219H14.5063V9.57031C14.5063 8.82812 14.7003 8.28125 15.0883 7.92969C15.4763 7.57812 15.9613 7.40234 16.5423 7.40234C17.1803 7.40234 17.6533 7.58594 17.9623 7.95312C18.2713 8.32031 18.4263 8.80469 18.4263 9.40625V18.5938H16.2463V17.0312C15.8203 17.5156 15.2843 17.8945 14.6383 18.168C13.9923 18.4414 13.2993 18.5781 12.5593 18.5781C11.3623 18.5781 10.4283 18.2891 9.75635 17.7109C9.08435 17.1328 8.74835 16.2188 8.74835 14.9688V9.38281H10.9283V14.8984C10.9283 15.75 11.1223 16.375 11.5103 16.7734C11.8983 17.1719 12.4283 17.3711 13.1003 17.3711C14.1683 17.3711 14.9083 16.8906 15.3203 15.9375V9.38281H19.3493Z" fill="black"/>
  </svg>
);

// --- MAIN PAGE COMPONENT ---
const ChatPage: NextPage = () => {
  // --- STATE MANAGEMENT ---
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [memoConvoId, setMemoConvoId] = useState<string | null>(null);
  const [memoContent, setMemoContent] = useState('');
  const [memoLoading, setMemoLoading] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  
  const hasStartedChat = messages.length > 0;

  // --- EFFECTS ---
  useEffect(() => {
    chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
  }, [messages, isLoading]);

  // Load conversations on mount and select the latest (no auto-create)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/conversations', { cache: 'no-store' });
        const data = await res.json();
        const items: Conversation[] = data.conversations || [];
        setConversations(items);
        if (items.length > 0) {
          setActiveConvoId(items[0].id);
          await loadMessages(items[0].id);
        }
      } catch (e) {
        console.error('Failed to load conversations', e);
      }
    })();
  }, []);

  // Load current user for sidebar/avatar
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setUser(String(data.user || ''));
        }
      } catch {}
    })();
  }, []);

  async function loadMessages(conversationId: string) {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, { cache: 'no-store' });
      const data = await res.json();
      const uiMsgs: UiMessage[] = (data.messages || []).map((m: any) => ({
        id: m.id,
        text: m.content,
        sender: m.role === 'model' ? 'ai' : 'user',
      }));
      setMessages(uiMsgs);
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  }

  // --- HANDLERS ---
  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;

    const userMessage: UiMessage = { text: content, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConvoId, message: content }),
      });
      if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
      let data: any = await res.json();
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object') data = parsed;
        } catch {
          // server returned plain text; treat it as the model text
          data = { text: data };
        }
      }

      const headerId = (data?.conversationId as string | undefined) || res.headers.get('X-Conversation-Id') || undefined;
      if (headerId && headerId !== activeConvoId) setActiveConvoId(headerId);

      // Robustly coerce to the model's text even if the server accidentally
      // returned a JSON string or concatenated multiple JSON payloads.
      const aiText = coerceModelText(data);
      setMessages(prev => [...prev, { text: aiText, sender: 'ai' }]);
    } catch (err) {
      console.error('Chat error', err);
    } finally {
      setIsLoading(false);
      try {
        const listRes = await fetch('/api/conversations', { cache: 'no-store' });
        const data = await listRes.json();
        setConversations(data.conversations || []);
      } catch {}
    }
  };

  const startNewChat = async () => {
    try {
      // Generate memo for the previous conversation in the background
      const prevId = activeConvoId;
      if (prevId && messages.length > 0) {
        // Fire-and-forget; avoid blocking UI
        void fetch(`/api/conversations/${prevId}/memo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
      }
      // Do not create a new conversation until the first user message is sent
      setActiveConvoId(null);
      setMessages([]);
    } finally {
      setIsSidebarOpen(false);
    }
  }

  async function openMemoFor(conversationId: string) {
    setIsMemoOpen(true);
    setMemoConvoId(conversationId);
    setMemoContent('');
    setMemoLoading(true);
    try {
      // Try to load existing memo
      let res = await fetch(`/api/conversations/${conversationId}/memo`, { cache: 'no-store' });
      let data = await res.json();
      let content: string | null = data?.memo?.content || null;
      if (!content) {
        // Generate on demand
        res = await fetch(`/api/conversations/${conversationId}/memo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        data = await res.json();
        content = data?.memo?.content || null;
      }
      setMemoContent(content || '（暂无摘要）');
    } catch (e) {
      console.error('Failed to load memo', e);
      setMemoContent('（加载摘要失败）');
    } finally {
      setMemoLoading(false);
    }
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-black md:bg-[#212121] text-zinc-300 font-sans">
      
      {/* --- SIDEBAR (Mobile Hidden, Desktop Visible) --- */}
      <aside className={`absolute z-20 h-full w-[260px] bg-black md:bg-[#171717] flex flex-col p-2 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-2 mb-2">
          <div className="flex items-center gap-2">
            <CustomLogo />
            <h1 className="text-sm font-semibold text-white">Eldaline</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-zinc-400 hover:text-white md:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Top bar action: Metrics */}
        {user === 'admin' && (
          <>
            <Link
              href="/admin"
              className="w-full flex items-center gap-3 p-2 mb-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={18} />
              <span>管理</span>
            </Link>
            <Link
              href="/metrics"
              className="w-full flex items-center gap-3 p-2 mb-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              onClick={() => setIsSidebarOpen(false)}
            >
              <BarChart3 size={18} />
              <span>数据</span>
            </Link>
          </>
        )}

        <button onClick={startNewChat} className="w-full flex items-center gap-3 p-2 rounded-lg text-sm font-medium bg-zinc-800 text-white hover:bg-zinc-700">
          <Plus size={18} />
          <span>新对话</span>
        </button>
        
        <div className="flex-grow overflow-y-auto mt-4 space-y-2 pt-4 border-t border-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-500 px-2 mb-2 uppercase tracking-wider">对话</h2>
          {conversations.map((c) => (
            <ChatHistoryItem
              key={c.id}
              text={c.title || '新对话'}
              isActive={c.id === activeConvoId}
              onClick={async () => {
                setActiveConvoId(c.id);
                await loadMessages(c.id);
                setIsSidebarOpen(false);
              }}
              onInfoClick={() => openMemoFor(c.id)}
            />
          ))}
        </div>

        <div className="flex-shrink-0 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between p-2 rounded-lg">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center mr-3 flex-shrink-0">
                <span className="text-zinc-200 font-bold text-sm">{(user || '?').slice(0,1).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{user || '未登录'}</p>
                <p className="text-xs text-zinc-500">Eldaline</p>
              </div>
            </div>
            <button
              onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}; window.location.href = '/login'; }}
              className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
            >退出登录</button>
          </div>
        </div>
      </aside>
      
      {/* --- OVERLAY for closing sidebar on mobile --- */}
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-10 md:hidden" />}

      {/* --- MAIN CHAT AREA --- */}
      <main className="flex-1 flex flex-col w-full md:w-auto">
        {!hasStartedChat ? (
          // --- SPLASH SCREEN ---
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-[env(safe-area-inset-top)]">
            <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 p-2 text-zinc-400 hover:text-white md:hidden">
                <Menu size={20} />
            </button>
            <h1 className="text-5xl font-normal text-zinc-500">Eldaline</h1>
          </div>
        ) : (
          // --- ACTIVE CHAT VIEW ---
          <>
            <header className="flex items-center justify-center p-3.5 pt-[env(safe-area-inset-top)] border-b border-zinc-800 relative">
              <button onClick={() => setIsSidebarOpen(true)} className="absolute left-4 p-2 text-zinc-400 hover:text-white md:hidden">
                  <Menu size={20} />
              </button>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">{conversations.find(c => c.id === activeConvoId)?.title || '新对话'}</h2>
                {activeConvoId && (
                  <button
                    title="聊天备忘录"
                    onClick={() => openMemoFor(activeConvoId)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    <Info size={18} />
                  </button>
                )}
              </div>
            </header>
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-3xl mx-auto space-y-8">
                {messages.map((msg, index) => (
                  <div key={index}>
                    {msg.sender === 'user' ? (
                      <div className="flex justify-end">
                        <div className="bg-zinc-800 text-white rounded-xl px-4 py-2.5 max-w-xl">
                          <p>{msg.text}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="text-white">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-2xl font-semibold mt-4 mb-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                              // Preserve line breaks without breaking list layout
                              p: ({node, ...props}) => <p className="leading-7 whitespace-pre-wrap break-words mt-2 mb-2 first:mt-0 last:mb-0" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-6 mt-2 mb-2 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-6 mt-2 mb-2 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="leading-7" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                              em: ({node, ...props}) => <em className="italic" {...props} />,
                              a: ({node, ...props}) => <a className="underline text-blue-400 hover:text-blue-300" target="_blank" rel="noreferrer noopener" {...props} />,
                              code: ({inline, className, children, ...props}: any) =>
                                inline ? (
                                  <code className="bg-zinc-800 rounded px-1.5 py-0.5 text-sm" {...props}>{children}</code>
                                ) : (
                                  <pre className="bg-zinc-900 rounded p-3 overflow-x-auto text-sm">
                                    <code className={className} {...props}>{children}</code>
                                  </pre>
                                ),
                              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-zinc-600 pl-4 my-3 italic text-zinc-300" {...props} />,
                              hr: ({node, ...props}) => <hr className="my-6 border-zinc-700" {...props} />,
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-400">
                           <Copy size={16} className="cursor-pointer hover:text-white" />
                           <ThumbsUp size={16} className="cursor-pointer hover:text-white" />
                           <ThumbsDown size={16} className="cursor-pointer hover:text-white" />
                           <RefreshCw size={16} className="cursor-pointer hover:text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && <LoadingIndicator />}
              </div>
            </div>
          </>
        )}

        {/* --- INPUT FORM --- */}
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSend} className="bg-[#2d2d2d] rounded-2xl p-2 flex items-center">
              <button type="button" className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full">
                <Plus size={20} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="请输入你的问题…"
                className="flex-1 bg-transparent px-3 text-white placeholder-zinc-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-9 h-9 bg-zinc-600 rounded-full flex items-center justify-center text-white disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors"
                >
                  <ArrowUp size={20} />
                </button>
              </div>
            </form>
            <div className="text-center text-[11px] text-zinc-500 mt-3 space-y-1">
              <p>使用模型：OpenAI GPT‑5</p>
              {hasStartedChat && (
                <p>Eldaline 可能出错，请核实关键信息。</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Memo Drawer */}
      <MemoPanel
        open={isMemoOpen}
        title={(conversations.find(c => c.id === memoConvoId)?.title || '聊天备忘录')}
        content={memoContent}
        loading={memoLoading}
        onClose={() => setIsMemoOpen(false)}
      />
    </div>
  );
};

// Heuristic to pull the text field from a possibly malformed response
function coerceModelText(payload: any): string {
  if (payload && typeof payload === 'object' && typeof payload.text === 'string') {
    return payload.text;
  }
  if (typeof payload === 'string') {
    // Try direct parse first
    const fromWhole = tryParseTextFromJson(payload);
    if (fromWhole) return fromWhole;
    // If body has multiple concatenated JSON objects, extract balanced ones and parse
    const candidates = extractBalancedJsonObjects(payload);
    for (let i = candidates.length - 1; i >= 0; i--) {
      const t = tryParseTextFromJson(candidates[i]);
      if (t) return t;
    }
    return payload; // fall back to raw text
  }
  return '';
}

function tryParseTextFromJson(s: string): string | null {
  const trimmed = (s || '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj.text === 'string') return obj.text;
  } catch {}
  return null;
}

function extractBalancedJsonObjects(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        out.push(s.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

// --- HELPER COMPONENTS ---
const ChatHistoryItem = ({ text, isActive, onClick, onInfoClick }: { text: string, isActive: boolean, onClick?: () => void, onInfoClick?: () => void }) => (
  <div
    className={`w-full p-2 rounded-lg text-sm font-medium flex items-center justify-between ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
  >
    <button onClick={onClick} className="flex-1 text-left truncate">
      {text}
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); onInfoClick && onInfoClick(); }}
      title="聊天备忘录"
      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 ml-2 flex-shrink-0"
    >
      <Info size={16} />
    </button>
  </div>
);

const LoadingIndicator = () => (
    <div className="flex items-start">
        <div className="flex items-center space-x-1.5 pt-2">
            <div className="w-2 h-2 bg-zinc-500 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-zinc-500 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-zinc-500 rounded-full animate-pulse"></div>
        </div>
    </div>
);

export default ChatPage;

// --- MEMO PANEL ---
function MemoPanel({ open, title, content, loading, onClose }: { open: boolean, title: string, content: string, loading: boolean, onClose: () => void }) {
  return (
    <div className={`${open ? 'pointer-events-auto' : 'pointer-events-none'} fixed inset-0 z-30`}>
      {/* Overlay */}
      <div className={`${open ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 ease-out absolute inset-0 bg-black/50`} onClick={onClose} />
      {/* Panel */}
      <div className={`${open ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-200 ease-out absolute right-0 top-0 h-full w-full md:w-[360px] bg-[#0f0f0f] border-l border-zinc-800 flex flex-col pb-[env(safe-area-inset-bottom)]`}>
        <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Info size={18} className="text-zinc-400" />
            <h3 className="text-sm font-semibold text-white truncate">{title || '备忘录'}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-zinc-200 text-sm">
          {loading ? (
            '正在生成摘要…'
          ) : (
            content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 className="text-xl font-semibold mt-3 mb-2" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-base font-semibold mt-2.5 mb-1.5" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="leading-7 whitespace-pre-wrap break-words mt-2 mb-2 first:mt-0 last:mb-0" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc pl-5 mt-2 mb-2 space-y-1" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal pl-5 mt-2 mb-2 space-y-1" {...props} />
                  ),
                  li: ({ node, ...props }) => <li className="leading-7" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                  em: ({ node, ...props }) => <em className="italic" {...props} />,
                  a: ({ node, ...props }) => (
                    <a
                      className="underline text-blue-400 hover:text-blue-300"
                      target="_blank"
                      rel="noreferrer noopener"
                      {...props}
                    />
                  ),
                  code: ({ inline, className, children, ...props }: any) =>
                    inline ? (
                      <code className="bg-zinc-800 rounded px-1.5 py-0.5 text-xs" {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-zinc-900 rounded p-3 overflow-x-auto text-xs">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote
                      className="border-l-4 border-zinc-600 pl-4 my-3 italic text-zinc-300"
                      {...props}
                    />
                  ),
                  hr: ({ node, ...props }) => <hr className="my-4 border-zinc-700" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            ) : (
              '（暂无摘要）'
            )
          )}
        </div>
      </div>
    </div>
  );
}
