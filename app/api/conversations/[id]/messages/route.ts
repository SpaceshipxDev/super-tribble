import { NextRequest } from 'next/server';
import { listMessages, getConversation } from '@/lib/db';
import { AUTH_COOKIE, parseSessionValue } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  const convo = getConversation(id);
  if (!convo) return new Response('未找到会话', { status: 404 });
  if (convo.owner && user !== 'admin' && user !== convo.owner) {
    return new Response('无权访问该会话', { status: 403 });
  }
  const items = listMessages(id);
  return Response.json({ messages: items });
}
