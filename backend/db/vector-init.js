const db = require('./init');
const logger = require('../utils/logger');

// Create chunks table for text segments (WITHOUT STRICT mode)
db.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    word_count INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(doc_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON chunks(doc_id);
  CREATE INDEX IF NOT EXISTS idx_chunks_doc_chunk ON chunks(doc_id, chunk_index);
`);

// Initialize sqlite-vec for vector storage
try {
  // Load the sqlite-vec extension
  const sqliteVec = require('sqlite-vec');
  db.loadExtension(sqliteVec.getLoadablePath());
  
  logger.success('sqlite-vec extension loaded');

  // Drop and recreate vec_embeddings to ensure clean state
  try {
    db.exec('DROP TABLE IF EXISTS vec_embeddings;');
  } catch (e) {
    // Ignore if table doesn't exist
  }

  // Create virtual table for vector embeddings
  db.exec(`
    CREATE VIRTUAL TABLE vec_embeddings USING vec0(
      chunk_id INTEGER PRIMARY KEY,
      embedding FLOAT[384]
    );
  `);

  logger.success('Vector tables initialized');
} catch (error) {
  logger.error('Failed to initialize vector storage', error);
  throw error;
}

module.exports = db;
