'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type SeriesPoint = { t: string; count: number };

export default function MetricsPage() {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [summary, setSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [regenBusy, setRegenBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/metrics', { cache: 'no-store' });
        const data = await res.json();
        setSeries((data?.series as SeriesPoint[]) || []);
      } catch (e) {
        console.error('metrics: failed to load series', e);
      } finally {
        setLoadingSeries(false);
      }
    })();
  }, []);

  useEffect(() => {
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

  const maxCount = useMemo(() => Math.max(1, ...series.map((p) => p.count)), [series]);
  const hasActivity = useMemo(() => series.some((p) => p.count > 0), [series]);

  return (
    <div className="relative flex h-screen w-full bg-black md:bg-[#212121] text-zinc-300">
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <header className="flex items-center gap-3 p-4 pt-[env(safe-area-inset-top)] border-b border-zinc-800">
          <Link href="/" className="p-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-800">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-white" />
            <h1 className="text-sm font-semibold text-white">数据 · 过去24小时</h1>
          </div>
        </header>

        {/* Summary */}
        <section className="p-4 pt-3">
          <div className="rounded-2xl bg-gradient-to-b from-[#2a2a2a] to-[#222] border border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">AI 摘要</p>
              <button
                onClick={regenerateSummary}
                disabled={regenBusy}
                className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {regenBusy ? '生成中…' : '重新生成'}
              </button>
            </div>
            <div className="p-4 text-sm text-zinc-200 min-h-[112px] max-h-[360px] overflow-y-auto overflow-x-hidden break-words">
              {loadingSummary ? (
                <span className="text-zinc-400">正在生成摘要…</span>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-lg font-semibold mt-2 mb-2" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-base font-semibold mt-2 mb-1.5" {...props} />,
                    p: ({ node, ...props }) => <p className="leading-7 whitespace-pre-wrap break-words break-all mt-2 mb-2 first:mt-0 last:mb-0" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 mt-2 mb-2 space-y-1 break-words break-all" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mt-2 mb-2 space-y-1 break-words break-all" {...props} />,
                    li: ({ node, ...props }) => <li className="leading-7 break-words break-all" {...props} />,
                  }}
                >
                  {summary || '暂无摘要。'}
                </ReactMarkdown>
              )}
            </div>
          </div>
        </section>

        {/* Timegraph */}
        <section className="px-4 pb-6">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">每小时对话数</h2>
          <div className="rounded-2xl bg-[#1b1b1b] border border-zinc-800 p-4">
            {loadingSeries ? (
              <div className="text-sm text-zinc-400">加载中…</div>
            ) : (
              <div className="w-full">
                <div className="flex gap-1 items-end h-40">
                  {series.map((p, idx) => {
                    const h = Math.round((p.count / maxCount) * 100);
                    const isMajor = idx % 6 === 0; // every 6 hours
                    return (
                      <div key={p.t} className="flex-1 flex flex-col items-center justify-end min-w-0">
                        <div
                          className="w-full rounded-t overflow-hidden bg-zinc-700/30"
                          style={{ height: `${Math.max(2, h)}%` }}
                        >
                          <div className="w-full h-full bg-gradient-to-t from-emerald-400/80 to-emerald-300/60" />
                        </div>
                        <div className={`mt-1 text-[10px] ${isMajor ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {formatHour(p.t)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!hasActivity && (
                  <div className="mt-2 text-xs text-zinc-500">过去24小时内无活动。</div>
                )}
                <div className="mt-2 text-xs text-zinc-600">过去24小时（本地时间）</div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function formatHour(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h.toString().padStart(2, '0')}:00`;
}
