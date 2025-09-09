import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type Role = 'user' | 'model' | 'system';

export type Conversation = {
  id: string;
  title: string;
  createdAt: string; // ISO string
  owner?: string; // username of owner; undefined for legacy rows
};

export type Message = {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: string; // ISO string
};

const dbDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'chat.sqlite');

type SqlStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};
type SqliteDB = {
  pragma: (pragma: string) => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => SqlStatement;
  transaction: (fn: Function) => (...params: unknown[]) => unknown;
};

let db: SqliteDB | null = null;

type TableInfoRow = { name: string };

function ensureDb(): SqliteDB {
  if (db) return db;
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = (new (Database as unknown as { new (p?: string): SqliteDB })(dbPath));
  db.pragma('journal_mode = WAL');
  initSchema(db);
  return db;
}

function initSchema(d: SqliteDB) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE TABLE IF NOT EXISTS memos (
      conversation_id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  // Ensure owner column exists on conversations
  const hasOwnerCol = (d
    .prepare("PRAGMA table_info(conversations)")
    .all() as TableInfoRow[])
    .some((r) => r.name === 'owner');
  if (!hasOwnerCol) {
    try {
      d.exec('ALTER TABLE conversations ADD COLUMN owner TEXT');
      // For legacy rows, default owner to 'admin' to avoid leaking across users.
      d.exec("UPDATE conversations SET owner = COALESCE(owner, 'admin') WHERE owner IS NULL");
      d.exec('CREATE INDEX IF NOT EXISTS idx_conversations_owner_created ON conversations(owner, created_at)');
    } catch {
      // ignore if another process added it
    }
  }
}

export function createConversation(title?: string, owner?: string): Conversation {
  const d = ensureDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const finalTitle = title || '新对话';
  const hasOwnerCol = (d
    .prepare('PRAGMA table_info(conversations)')
    .all() as TableInfoRow[])
    .some((r) => r.name === 'owner');
  if (hasOwnerCol) {
    d.prepare('INSERT INTO conversations (id, title, created_at, owner) VALUES (?, ?, ?, ?)')
      .run(id, finalTitle, createdAt, owner || 'admin');
    return { id, title: finalTitle, createdAt, owner: owner || 'admin' };
  } else {
    d.prepare('INSERT INTO conversations (id, title, created_at) VALUES (?, ?, ?)')
      .run(id, finalTitle, createdAt);
    return { id, title: finalTitle, createdAt };
  }
}

export function listConversations(owner?: string): Conversation[] {
  const d = ensureDb();
  const hasOwnerCol = (d
    .prepare('PRAGMA table_info(conversations)')
    .all() as TableInfoRow[])
    .some((r) => r.name === 'owner');
  let rows: Conversation[] = [];
  if (hasOwnerCol) {
    if (owner && owner !== 'admin') {
      rows = (d
        .prepare('SELECT id, title, created_at AS createdAt, owner FROM conversations WHERE owner = ? ORDER BY created_at DESC')
        .all(owner)) as Conversation[];
    } else {
      rows = (d
        .prepare('SELECT id, title, created_at AS createdAt, owner FROM conversations ORDER BY created_at DESC')
        .all()) as Conversation[];
    }
  } else {
    rows = (d
      .prepare('SELECT id, title, created_at AS createdAt FROM conversations ORDER BY created_at DESC')
      .all()) as Conversation[];
  }
  return rows as Conversation[];
}

export function getConversation(id: string): Conversation | null {
  const d = ensureDb();
  const hasOwnerCol = (d
    .prepare('PRAGMA table_info(conversations)')
    .all() as TableInfoRow[])
    .some((r) => r.name === 'owner');
  const row = hasOwnerCol
    ? d.prepare('SELECT id, title, created_at AS createdAt, owner FROM conversations WHERE id = ?').get(id)
    : d.prepare('SELECT id, title, created_at AS createdAt FROM conversations WHERE id = ?').get(id);
  return (row as Conversation) || null;
}

