import { NextRequest } from 'next/server';
import { createConversation, listConversations } from '@/lib/db';
import { AUTH_COOKIE, parseSessionValue } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  const items = listConversations(user || undefined);
  return Response.json({ conversations: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const title = (body?.title as string) || '新对话';
  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  const convo = createConversation(title, user || 'admin');
  return Response.json(convo);
}
