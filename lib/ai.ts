// Lightweight OpenAI REST wrapper exposing a chat and a text API.
// Models default to GPT-5 placeholders and can be overridden via env.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_BASE = (process.env.OPENAI_API_BASE || 'https://api.openai.com').replace(/\/$/, '');

if (!OPENAI_API_KEY) {
  // Do not throw to allow build; routes will handle missing key.
  console.warn('[ai] OPENAI_API_KEY is not set. Set it in your environment.');
}

export const DEFAULT_MODEL = process.env.GPT5_CHAT_MODEL || 'gpt-5-chat-latest';
export const DEFAULT_TEXT_MODEL = process.env.GPT5_TEXT_MODEL || 'gpt-5-chat-latest';

type ChatHistoryItem = { role: 'model' | 'user'; parts?: Array<{ text?: string }>; };

async function openaiChat(opts: {
  model?: string;
  history?: ChatHistoryItem[];
  message: string;
  systemInstruction?: string;
  temperature?: number;
}): Promise<string> {
  const model = opts.model || DEFAULT_MODEL;
  const url = `${OPENAI_API_BASE}/v1/chat/completions`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (opts.systemInstruction) {
    messages.push({ role: 'system', content: opts.systemInstruction });
  }
  for (const h of opts.history || []) {
    const role = h.role === 'model' ? 'assistant' : 'user';
    const text = (h.parts || [])
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n') || '';
    if (text) messages.push({ role, content: text });
  }
  messages.push({ role: 'user', content: opts.message });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.3,
    }),
  });

  if (!res.ok) {
    const err = await safeReadError(res);
    throw new Error(`openai chat error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  return String(text || '').trim();
}

async function openaiText(opts: { model?: string; prompt: string; temperature?: number }): Promise<string> {
  const model = opts.model || DEFAULT_TEXT_MODEL;
  const url = `${OPENAI_API_BASE}/v1/completions`;

  // Try text completions first
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt,
        temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.3,
        max_tokens: 512,
      }),
    });
    if (!res.ok) {
      const msg = await safeReadError(res);
      throw new Error(`openai text error ${res.status}: ${msg}`);
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.text ?? '';
    return String(text || '').trim();
  } catch (e) {
    // Fallback to chat completions using a single message
    const text = await openaiChat({ model: DEFAULT_MODEL, message: opts.prompt });
    return text;
  }
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 800);
  } catch {
    return `${res.statusText}`;
  }
}

export const ai = {
  chats: {
    create({ model, history, config }: { model?: string; history?: ChatHistoryItem[]; config?: { temperature?: number; systemInstruction?: string; thinkingConfig?: any } }) {
      return {
        async sendMessage({ message }: { message: string }): Promise<{ text: string }> {
          const text = await openaiChat({
            model,
            history,
            message,
            systemInstruction: config?.systemInstruction,
            temperature: config?.temperature,
          });
          return { text };
        },
      };
    },
  },
  text: {
    async generate({ prompt, model, temperature }: { prompt: string; model?: string; temperature?: number }): Promise<{ text: string }> {
      const text = await openaiText({ prompt, model, temperature });
      return { text };
    },
  },
};

