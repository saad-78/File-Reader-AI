const express = require('express');
const embeddingService = require('../services/embeddings');
const vectorStore = require('../services/vectorStore');
const llmService = require('../services/llm');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/query
 * Ask a question and get AI-powered answer with sources
 */
router.post('/', async (req, res) => {
  try {
    const { query, limit = 5, model } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    logger.info(`RAG query: "${query}"`);

    // Step 1: Check if Ollama is available
    const ollamaAvailable = await llmService.checkAvailability();
    if (!ollamaAvailable) {
      return res.status(503).json({
        success: false,
        error: 'LLM service (Ollama) is not available. Please start Ollama: ollama serve'
      });
    }

    // Step 2: Generate query embedding
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Step 3: Search for relevant chunks
    const searchResults = vectorStore.searchSimilar(queryEmbedding, {
      limit: parseInt(limit),
      minSimilarity: 0.3
    });

    if (searchResults.length === 0) {
      return res.json({
        success: true,
        query: query,
        answer: "I couldn't find any relevant information in the indexed documents to answer this question.",
        sources: [],
        noResults: true
      });
    }

    // Step 4: Build context from top results
    const context = searchResults
      .map((r, idx) => `[Document: ${r.filename}]\n${r.text}`)
      .join('\n\n---\n\n');

    // Step 5: Generate answer using LLM
    const llmResponse = await llmService.generateRAGResponse(query, context, {
      model: model
    });

    // Step 6: Return response
    res.json({
      success: true,
      query: query,
      answer: llmResponse.text,
      model: llmResponse.model,
      sources: searchResults.map(r => ({
        documentId: r.docId,
        filename: r.filename,
        similarity: parseFloat(r.similarity.toFixed(4)),
        snippet: r.text.substring(0, 200) + (r.text.length > 200 ? '...' : ''),
        chunkIndex: r.chunkIndex
      })),
      metadata: {
        chunksRetrieved: searchResults.length,
        tokensGenerated: llmResponse.tokensGenerated,
        responseTimeMs: llmResponse.timeMs
      }
    });

  } catch (error) {
    logger.error('Query failed', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/query/models
 * Get available LLM models
 */
router.get('/models', async (req, res) => {
  try {
    const models = await llmService.listModels();
    res.json({
      success: true,
      models: models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
