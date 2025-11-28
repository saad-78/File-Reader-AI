const db = require('../db/vector-init');
const logger = require('../utils/logger');

class VectorStore {
  /**
   * Store text chunks for a document
   */
  storeChunks(docId, chunks) {
    try {
      const stmt = db.prepare(`
        INSERT INTO chunks (doc_id, chunk_index, chunk_text, word_count)
        VALUES (CAST(? AS INTEGER), CAST(? AS INTEGER), ?, CAST(? AS INTEGER))
      `);

      const chunkIds = [];
      const transaction = db.transaction((chunks) => {
        for (let i = 0; i < chunks.length; i++) {
          const wordCount = chunks[i].split(/\s+/).length;
          const result = stmt.run(docId, i, chunks[i], wordCount);
          chunkIds.push(result.lastInsertRowid);
        }
      });

      transaction(chunks);
      logger.success(`Stored ${chunks.length} chunks for document ${docId}`);
      return chunkIds;
    } catch (error) {
      logger.error('Failed to store chunks', error);
      throw error;
    }
  }

  /**
   * Store embeddings for chunks
   */
  storeEmbeddings(chunkIds, embeddings) {
    try {
      const stmt = db.prepare(`
        INSERT INTO vec_embeddings (chunk_id, embedding)
        VALUES (CAST(? AS INTEGER), ?)
      `);

      const transaction = db.transaction((chunkIds, embeddings) => {
        for (let i = 0; i < chunkIds.length; i++) {
          if (embeddings[i]) {
            // Store as JSON string - sqlite-vec will handle conversion
            const embeddingJson = JSON.stringify(embeddings[i]);
            stmt.run(chunkIds[i], embeddingJson);
          }
        }
      });

      transaction(chunkIds, embeddings);
      logger.success(`Stored ${embeddings.filter(e => e).length} embeddings`);
    } catch (error) {
      logger.error('Failed to store embeddings', error);
      throw error;
    }
  }

  /**
   * Search for similar chunks using sqlite-vec distance function
   * This uses sqlite-vec's built-in cosine distance, which is much faster
   */
  searchSimilar(queryEmbedding, options = {}) {
    const {
      limit = 5,
      minSimilarity = 0.0
    } = options;

    try {
      // Convert query embedding to JSON for sqlite-vec
      const queryJson = JSON.stringify(queryEmbedding);

      // Use sqlite-vec's vec_distance_cosine function
      // Note: cosine distance returns 0-2, where 0 is identical
      // We convert to similarity (1 - distance/2) to get 0-1 scale
      const rows = db.prepare(`
        SELECT 
          CAST(ve.chunk_id AS INTEGER) as chunk_id,
          (1.0 - vec_distance_cosine(ve.embedding, ?)/2.0) as similarity,
          c.chunk_text,
          CAST(c.chunk_index AS INTEGER) as chunk_index,
          CAST(c.word_count AS INTEGER) as word_count,
          CAST(c.doc_id AS INTEGER) as doc_id,
          d.original_name,
          d.file_type,
          d.upload_date
        FROM vec_embeddings ve
        JOIN chunks c ON ve.chunk_id = c.id
        JOIN documents d ON c.doc_id = d.id
        WHERE d.status = 'completed'
        AND (1.0 - vec_distance_cosine(ve.embedding, ?)/2.0) >= ?
        ORDER BY similarity DESC
        LIMIT ?
      `).all(queryJson, queryJson, minSimilarity, limit);

      logger.success(`Found ${rows.length} similar chunks`);

      return rows.map(row => ({
        chunkId: row.chunk_id,
        docId: row.doc_id,
        filename: row.original_name,
        text: row.chunk_text,
        chunkIndex: row.chunk_index,
        wordCount: row.word_count,
        similarity: row.similarity,
        fileType: row.file_type,
        uploadDate: row.upload_date
      }));

    } catch (error) {
      logger.error('Failed to search similar chunks', error);
      throw error;
    }
  }

  /**
   * Get chunks for a specific document
   */
  getDocumentChunks(docId) {
    try {
      const chunks = db.prepare(`
        SELECT * FROM chunks
        WHERE doc_id = CAST(? AS INTEGER)
        ORDER BY chunk_index ASC
      `).all(docId);

      return chunks;
    } catch (error) {
      logger.error(`Failed to get chunks for document ${docId}`, error);
      throw error;
    }
  }

  /**
   * Delete chunks and embeddings for a document
   */
  deleteDocumentChunks(docId) {
    try {
      const chunks = this.getDocumentChunks(docId);
      const chunkIds = chunks.map(c => c.id);

      if (chunkIds.length > 0) {
        const deleteEmbeddings = db.prepare(`
          DELETE FROM vec_embeddings WHERE chunk_id = CAST(? AS INTEGER)
        `);

        db.transaction(() => {
          for (const chunkId of chunkIds) {
            deleteEmbeddings.run(chunkId);
          }
        })();

        db.prepare('DELETE FROM chunks WHERE doc_id = CAST(? AS INTEGER)').run(docId);

        logger.success(`Deleted ${chunkIds.length} chunks for document ${docId}`);
      }
    } catch (error) {
      logger.error(`Failed to delete chunks for document ${docId}`, error);
      throw error;
    }
  }

  /**
   * Get vector storage statistics
   */
  getStats() {
    try {
      const stats = db.prepare(`
        SELECT 
          COUNT(DISTINCT c.doc_id) as indexed_documents,
          COUNT(c.id) as total_chunks,
          COUNT(ve.chunk_id) as total_embeddings,
          AVG(c.word_count) as avg_chunk_words
        FROM chunks c
        LEFT JOIN vec_embeddings ve ON c.id = ve.chunk_id
      `).get();

      return stats;
    } catch (error) {
      logger.error('Failed to get vector store stats', error);
      throw error;
    }
  }
}

module.exports = new VectorStore();
