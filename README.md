This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## AI Chat with GPT‑5 + SQLite

This app now uses an OpenAI‑compatible GPT‑5 setup for chat and memo summaries, while persisting chat history in a local SQLite database.

- Chat: Chat Completions (`model: gpt-5-chat-latest` by default)
- Summaries: Text Generation (`model: gpt-5-text` by default)
- Storage: SQLite via `better-sqlite3` in `data/chat.sqlite`

Setup:

1) Copy `.env.local.example` to `.env.local` and set your key:

```
OPENAI_API_KEY=your_openai_api_key_here
# Optional overrides:
# OPENAI_API_BASE=https://api.openai.com
# GPT5_CHAT_MODEL=gpt-5-chat-latest
# GPT5_TEXT_MODEL=gpt-5-text
```

2) Start dev server: `npm run dev`

Endpoints:

- `POST /api/chat` — non‑streaming chat. Body: `{ conversationId?: string, message: string }`. Returns JSON `{ conversationId, text }`.
- `GET /api/conversations` — list conversations.
- `POST /api/conversations` — create conversation. Body: `{ title?: string }`.
- `GET /api/conversations/:id/messages` — list messages for a conversation.
- `GET /api/conversations/:id/memo` — get memo for a conversation if available.
- `POST /api/conversations/:id/memo` — generate/update memo (uses text generation).

Auth & multi‑user:

- Simple login at `/login` using developer‑editable users in `lib/auth.ts` (default: `test1`, `test2`, `test3`, `admin`) and password `boldJam3`.
- Sessions use a signed cookie; set `AUTH_SECRET` for production.
- Data scoping: `test1/test2/test3` can only see their own conversations; `admin` can see everything (and cannot chat).
- Admin dashboard: `/admin` shows all users’ conversations, owners, messages, and memos, plus metrics.

Notes:

- The chat page UI (`app/page.tsx`) sends a single request and renders the full Markdown response, storing all turns to SQLite.
- Requires Node.js runtime (not Edge) due to native SQLite binding.
- You can safely delete the `data/chat.sqlite*` files to reset state.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
