'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info, BarChart3, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Conversation = { id: string; title: string; createdAt: string; owner?: string };
type Message = { id: string; conversationId: string; role: 'user' | 'model' | 'system'; content: string; createdAt: string };
type SeriesPoint = { t: string; count: number };

export default function AdminPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memo, setMemo] = useState<string>('');
  const [memoLoading, setMemoLoading] = useState(false);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [regenBusy, setRegenBusy] = useState(false);

  // Load all conversations (admin gets all via API)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/conversations', { cache: 'no-store' });
        const data = await res.json();
        setConversations((data?.conversations as Conversation[]) || []);
      } catch (e) {
        console.error('admin: failed to load conversations', e);
      } finally {
        setLoadingConvos(false);
      }
    })();
  }, []);

  // Load metrics (admin only)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/metrics', { cache: 'no-store' });
        const data = await res.json();
        setSeries((data?.series as SeriesPoint[]) || []);
      } catch (e) {
        console.error('metrics: failed to load series', e);
      }
    })();
    void regenerateSummary();
  }, []);

  async function regenerateSummary() {
    setRegenBusy(true);
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/metrics', { method: 'POST' });
      const data = await res.json();
      setSummary(String(data?.summary || ''));
    } catch (e) {
      console.error('metrics: failed to create summary', e);
      setSummary('无法生成摘要。');
    } finally {
      setLoadingSummary(false);
      setRegenBusy(false);
    }
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setMessages([]);
    setMemo('');
    setMemoLoading(true);
    try {
      const [mr, memR] = await Promise.all([
        fetch(`/api/conversations/${id}/messages`, { cache: 'no-store' }),
        fetch(`/api/conversations/${id}/memo`, { cache: 'no-store' }),
      ]);
      const msgs = await mr.json();
      const memoData = await memR.json();
      setMessages((msgs?.messages as Message[]) || []);
      setMemo(String(memoData?.memo?.content || ''));
    } catch (e) {
      console.error('admin: failed to open conversation', e);
    } finally {
      setMemoLoading(false);
    }
  }

  async function regenMemo(id: string) {
    setMemoLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}/memo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regen: true }) });
      const data = await res.json();
      setMemo(String(data?.memo?.content || ''));
    } catch (e) {
      console.error('admin: failed to regenerate memo', e);
    } finally {
      setMemoLoading(false);
    }
  }

  const byOwner = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    for (const c of conversations) {
      const owner = c.owner || '未知';
      if (!map.has(owner)) map.set(owner, []);
      map.get(owner)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a > b ? 1 : -1));
  }, [conversations]);

  const maxCount = useMemo(() => Math.max(1, ...series.map((p) => p.count)), [series]);

  return (
    <div className="relative flex h-screen w-full bg-black md:bg-[#212121] text-zinc-300">
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <header className="flex items-center justify-between p-4 pt-[env(safe-area-inset-top)] border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-800">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-white" />
              <h1 className="text-sm font-semibold text-white">Eldaline 管理</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}; window.location.href = '/login'; }}
              className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
            >退出登录</button>
          </div>
        </header>

        {/* Metrics + Summary */}
        <section className="p-4 pt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-gradient-to-b from-[#2a2a2a] to-[#222] border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">AI 摘要</p>
                <button onClick={regenerateSummary} disabled={regenBusy} className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-50">
                  {regenBusy ? '生成中…' : '重新生成'}
                </button>
              </div>
              <div className="p-4 text-sm text-zinc-200 min-h-[112px] max-h-[360px] overflow-y-auto overflow-x-hidden break-words">
                {loadingSummary ? (
                  <span className="text-zinc-400">正在生成摘要…</span>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    h1: ({ ...props }) => <h1 className="text-lg font-semibold mt-2 mb-2" {...props} />,
                    h2: ({ ...props }) => <h2 className="text-base font-semibold mt-2 mb-1.5" {...props} />,
                    p: ({ ...props }) => <p className="leading-7 whitespace-pre-wrap break-words break-all mt-2 mb-2 first:mt-0 last:mb-0" {...props} />,
                    ul: ({ ...props }) => <ul className="list-disc pl-5 mt-2 mb-2 space-y-1 break-words break-all" {...props} />,
                    ol: ({ ...props }) => <ol className="list-decimal pl-5 mt-2 mb-2 space-y-1 break-words break-all" {...props} />,
                    li: ({ ...props }) => <li className="leading-7 break-words break-all" {...props} />,
                  }}>{summary || '暂无摘要。'}</ReactMarkdown>
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-[#1b1b1b] border border-zinc-800 p-4">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">每小时对话数</h2>
              <div className="w-full">
                <div className="flex gap-1 items-end h-40">
                  {series.map((p, idx) => {
                    const h = Math.round((p.count / maxCount) * 100);
                    const isMajor = idx % 6 === 0;
                    return (
                      <div key={p.t} className="flex-1 flex flex-col items-center justify-end min-w-0">
                        <div className="w-full rounded-t overflow-hidden bg-zinc-700/30" style={{ height: `${Math.max(2, h)}%` }}>
                          <div className="w-full h-full bg-gradient-to-t from-emerald-400/80 to-emerald-300/60" />
                        </div>
                        <div className={`mt-1 text-[10px] ${isMajor ? 'text-zinc-400' : 'text-zinc-500'}`}>{formatHour(p.t)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-zinc-600">过去24小时（本地时间）</div>
              </div>
            </div>
          </div>
        </section>

        {/* Conversations by owner */}
        <section className="px-4 pb-6">
          {loadingConvos ? (
            <div className="text-sm text-zinc-400">加载对话列表…</div>
          ) : (
            byOwner.map(([owner, items]) => (
              <div key={owner} className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] text-zinc-200 font-semibold">
                    {owner.slice(0,1).toUpperCase()}
                  </div>
                  <h3 className="text-sm font-semibold text-white">{owner}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map((c) => (
                    <button key={c.id} onClick={() => openConversation(c.id)} className={`text-left rounded-xl border ${activeId===c.id?'border-zinc-600':'border-zinc-800'} bg-[#121212] hover:bg-[#161616] p-3 transition-colors w-full overflow-hidden`}>
                      <div className="text-sm font-medium text-white truncate">{c.title || '未命名'}</div>
                      <div className="text-[11px] text-zinc-500 mt-1">{new Date(c.createdAt).toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Detail drawer */}
        <AdminDetailDrawer
          open={!!activeId}
          onClose={() => setActiveId(null)}
          messages={messages}
          memo={memo}
          memoLoading={memoLoading}
          onRegen={() => activeId && regenMemo(activeId)}
        />
      </main>
    </div>
  );
}

function formatHour(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h.toString().padStart(2, '0')}:00`;
}

function AdminDetailDrawer({ open, onClose, messages, memo, memoLoading, onRegen }: { open: boolean; onClose: () => void; messages: Message[]; memo: string; memoLoading: boolean; onRegen: () => void }) {
  return (
    <div className={`${open ? 'pointer-events-auto' : 'pointer-events-none'} fixed inset-0 z-30`}>
      <div className={`${open ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 ease-out absolute inset-0 bg-black/50`} onClick={onClose} />
      <div className={`${open ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-200 ease-out absolute right-0 top-0 h-full w-full md:w-[560px] bg-[#0f0f0f] border-l border-zinc-800 flex flex-col pb-[env(safe-area-inset-bottom)]`}>
        <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Info size={18} className="text-zinc-400" />
            <h3 className="text-sm font-semibold text-white">对话详情</h3>
          </div>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800">关闭</button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
          <div className="p-4">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">消息</h4>
            <div className="space-y-3 text-sm">
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div className={`w-6 text-right ${m.role==='user'?'text-emerald-300':'text-zinc-400'}`}>{m.role==='user'?'用户':'助理'}</div>
                  <div className="flex-1 text-zinc-200 whitespace-pre-wrap break-words break-all">{m.content}</div>
                </div>
              ))}
              {messages.length === 0 && <div className="text-zinc-500">（无消息）</div>}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">备忘录</h4>
              <button onClick={onRegen} className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-1">
                <RefreshCw size={14} /> 重新生成
              </button>
            </div>
            <div className="text-sm text-zinc-200 min-h-[80px] max-h-[320px] overflow-auto whitespace-pre-wrap break-words break-all">
              {memoLoading ? '正在生成摘要…' : (memo || '（暂无摘要）')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
