import { NextRequest } from 'next/server';
import { ai, DEFAULT_TEXT_MODEL } from '@/lib/ai';
import { listConversations, listMessages, listMessagesSinceForUser, type Conversation as DbConversation, type Message as DbMessage } from '@/lib/db';
import { AUTH_COOKIE, parseSessionValue } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Returns last-24h conversation histogram (by conversation creation time)
export async function GET(req: NextRequest) {
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Build 24 hourly buckets ending at current hour
  const buckets: { t: string; count: number }[] = [];
  const endHour = new Date(now);
  endHour.setMinutes(0, 0, 0);
  for (let i = 23; i >= 0; i--) {
    const start = new Date(endHour.getTime() - i * 60 * 60 * 1000);
    buckets.push({ t: start.toISOString(), count: 0 });
  }

  // Count messages per hour (better signal of activity)
  const msgs = listMessagesSinceForUser(since.toISOString(), user || undefined);
  for (const m of msgs) {
    const mt = new Date(m.createdAt);
    const aligned = new Date(mt);
    aligned.setMinutes(0, 0, 0);
    const iso = aligned.toISOString();
    const b = buckets.find((x) => x.t === iso);
    if (b) b.count += 1;
  }

  return Response.json({
    series: buckets,
    total: msgs.length,
    since: since.toISOString(),
    until: now.toISOString(),
  });
}

// Generates an AI summary for last 24 hours across conversations
export async function POST(req: NextRequest) {
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const allConvos = listConversations(user || undefined);

  // Gather only messages from last 24h, grouped by conversation
  const recent = listMessagesSinceForUser(since.toISOString(), user || undefined);
  const byConvo = new Map<string, DbMessage[]>();
  for (const m of recent) {
    if (!byConvo.has(m.conversationId)) byConvo.set(m.conversationId, []);
    byConvo.get(m.conversationId)!.push(m);
  }
  const transcripts: string[] = [];
  for (const [cid, msgs] of byConvo.entries()) {
    const convo = allConvos.find((c) => c.id === cid) || ({ id: cid, title: '未命名', createdAt: '' } as DbConversation);
    const t = formatTranscript(convo, msgs);
    if (t.trim()) transcripts.push(t);
  }
  const joined = transcripts.join('\n\n---\n\n');

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({
      summary: '无法生成 AI 摘要（缺少 API Key）。以下为过去24小时的占位摘要。',
    });
  }

  const prompt = [
    'You are an executive assistant aggregating company-wide assistant usage for the last 24 hours.',
    'Write a concise, modern summary in clear bullet points and short paragraphs.',
    'Focus on intents, themes, notable tasks completed, decisions, risks, and follow-ups.',
    'Keep it actionable. Prefer section headings like: Overview, Top Topics, Notable Wins, Risks / Open Questions, Follow-ups.',
    'Output in succinct Chinese.',
    'Conversation snapshots (chronological):',
    '<<<BEGIN>>>',
    joined || '(no conversations in the last day)',
    '<<<END>>>',
  ].join('\n');

  try {
    const out = await ai.text.generate({ prompt, model: DEFAULT_TEXT_MODEL, temperature: 0.3 });
    const text = (out.text || '').trim();
    return Response.json({ summary: text || '未检测到显著活动。' });
  } catch (e: any) {
    console.error('[metrics] summary error:', e);
    return Response.json({ summary: '生成摘要失败。' }, { status: 200 });
  }
}

function formatTranscript(convo: DbConversation, msgs: DbMessage[]): string {
  const lines = msgs.map((m) => `${m.role === 'model' ? '助理' : m.role === 'system' ? '系统' : '用户'}: ${(m.content || '').trim()}`);
  const header = `会话: ${convo.title || '未命名'}｜创建时间: ${convo.createdAt}`;
  return `${header}\n${lines.join('\n')}`;
}
