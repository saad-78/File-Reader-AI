const Database = require('better-sqlite3');
const config = require('../config/database');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(config.dbPath, config.options);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Documents table
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    extracted_text TEXT,
    extraction_method TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
  CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date DESC);
  CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);

  -- Create trigger for updated_at
  CREATE TRIGGER IF NOT EXISTS update_documents_timestamp 
  AFTER UPDATE ON documents
  BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`);

console.log('✓ Database initialized successfully');
console.log(`✓ Database path: ${config.dbPath}`);

module.exports = db;
