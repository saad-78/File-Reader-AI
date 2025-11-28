const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ocrService = require('../services/ocr');
const storageService = require('../services/storage');
const embeddingService = require('../services/embeddings');
const vectorStore = require('../services/vectorStore');
const { chunkText, preprocessText } = require('../utils/chunker');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: PDF, JPG, PNG, TXT`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800
  },
  fileFilter: fileFilter
});

/**
 * POST /api/upload
 * Upload and auto-index document
 */
router.post('/', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please provide a file in the "document" field.'
      });
    }

    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

    // Create document record
    const docId = storageService.createDocument({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    // Return immediate response
    res.status(202).json({
      success: true,
      message: 'Document uploaded and processing started',
      data: {
        documentId: docId,
        filename: req.file.originalname,
        size: req.file.size,
        status: 'processing'
      }
    });

    // Process document asynchronously (OCR + Auto-Index)
    setImmediate(async () => {
      try {
        logger.info(`Starting OCR + indexing for document ${docId}`);
        
        // Update status
        storageService.updateDocumentStatus(docId, 'processing');

        // Step 1: Extract text using OCR
        const extractedData = await ocrService.extractText(
          req.file.path,
          req.file.mimetype
        );

        // Step 2: Update document with extracted text
        storageService.updateDocumentText(docId, extractedData);

        logger.success(`Document ${docId} OCR complete: ${extractedData.text.length} chars via ${extractedData.method}`);

        // Step 3: Auto-index if text is sufficient
        if (extractedData.text && extractedData.text.trim().length >= 50) {
          logger.info(`Auto-indexing document ${docId}...`);
          
          // Preprocess text
          const cleanedText = preprocessText(extractedData.text);

          // Chunk
          const chunks = chunkText(cleanedText, {
            chunkSize: 500,
            overlap: 100,
            minChunkSize: 50
          });

          if (chunks.length > 0) {
            // Store chunks
            const chunkIds = vectorStore.storeChunks(docId, chunks);

            // Generate embeddings
            const embeddings = await embeddingService.generateBatchEmbeddings(chunks);

            // Store embeddings
            vectorStore.storeEmbeddings(chunkIds, embeddings);

            logger.success(`Document ${docId} fully indexed: ${chunks.length} chunks`);
          } else {
            logger.info(`Document ${docId} text too short for chunking`);
          }
        } else {
          logger.info(`Document ${docId} text too short for indexing (<50 chars)`);
        }

      } catch (error) {
        logger.error(`Failed to process document ${docId}`, error);
        storageService.markDocumentFailed(docId, error.message);
      }
    });

  } catch (error) {
    logger.error('Upload route error', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload document'
    });
  }
});

/**
 * POST /api/upload/batch
 * Upload multiple documents
 */
router.post('/batch', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    logger.info(`Batch upload: ${req.files.length} files`);

    const uploadedDocs = [];

    for (const file of req.files) {
      try {
        const docId = storageService.createDocument({
          filename: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          mimeType: file.mimetype,
          size: file.size
        });

        uploadedDocs.push({
          documentId: docId,
          filename: file.originalname,
          status: 'processing'
        });

        // Process each document asynchronously
        setImmediate(async () => {
          try {
            storageService.updateDocumentStatus(docId, 'processing');
            const extractedData = await ocrService.extractText(file.path, file.mimetype);
            storageService.updateDocumentText(docId, extractedData);
            
            // Auto-index
            if (extractedData.text && extractedData.text.trim().length >= 50) {
              const cleanedText = preprocessText(extractedData.text);
              const chunks = chunkText(cleanedText);
              if (chunks.length > 0) {
                const chunkIds = vectorStore.storeChunks(docId, chunks);
                const embeddings = await embeddingService.generateBatchEmbeddings(chunks);
                vectorStore.storeEmbeddings(chunkIds, embeddings);
              }
            }
            
            logger.success(`Batch document ${docId} processed and indexed`);
          } catch (error) {
            logger.error(`Batch processing failed for ${docId}`, error);
            storageService.markDocumentFailed(docId, error.message);
          }
        });
      } catch (error) {
        logger.error(`Failed to process file ${file.originalname}`, error);
      }
    }

    res.status(202).json({
      success: true,
      message: `${uploadedDocs.length} documents uploaded and processing`,
      data: uploadedDocs
    });

  } catch (error) {
    logger.error('Batch upload error', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
