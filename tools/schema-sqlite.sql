-- SQLite mirror of api/schema.sql, used only by tools/test-api.sh.
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, last_login_at TEXT);
CREATE TABLE progress (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, level_id TEXT NOT NULL, solved INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, solved_at TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, level_id));
CREATE TABLE drafts (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, level_id TEXT NOT NULL, code TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, level_id));
CREATE TABLE submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, level_id TEXT NOT NULL, code TEXT NOT NULL, passed INTEGER NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE auth_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL);
