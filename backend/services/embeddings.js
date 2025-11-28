const { pipeline } = require('@xenova/transformers');
const logger = require('../utils/logger');

class EmbeddingService {
  constructor() {
    this.model = null;
    this.isInitialized = false;
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
    this.dimension = 384;
  }

  /**
   * Initialize the embedding model
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info(`Loading embedding model: ${this.modelName}...`);
      logger.info('This may take a minute on first run (downloading model)...');

      this.model = await pipeline(
        'feature-extraction',
        this.modelName
      );

      this.isInitialized = true;
      logger.success('Embedding model loaded successfully');
    } catch (error) {
      logger.error('Failed to initialize embedding model', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });

      // Convert to array
      const embedding = Array.from(output.data);
      
      logger.debug(`Generated embedding: ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateBatchEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info(`Generating embeddings for ${texts.length} chunks...`);

    const embeddings = [];
    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.generateEmbedding(texts[i]);
        embeddings.push(embedding);

        if ((i + 1) % 10 === 0) {
          logger.debug(`Progress: ${i + 1}/${texts.length} embeddings generated`);
        }
      } catch (error) {
        logger.error(`Failed to generate embedding for chunk ${i}`, error);
        // Add null for failed embeddings
        embeddings.push(null);
      }
    }

    const successCount = embeddings.filter(e => e !== null).length;
    logger.success(`Generated ${successCount}/${texts.length} embeddings successfully`);

    return embeddings;
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      name: this.modelName,
      dimension: this.dimension,
      initialized: this.isInitialized
    };
  }
}

// Export singleton instance
module.exports = new EmbeddingService();
