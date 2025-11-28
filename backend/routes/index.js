const express = require('express');
const storageService = require('../services/storage');
const embeddingService = require('../services/embeddings');
const vectorStore = require('../services/vectorStore');
const { chunkText, preprocessText } = require('../utils/chunker');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/index/:id
 * Index document with improved chunking
 */
router.post('/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);

    if (isNaN(docId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    const document = storageService.getDocument(docId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    if (document.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: `Document is not ready for indexing. Current status: ${document.status}`
      });
    }

    if (!document.extracted_text || document.extracted_text.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Document has insufficient text for indexing'
      });
    }

    res.status(202).json({
      success: true,
      message: 'Document indexing started',
      data: {
        documentId: docId,
        filename: document.original_name,
        status: 'indexing'
      }
    });

    // Process indexing asynchronously
    setImmediate(async () => {
      try {
        logger.info(`Starting indexing for document ${docId}`);

        // Preprocess text
        const cleanedText = preprocessText(document.extracted_text);

        // Chunk with improved strategy
        const chunks = chunkText(cleanedText, {
          chunkSize: 500,      // Larger chunks for more context
          overlap: 100,        // More overlap for continuity
          minChunkSize: 50
        });

        if (chunks.length === 0) {
          throw new Error('No valid chunks generated from document');
        }

        logger.info(`Generated ${chunks.length} chunks (avg ${Math.round(cleanedText.length / chunks.length)} chars each)`);

        // Store chunks
        const chunkIds = vectorStore.storeChunks(docId, chunks);

        // Generate embeddings
        const embeddings = await embeddingService.generateBatchEmbeddings(chunks);

        // Store embeddings
        vectorStore.storeEmbeddings(chunkIds, embeddings);

        logger.success(`Document ${docId} indexed successfully: ${chunks.length} chunks, ${embeddings.filter(e => e).length} embeddings`);

      } catch (error) {
        logger.error(`Failed to index document ${docId}`, error);
      }
    });

  } catch (error) {
    logger.error('Index route error', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/index/:id
 * Get indexing status
 */
router.get('/:id', (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const chunks = vectorStore.getDocumentChunks(docId);

    res.json({
      success: true,
      data: {
        documentId: docId,
        chunksCount: chunks.length,
        indexed: chunks.length > 0,
        chunks: chunks.map(c => ({
          index: c.chunk_index,
          wordCount: c.word_count,
          preview: c.chunk_text.substring(0, 150) + '...'
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to get index info', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/index/:id
 * Delete index
 */
router.delete('/:id', (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    vectorStore.deleteDocumentChunks(docId);

    res.json({
      success: true,
      message: 'Document index deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete index', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
