CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,            -- youtube | archive
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  creator TEXT,
  license TEXT,                  -- licence URL when known
  hosted INTEGER NOT NULL DEFAULT 0,
  embeddable INTEGER NOT NULL DEFAULT 1,
  stream_uid TEXT,
  topic TEXT, level TEXT,
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | published
  needs_review INTEGER NOT NULL DEFAULT 0,
  episodes TEXT NOT NULL,        -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  state TEXT NOT NULL,           -- queued | running | needs_transcript | done | error
  step TEXT,
  error TEXT,
  lesson_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS lessons_status ON lessons(status, created_at);
