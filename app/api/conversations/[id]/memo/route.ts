import { NextRequest } from 'next/server';
import { ai, DEFAULT_TEXT_MODEL } from '@/lib/ai';
import { getConversation, listMessages, getMemo, upsertMemo, type Message as DbMessage } from '@/lib/db';
import { AUTH_COOKIE, parseSessionValue } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  const convo = getConversation(id);
  if (!convo) return new Response('未找到会话', { status: 404 });
  if (convo.owner && user !== 'admin' && user !== convo.owner) {
    return new Response('无权访问该会话', { status: 403 });
  }
  const memo = getMemo(id);
  return Response.json({ memo: memo || null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json().catch(() => ({} as any));
  const { regen } = body || {};

  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  const convo = getConversation(id);
  if (!convo) {
    return new Response('未找到会话', { status: 404 });
  }
  if (convo.owner && user !== 'admin' && user !== convo.owner) {
    return new Response('无权访问该会话', { status: 403 });
  }

  // If memo exists and not forced to regenerate, return it
  if (!regen) {
    const existing = getMemo(id);
    if (existing) return Response.json({ memo: existing });
  }

  const messages = listMessages(id);
  const transcript = messages
    .map((m: DbMessage) => {
      const speaker = m.role === 'model' ? '助理' : m.role === 'system' ? '系统' : '用户';
      const text = (m.content || '').trim();
      return `${speaker}: ${text}`;
    })
    .join('\n');

  if (!process.env.OPENAI_API_KEY) {
    // Fallback: store a placeholder to avoid repeated attempts
    const placeholder = '（无法生成摘要：服务器缺少 API Key）';
    const saved = upsertMemo(id, placeholder);
    return Response.json({ memo: saved }, { status: 200 });
  }

  // Build a succinct Chinese memo request
  const instruction = [
    '请基于以下对话记录，用中文写一份非常简洁的备忘录。',
    '— TLDR of what happened with the employe/waht he wanted, what happend in his conv with the AI.',
    '',
    '对话记录：',
    '<<<BEGIN_CONVERSATION>>>',
    transcript || '（无对话记录）',
    '<<<END_CONVERSATION>>>',
  ].join('\n');

  try {
    const response = await ai.text.generate({ prompt: instruction, model: DEFAULT_TEXT_MODEL, temperature: 0.3 });
    const text = (response.text || '').trim();
    const content = text || '（暂无内容可摘要）';
    const saved = upsertMemo(id, content);
    return Response.json({ memo: saved });
  } catch (err: any) {
    console.error('[memo] generation error:', err);
    const fallback = '（生成摘要失败）';
    const saved = upsertMemo(id, fallback);
    return Response.json({ memo: saved }, { status: 200 });
  }
}
