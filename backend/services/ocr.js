const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Import pdf-parse - handle both CommonJS and ES module exports
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  // Handle if it's exported as { default: function }
  if (pdfParse.default) {
    pdfParse = pdfParse.default;
  }
} catch (error) {
  logger.error('Failed to load pdf-parse', error);
}

class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Tesseract OCR worker...');
      
      this.worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (process.env.ENABLE_DEBUG === 'true') {
            logger.debug(`Tesseract: ${m.status} ${m.progress ? (m.progress * 100).toFixed(0) + '%' : ''}`);
          }
        }
      });
      
      this.isInitialized = true;
      logger.success('Tesseract OCR worker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Tesseract worker', error);
      throw error;
    }
  }

  async preprocessImage(filepath) {
    try {
      logger.info(`Preprocessing image: ${filepath}`);
      
      const processedPath = filepath.replace(/\.(jpg|jpeg|png)$/i, '_processed.png');
      
      await sharp(filepath)
        .resize(3000, 3000, {
          fit: 'inside',
          withoutEnlargement: false
        })
        .grayscale()
        .normalize()
        .sharpen()
        .threshold(128)
        .toFormat('png')
        .toFile(processedPath);
      
      logger.success('Image preprocessed successfully');
      return processedPath;
    } catch (error) {
      logger.error('Image preprocessing failed, using original', error);
      return filepath;
    }
  }

  async extractFromTextFile(filepath) {
    try {
      logger.info(`Reading plain text file: ${filepath}`);
      const text = fs.readFileSync(filepath, 'utf8');
      
      if (text && text.trim().length > 0) {
        logger.success(`Text file read successfully: ${text.length} characters`);
        return {
          text: text.trim(),
          method: 'direct',
          confidence: 100
        };
      } else {
        throw new Error('Text file is empty');
      }
    } catch (error) {
      logger.error('Failed to read text file', error);
      throw error;
    }
  }

  async extractFromPDF(filepath) {
    try {
      logger.info(`Attempting native PDF text extraction: ${filepath}`);
      
      // Check if pdfParse is available
      if (!pdfParse || typeof pdfParse !== 'function') {
        throw new Error('pdf-parse library not properly loaded');
      }
      
      const dataBuffer = fs.readFileSync(filepath);
      
      // Call pdf-parse
      const data = await pdfParse(dataBuffer, {
        max: 0  // Parse all pages
      });
      
      if (data && data.text && data.text.trim().length > 50) {
        logger.success(`PDF extraction: ${data.text.length} chars from ${data.numpages} pages`);
        return {
          text: data.text.trim(),
          method: 'native-pdf',
          pages: data.numpages,
          confidence: 100
        };
      } else {
        logger.warn('PDF has minimal extractable text');
        return {
          text: data?.text?.trim() || '[Empty PDF]',
          method: 'pdf-metadata',
          pages: data?.numpages || 0,
          confidence: 30
        };
      }
    } catch (error) {
      logger.error('PDF extraction failed', error);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  async extractFromImage(filepath) {
    let processedPath = null;
    
    try {
      logger.info(`Starting OCR extraction: ${filepath}`);
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      processedPath = await this.preprocessImage(filepath);
      
      logger.info('Running Tesseract OCR...');
      const { data } = await this.worker.recognize(processedPath);
      
      const text = data.text.trim();
      const confidence = data.confidence || 0;
      
      if (text.length < 10) {
        throw new Error('OCR extracted very little text');
      }
      
      logger.success(`OCR: ${text.length} chars, ${confidence.toFixed(1)}% confidence`);
      
      if (processedPath && processedPath !== filepath && fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }
      
      return {
        text: text,
        method: 'ocr',
        confidence: confidence
      };
    } catch (error) {
      logger.error('OCR extraction failed', error);
      
      if (processedPath && processedPath !== filepath && fs.existsSync(processedPath)) {
        try { fs.unlinkSync(processedPath); } catch (e) {}
      }
      
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  async extractText(filepath, mimeType) {
    try {
      logger.info(`Processing: ${filepath} (${mimeType})`);

      if (mimeType === 'text/plain') {
        return await this.extractFromTextFile(filepath);
      }

      if (mimeType === 'application/pdf') {
        return await this.extractFromPDF(filepath);
      }

      if (mimeType.startsWith('image/')) {
        return await this.extractFromImage(filepath);
      }

      throw new Error(`Unsupported file type: ${mimeType}`);

    } catch (error) {
      logger.error('Text extraction failed', error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  async terminate() {
    if (this.worker) {
      logger.info('Terminating Tesseract worker...');
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      logger.success('Tesseract worker terminated');
    }
  }
}

module.exports = new OCRService();
