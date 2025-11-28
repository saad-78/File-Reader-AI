const express = require('express');
const storageService = require('../services/storage');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/documents
 * Get all documents with optional filtering
 */
router.get('/', (req, res) => {
  try {
    const { status, limit } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);

    const documents = storageService.getAllDocuments(filters);

    res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    logger.error('Failed to get documents', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:id
 * Get a specific document by ID
 */
router.get('/:id', (req, res) => {
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

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error(`Failed to get document ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:id/text
 * Get only the extracted text of a document
 */
router.get('/:id/text', (req, res) => {
  try {
    const docId = parseInt(req.params.id);
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
        error: `Document is not processed yet. Current status: ${document.status}`
      });
    }

    res.json({
      success: true,
      data: {
        documentId: document.id,
        filename: document.original_name,
        text: document.extracted_text,
        method: document.extraction_method
      }
    });
  } catch (error) {
    logger.error(`Failed to get document text ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', (req, res) => {
  try {
    const docId = parseInt(req.params.id);

    if (isNaN(docId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    storageService.deleteDocument(docId);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    logger.error(`Failed to delete document ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/stats
 * Get document statistics
 */
router.get('/stats/summary', (req, res) => {
  try {
    const stats = storageService.getStats();

    res.json({
      success: true,
      data: {
        total: stats.total || 0,
        completed: stats.completed || 0,
        processing: stats.processing || 0,
        pending: stats.pending || 0,
        failed: stats.failed || 0,
        totalSize: stats.total_size || 0,
        totalSizeMB: ((stats.total_size || 0) / (1024 * 1024)).toFixed(2)
      }
    });
  } catch (error) {
    logger.error('Failed to get statistics', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
