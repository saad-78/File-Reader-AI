const logger = require('./logger');

/**
 * Advanced text chunking with semantic awareness
 */
function chunkText(text, options = {}) {
  const {
    chunkSize = 500,        // Increased from 400
    overlap = 100,          // Increased overlap from 50
    minChunkSize = 50       // More reasonable minimum
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Split into paragraphs first (better semantic boundaries)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  const chunks = [];
  let currentChunk = [];
  let currentWords = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/);
    const wordCount = words.length;

    // If adding this paragraph exceeds chunk size
    if (currentWords + wordCount > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      const chunkText = currentChunk.join('\n\n').trim();
      if (chunkText.split(/\s+/).length >= minChunkSize) {
        chunks.push(chunkText);
      }

      // Create overlap: keep last paragraph(s) that fit in overlap size
      const overlapWords = [];
      let overlapCount = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const parWords = currentChunk[i].split(/\s+/).length;
        if (overlapCount + parWords <= overlap) {
          overlapWords.unshift(currentChunk[i]);
          overlapCount += parWords;
        } else {
          break;
        }
      }
      
      currentChunk = overlapWords;
      currentWords = overlapCount;
    }

    currentChunk.push(paragraph);
    currentWords += wordCount;
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join('\n\n').trim();
    if (chunkText.split(/\s+/).length >= minChunkSize) {
      chunks.push(chunkText);
    }
  }

  // If text is small, just return it as one chunk
  if (chunks.length === 0 && text.split(/\s+/).length >= minChunkSize) {
    chunks.push(text);
  }

  logger.debug(`Chunked text into ${chunks.length} segments (size: ${chunkSize}, overlap: ${overlap})`);
  return chunks;
}

/**
 * Get word count for text
 */
function getWordCount(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Preprocess text for better indexing
 */
function preprocessText(text) {
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ');
  
  // Normalize line breaks
  text = text.replace(/\r\n/g, '\n');
  
  // Remove multiple consecutive newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}

module.exports = {
  chunkText,
  getWordCount,
  preprocessText
};
