CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at INTEGER NOT NULL
);

CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    summary TEXT,
    source TEXT NOT NULL CHECK (source IN ('AGENT','SYSTEM','USER','GROUP')),
    memory_type TEXT NOT NULL CHECK (memory_type IN ('EXPERIENCE', 'DECISION', 'FACT', 'TASK', 'WORLD')),
    metadata TEXT,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_memories_created ON memories(created_at);

CREATE TABLE embeddings (
    memory_id TEXT PRIMARY KEY,
    vector BLOB NOT NULL,
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (source_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at INTEGER NOT NULL,
    last_active_at INTEGER,
    metadata TEXT
);

CREATE TABLE session_memories (
    session_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    relevance_score REAL,
    PRIMARY KEY (session_id, memory_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);