-- Migration: Create Vector Index Table
-- Description: Creates a virtual table for vector similarity search using sqlite-vec

CREATE VIRTUAL TABLE IF NOT EXISTS memory_vectors USING vec0(
  memory_id TEXT PRIMARY KEY,
  embedding FLOAT[1024]
);
