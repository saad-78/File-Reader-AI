const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const ocrService = require('../services/ocr');
const storageService = require('../services/storage');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/webhook/ingest
 * Accept document via webhook
 */
router.post('/ingest', async (req, res) => {
  try {
    const { document_url, filename, metadata } = req.body;

    if (!document_url) {
      return res.status(400).json({
        success: false,
        error: 'document_url is required'
      });
    }

    logger.info(`Webhook received: ${document_url}`);

    // Return immediate response (202 Accepted)
    res.status(202).json({
      success: true,
      message: 'Document accepted and queued for processing',
      data: {
        url: document_url,
        filename: filename || 'webhook_document',
        status: 'queued'
      }
    });

    // Process asynchronously
    setImmediate(async () => {
      let localFilePath = null;
      let docId = null;

      try {
        logger.info(`Downloading document from: ${document_url}`);

        // Download the document
        const response = await axios({
          method: 'GET',
          url: document_url,
          responseType: 'arraybuffer',
          timeout: 30000 // 30 second timeout
        });

        // Determine filename and extension
        const ext = path.extname(filename || 'document.pdf');
        const uniqueName = `webhook-${Date.now()}${ext}`;
        localFilePath = path.join(process.env.UPLOAD_DIR || './uploads', uniqueName);

        // Save file
        fs.writeFileSync(localFilePath, response.data);
        logger.success(`Document downloaded: ${localFilePath}`);

        // Determine MIME type
        const mimeType = response.headers['content-type'] || 'application/pdf';

        // Create document record
        docId = storageService.createDocument({
          filename: uniqueName,
          originalName: filename || 'webhook_document',
          filePath: localFilePath,
          mimeType: mimeType,
          size: response.data.length
        });

        logger.info(`Processing webhook document ${docId}`);

        // Update to processing
        storageService.updateDocumentStatus(docId, 'processing');

        // Extract text
        const extractedData = await ocrService.extractText(localFilePath, mimeType);

        // Update with extracted text
        storageService.updateDocumentText(docId, extractedData);

        logger.success(`Webhook document ${docId} processed successfully`);

      } catch (error) {
        logger.error('Webhook processing failed', error);

        // Clean up file if it exists
        if (localFilePath && fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }

        // Mark as failed if document was created
        if (docId) {
          storageService.markDocumentFailed(docId, error.message);
        }
      }
    });

  } catch (error) {
    logger.error('Webhook endpoint error', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
