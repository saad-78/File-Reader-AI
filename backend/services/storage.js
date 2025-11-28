const db = require('../db/init');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class StorageService {
  /**
   * Create a new document record
   */
  createDocument(fileData) {
    try {
      const stmt = db.prepare(`
        INSERT INTO documents (
          filename, 
          original_name, 
          file_path, 
          file_type, 
          file_size, 
          status
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        fileData.filename,
        fileData.originalName,
        fileData.filePath,
        fileData.mimeType,
        fileData.size,
        'pending'
      );

      logger.success(`Document created with ID: ${result.lastInsertRowid}`);
      return result.lastInsertRowid;
    } catch (error) {
      logger.error('Failed to create document record', error);
      throw error;
    }
  }

  /**
   * Update document with extracted text
   */
  updateDocumentText(docId, extractedData) {
    try {
      const stmt = db.prepare(`
        UPDATE documents 
        SET 
          extracted_text = ?,
          extraction_method = ?,
          status = 'completed',
          processed_date = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        extractedData.text,
        extractedData.method,
        docId
      );

      logger.success(`Document ${docId} updated with extracted text`);
    } catch (error) {
      logger.error(`Failed to update document ${docId}`, error);
      throw error;
    }
  }

  /**
   * Mark document as failed
   */
  markDocumentFailed(docId, errorMessage) {
    try {
      const stmt = db.prepare(`
        UPDATE documents 
        SET 
          status = 'failed',
          error_message = ?,
          processed_date = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(errorMessage, docId);
      logger.error(`Document ${docId} marked as failed: ${errorMessage}`);
    } catch (error) {
      logger.error(`Failed to mark document ${docId} as failed`, error);
    }
  }

  /**
   * Update document status
   */
  updateDocumentStatus(docId, status) {
    try {
      const stmt = db.prepare('UPDATE documents SET status = ? WHERE id = ?');
      stmt.run(status, docId);
      logger.info(`Document ${docId} status updated to: ${status}`);
    } catch (error) {
      logger.error(`Failed to update document ${docId} status`, error);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  getDocument(docId) {
    try {
      const stmt = db.prepare('SELECT * FROM documents WHERE id = ?');
      return stmt.get(docId);
    } catch (error) {
      logger.error(`Failed to get document ${docId}`, error);
      throw error;
    }
  }

  /**
   * Get all documents with optional filtering
   */
  getAllDocuments(filters = {}) {
    try {
      let query = 'SELECT * FROM documents WHERE 1=1';
      const params = [];

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.limit) {
        query += ' ORDER BY upload_date DESC LIMIT ?';
        params.push(filters.limit);
      } else {
        query += ' ORDER BY upload_date DESC';
      }

      const stmt = db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      logger.error('Failed to get documents', error);
      throw error;
    }
  }

  /**
   * Delete document and its file
   */
  deleteDocument(docId) {
    try {
      const doc = this.getDocument(docId);
      if (!doc) {
        throw new Error('Document not found');
      }

      // Delete file from filesystem
      if (fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
        logger.info(`Deleted file: ${doc.file_path}`);
      }

      // Delete from database
      const stmt = db.prepare('DELETE FROM documents WHERE id = ?');
      stmt.run(docId);

      logger.success(`Document ${docId} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete document ${docId}`, error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  getStats() {
    try {
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(file_size) as total_size
        FROM documents
      `);

      return stmt.get();
    } catch (error) {
      logger.error('Failed to get statistics', error);
      throw error;
    }
  }
}

module.exports = new StorageService();
