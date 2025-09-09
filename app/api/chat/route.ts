import { NextRequest } from 'next/server';
import { ai, DEFAULT_MODEL } from '@/lib/ai';
import { addMessage, createConversation, getConversation, listMessages, updateConversationTitle, type Message as DbMessage } from '@/lib/db';
import { AUTH_COOKIE, parseSessionValue } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // allow long single responses

type PostBody = {
  conversationId?: string;
  message: string;
  systemInstruction?: string;
  temperature?: number;
  thinkingBudget?: number; // 0 disables thinking
};

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const message = (body.message || '').trim();
  if (!message) {
    return new Response('Missing message', { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response('Server missing OPENAI_API_KEY', { status: 500 });
  }

  const raw = req.cookies.get(AUTH_COOKIE)?.value;
  const user = await parseSessionValue(raw);
  const isAdmin = user === 'admin';

  if (isAdmin) {
    return new Response('管理员不可发起聊天', { status: 403 });
  }

  let conversationId = body.conversationId;
  // Ensure conversation exists or create one
  const convo = conversationId && getConversation(conversationId);
  if (!convo) {
    const created = createConversation('新对话', user || 'admin');
    conversationId = created.id;
  } else {
    if (convo.owner && !isAdmin && user !== convo.owner) {
      return new Response('无权访问该会话', { status: 403 });
    }
  }

  // Persist user message immediately and capture id
  const savedUser = addMessage(conversationId!, 'user', message);

  // Auto-title conversation from first user message
  try {
    const convoNow = getConversation(conversationId!);
    const msgsNow = listMessages(conversationId!);
    const isFirstTurn = msgsNow.length === 1; // only the just-saved user message
    const looksUntitled = !convoNow?.title || /^new chat$/i.test(convoNow!.title) || convoNow!.title === '新对话';
    if (isFirstTurn || looksUntitled) {
      const title = generateTitleFromText(message);
      if (title) updateConversationTitle(conversationId!, title);
    }
  } catch {}

  // Build history for the chat API
  const history = listMessages(conversationId!)
    .filter((m) => m.id !== savedUser.id) // exclude the just-sent user message
    .map((m: DbMessage) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // Non-streaming: generate one complete response and return JSON
  console.log(`[chat] start non-stream: convo=${conversationId} msgLen=${message.length}`);
  try {
    const chat = ai.chats.create({
      model: DEFAULT_MODEL,
      history,
      config: {
        temperature: body.temperature,
        systemInstruction: body.systemInstruction ?? '你是一名中文助手。所有回答请使用简洁、现代的中文表达，短句直给，避免冗长。',
        thinkingConfig: { thinkingBudget: typeof body.thinkingBudget === 'number' ? body.thinkingBudget : 0 },
      },
    });

    const response = await chat.sendMessage({ message });
    const text = response?.text || '';
    console.log(`[chat] done non-stream: len=${text.length}`);
    if (text.trim()) addMessage(conversationId!, 'model', text);
    return Response.json({ conversationId, text });
  } catch (err: any) {
    console.error('[chat] error non-stream:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'generation error', conversationId }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function generateTitleFromText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const max = 48;
  const chars = Array.from(trimmed); // handles BMP + CJK safely
  if (chars.length <= max) return trimmed;
  const head = chars.slice(0, max).join('');
  return `${head}…`;
}
