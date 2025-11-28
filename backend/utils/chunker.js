const logger = require('./logger');

/**
 * Split text into semantic chunks
 */
function chunkText(text, options = {}) {
  const {
    chunkSize = 400,        // Target words per chunk
    overlap = 50,           // Overlap words between chunks
    minChunkSize = 20       // Minimum words in a chunk
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split into sentences (basic sentence detection)
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  
  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).filter(w => w.length > 0);
    const sentenceWordCount = sentenceWords.length;

    // If adding this sentence exceeds chunk size and we have content
    if (currentWordCount + sentenceWordCount > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      const chunkText = currentChunk.join(' ').trim();
      if (chunkText.split(/\s+/).length >= minChunkSize) {
        chunks.push(chunkText);
      }

      // Start new chunk with overlap
      const overlapSentences = currentChunk.slice(-2); // Keep last 2 sentences
      currentChunk = overlapSentences;
      currentWordCount = overlapSentences.join(' ').split(/\s+/).length;
    }

    currentChunk.push(sentence.trim());
    currentWordCount += sentenceWordCount;
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join(' ').trim();
    if (chunkText.split(/\s+/).length >= minChunkSize) {
      chunks.push(chunkText);
    }
  }

  logger.debug(`Chunked text into ${chunks.length} segments`);
  return chunks;
}

/**
 * Get word count for text
 */
function getWordCount(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

module.exports = {
  chunkText,
  getWordCount
};
