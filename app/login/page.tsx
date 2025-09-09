'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // If already logged in, navigate to next
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) router.replace(nextPath);
      } catch {}
    })();
  }, [router, nextPath]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(String(data?.error || '登录失败'));
        return;
      }
      router.replace(nextPath);
    } catch (e) {
      setError('网络错误');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black md:bg-[#212121] text-zinc-200 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-[#101010] border border-zinc-800 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-white flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-black" />
          </div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Eldaline</h1>
          <p className="text-xs text-zinc-500 mt-1">极简中文体验 · 使用模型：OpenAI GPT‑5</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="test1 / test2 / test3 / admin"
              className="w-full rounded-lg bg-[#1a1a1a] border border-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="boldJam3"
              className="w-full rounded-lg bg-[#1a1a1a] border border-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>
          {error && (
            <div className="text-xs text-red-400 mt-1">{error}</div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full mt-2 rounded-lg bg-white text-black text-sm font-medium py-2 disabled:opacity-60"
          >
            {busy ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="text-[11px] text-zinc-500 mt-4 text-center">仅供内部测试使用</p>
      </div>
    </div>
  );
}

