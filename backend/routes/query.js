const express = require('express');
const embeddingService = require('../services/embeddings');
const vectorStore = require('../services/vectorStore');
const llmService = require('../services/llm');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/query
 * Enhanced RAG with more context and better prompting
 */
router.post('/', async (req, res) => {
  try {
    const { query, limit = 10, model } = req.body; // Increased from 5 to 10

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    logger.info(`RAG query: "${query}"`);

    // Check if LLM is available
    const llmAvailable = await llmService.checkAvailability();
    if (!llmAvailable) {
      return res.status(503).json({
        success: false,
        error: 'LLM service not available. Please check GROQ_API_KEY in .env file'
      });
    }

    // Generate query embedding
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Search with lower threshold for better recall
    const searchResults = vectorStore.searchSimilar(queryEmbedding, {
      limit: parseInt(limit),
      minSimilarity: 0.15  // Lower threshold - cast wider net
    });

    if (searchResults.length === 0) {
      return res.json({
        success: true,
        query: query,
        answer: "I couldn't find relevant information in the documents to answer this question. Please try rephrasing or upload more documents.",
        sources: [],
        noResults: true
      });
    }

    logger.info(`Retrieved ${searchResults.length} chunks for context`);

    // Build rich context with document names
    const contextParts = searchResults.map((r, idx) => {
      return `[Source ${idx + 1}: ${r.filename}]\n${r.text}\n`;
    });
    const context = contextParts.join('\n---\n\n');

    // Enhanced RAG prompt
    const systemPrompt = `You are an expert AI assistant specialized in analyzing documents and providing accurate, detailed answers.

INSTRUCTIONS:
1. Answer ONLY based on the provided context
2. Always cite which source document you're referring to (e.g., "According to [Source 1]...")
3. If information is in multiple sources, mention all relevant ones
4. Be specific - include numbers, dates, names, and details from the context
5. If the answer requires information not in the context, clearly state: "This information is not available in the provided documents"
6. Organize your answer with clear structure when appropriate
7. Be concise but thorough - don't add information not in the context`;

    const userPrompt = `Context from documents (multiple sources):

${context}

User Question: ${query}

Provide a comprehensive answer based ONLY on the context above. Cite sources.`;

    // Generate answer
    const llmResponse = await llmService.generate(userPrompt, {
      system: systemPrompt,
      model: model,
      temperature: 0.2,  // Lower temperature for more factual answers
      maxTokens: 800     // More tokens for detailed answers
    });

    // Return enhanced response
    res.json({
      success: true,
      query: query,
      answer: llmResponse.text,
      model: llmResponse.model,
      sources: searchResults.map(r => ({
        documentId: r.docId,
        filename: r.filename,
        similarity: parseFloat(r.similarity.toFixed(4)),
        snippet: r.text.substring(0, 300) + (r.text.length > 300 ? '...' : ''),
        chunkIndex: r.chunkIndex
      })),
      metadata: {
        chunksRetrieved: searchResults.length,
        tokensGenerated: llmResponse.tokensGenerated,
        responseTimeMs: llmResponse.timeMs,
        minSimilarity: 0.15
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
