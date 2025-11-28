const axios = require('axios');
const logger = require('../utils/logger');

class LLMService {
  constructor() {
    // Groq API configuration
    this.apiKey = process.env.GROQ_API_KEY;
    this.model = 'llama-3.1-8b-instant'; // Fast and free
    this.baseURL = 'https://api.groq.com/openai/v1';
  }

  /**
   * Check if Groq API is available
   */
  async checkAvailability() {
    if (!this.apiKey) {
      logger.error('GROQ_API_KEY not set in environment variables');
      return false;
    }
    return true;
  }

  /**
   * Generate response using Groq API
   */
  async generate(prompt, options = {}) {
    const {
      system = 'You are a helpful AI assistant.',
      temperature = 0.7,
      maxTokens = 500
    } = options;

    try {
      logger.info(`Generating response with Groq (${this.model})`);

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const result = response.data.choices[0].message.content;
      const usage = response.data.usage;

      logger.success('Groq response generated');
      logger.debug(`Tokens: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`);

      return {
        text: result,
        model: this.model,
        tokensGenerated: usage.completion_tokens,
        timeMs: null
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Groq API key. Please check your GROQ_API_KEY in .env file');
      }
      if (error.response?.status === 429) {
        throw new Error('Groq API rate limit exceeded. Please try again later.');
      }
      logger.error('Failed to generate Groq response', error);
      throw new Error(`Groq API error: ${error.message}`);
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
    return [
      { name: 'llama-3.1-8b-instant' },
      { name: 'llama-3.1-70b-versatile' },
      { name: 'mixtral-8x7b-32768' }
    ];
  }
}

module.exports = new LLMService();
