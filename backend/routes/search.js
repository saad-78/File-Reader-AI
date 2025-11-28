const express = require('express');
const embeddingService = require('../services/embeddings');
const vectorStore = require('../services/vectorStore');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/search?q=query&limit=5
 * Semantic search across all documents
 */
router.get('/', async (req, res) => {
  try {
    const { q, limit = 5, min_similarity = 0.3 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    logger.info(`Searching for: "${q}"`);

    // Generate embedding for query
    const queryEmbedding = await embeddingService.generateEmbedding(q);

    // Search similar chunks
    const results = vectorStore.searchSimilar(queryEmbedding, {
      limit: parseInt(limit),
      minSimilarity: parseFloat(min_similarity)
    });

    res.json({
      success: true,
      query: q,
      resultsCount: results.length,
      data: results.map(r => ({
        documentId: r.docId,
        filename: r.filename,
        text: r.text,
        similarity: parseFloat(r.similarity.toFixed(4)),
        chunkIndex: r.chunkIndex,
        wordCount: r.wordCount
      }))
    });

  } catch (error) {
    logger.error('Search failed', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
