const axios = require('axios');
const logger = require('../utils/logger');

class LLMService {
  constructor() {
    this.baseURL = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'phi3:mini';
    this.timeout = 120000; // 2 minutes
  }

  /**
   * Check if Ollama is available
   */
  async checkAvailability() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate response using Ollama
   */
  async generate(prompt, options = {}) {
    const {
      model = this.defaultModel,
      system = null,
      temperature = 0.7,
      maxTokens = 500
    } = options;

    try {
      logger.info(`Generating response with model: ${model}`);

      const payload = {
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: temperature,
          num_predict: maxTokens
        }
      };

      if (system) {
        payload.system = system;
      }

      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        payload,
        { timeout: this.timeout }
      );

      logger.success('LLM response generated');
      return {
        text: response.data.response,
        model: response.data.model,
        tokensGenerated: response.data.eval_count || null,
        timeMs: response.data.total_duration ? Math.round(response.data.total_duration / 1000000) : null
      };
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama is not running. Please start Ollama first: ollama serve');
      }
      logger.error('Failed to generate LLM response', error);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  /**
   * Generate RAG response with context
   */
  async generateRAGResponse(query, context, options = {}) {
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided context from documents. 
Always cite which document your information comes from.
If the answer is not in the context, say so clearly.
Be concise and accurate.`;

    const prompt = `Context from documents:
${context}

User question: ${query}

Please provide a clear and accurate answer based on the context above:`;

    return await this.generate(prompt, {
      ...options,
      system: systemPrompt,
      temperature: 0.3  // Lower temperature for more focused answers
    });
  }

  /**
   * Get available models
   */
  async listModels() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      logger.error('Failed to list models', error);
      return [];
    }
  }
}

module.exports = new LLMService();
