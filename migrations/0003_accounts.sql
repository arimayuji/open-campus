-- Accounts through GitHub, sessions by hashed token, and learning progress per user and lecture.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id TEXT NOT NULL UNIQUE,
  login TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,            -- SHA-256 of the cookie token; the token itself is never stored
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL     -- unix seconds
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  seen TEXT NOT NULL DEFAULT '[]',   -- episode numbers watched
  plays TEXT NOT NULL DEFAULT '{}',  -- episode -> times played (thickens the branch)
  quiz TEXT NOT NULL DEFAULT '{}',   -- episode -> right | wrong
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id)
);