export function addMessage(conversationId: string, role: Role, content: string): Message {
  const d = ensureDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  d.prepare(
    'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, conversationId, role, content, createdAt);
  return { id, conversationId, role, content, createdAt };
}

export function listMessages(conversationId: string): Message[] {
  const d = ensureDb();
  type MessageRow = Omit<Message, 'content'> & { content: unknown };
  const rows = (d
    .prepare(
      'SELECT id, conversation_id AS conversationId, role, content, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    )
    .all(conversationId)) as MessageRow[];
  // Normalize possible legacy rows where `content` accidentally stored JSON
  // like { conversationId, text } or even multiple concatenated JSON objects.
  const normalize = (c: unknown): string => {
    if (typeof c !== 'string') return String(c ?? '');
    const fromWhole = tryParseTextFromJson(c);
    if (fromWhole) return fromWhole;
    const candidates = extractBalancedJsonObjects(c);
    for (let i = candidates.length - 1; i >= 0; i--) {
      const t = tryParseTextFromJson(candidates[i]);
      if (t) return t;
    }
    return c;
  };
  return (rows as MessageRow[]).map((m) => ({ ...m, content: normalize(m.content) }));
}

export function listMessagesSince(sinceIso: string): Message[] {
  const d = ensureDb();
  type MessageRow = Omit<Message, 'content'> & { content: unknown };
  const rows = (d
    .prepare(
      'SELECT id, conversation_id AS conversationId, role, content, created_at AS createdAt FROM messages WHERE created_at >= ? ORDER BY created_at ASC'
    )
    .all(sinceIso)) as MessageRow[];
  const normalize = (c: unknown): string => {
    if (typeof c !== 'string') return String(c ?? '');
    const fromWhole = tryParseTextFromJson(c);
    if (fromWhole) return fromWhole;
    const candidates = extractBalancedJsonObjects(c);
    for (let i = candidates.length - 1; i >= 0; i--) {
      const t = tryParseTextFromJson(candidates[i]);
      if (t) return t;
    }
    return c;
  };
  return (rows as MessageRow[]).map((m) => ({ ...m, content: normalize(m.content) }));
}

export function listMessagesSinceForUser(sinceIso: string, owner?: string): Message[] {
  const d = ensureDb();
  const hasOwnerCol = (d
    .prepare('PRAGMA table_info(conversations)')
    .all() as TableInfoRow[])
    .some((r) => r.name === 'owner');
  type MessageRow = Omit<Message, 'content'> & { content: unknown };
  let rows: MessageRow[] = [];
  if (!hasOwnerCol || !owner || owner === 'admin') {
    return listMessagesSince(sinceIso);
  }
  rows = (d
    .prepare(
      `SELECT m.id, m.conversation_id AS conversationId, m.role, m.content, m.created_at AS createdAt
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.created_at >= ? AND c.owner = ?
       ORDER BY m.created_at ASC`
    )
    .all(sinceIso, owner)) as MessageRow[];

  const normalize = (c: unknown): string => {
    if (typeof c !== 'string') return String(c ?? '');
    const fromWhole = tryParseTextFromJson(c);
    if (fromWhole) return fromWhole;
    const candidates = extractBalancedJsonObjects(c);
    for (let i = candidates.length - 1; i >= 0; i--) {
      const t = tryParseTextFromJson(candidates[i]);
      if (t) return t;
    }
    return c;
  };
  return (rows as MessageRow[]).map((m) => ({ ...m, content: normalize(m.content) }));
}

function tryParseTextFromJson(s: string): string | null {
  const trimmed = (s || '').trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj.text === 'string') return obj.text;
  } catch {}
  return null;
}

function extractBalancedJsonObjects(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        out.push(s.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

export function updateConversationTitle(id: string, title: string) {
  const d = ensureDb();
  d.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, id);
}

export function deleteConversation(id: string) {
  const d = ensureDb();
  const txn = d.transaction(() => {
    d.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
    d.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  });
  txn();
}

export function dbReady() {
  ensureDb();
}

export type Memo = {
  conversationId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export function getMemo(conversationId: string): Memo | null {
  const d = ensureDb();
  const row = d
    .prepare(
      'SELECT conversation_id AS conversationId, content, created_at AS createdAt, updated_at AS updatedAt FROM memos WHERE conversation_id = ?'
    )
    .get(conversationId);
  return (row as Memo) || null;
}

export function upsertMemo(conversationId: string, content: string): Memo {
  const d = ensureDb();
  const now = new Date().toISOString();
  const existing = d
    .prepare('SELECT conversation_id AS conversationId, created_at AS createdAt FROM memos WHERE conversation_id = ?')
    .get(conversationId) as { conversationId: string; createdAt: string } | undefined;
  if (existing) {
    d.prepare('UPDATE memos SET content = ?, updated_at = ? WHERE conversation_id = ?').run(content, now, conversationId);
    return { conversationId, content, createdAt: existing.createdAt, updatedAt: now };
  } else {
    d.prepare('INSERT INTO memos (conversation_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(conversationId, content, now, now);
    return { conversationId, content, createdAt: now, updatedAt: now };
  }
}
