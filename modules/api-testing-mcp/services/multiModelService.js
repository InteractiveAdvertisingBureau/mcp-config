import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { modelConfig } from "../config/config.js";

/**
 * Unified multi-model service that supports OpenAI and Gemini
 */
class MultiModelService {
  constructor() {
    // Initialize OpenAI if configured
    if (modelConfig.openai.enabled) {
      this.openai = new OpenAI({ apiKey: modelConfig.openai.apiKey });
    }

    // Initialize Gemini if configured
    if (modelConfig.gemini.enabled) {
      this.gemini = new GoogleGenerativeAI(modelConfig.gemini.apiKey);
    }
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    const models = [];

    if (modelConfig.openai.enabled) {
      models.push({
        provider: 'openai',
        name: 'OpenAI',
        model: modelConfig.openai.model,
        displayName: `OpenAI ${modelConfig.openai.model}`
      });
    }

    if (modelConfig.gemini.enabled) {
      models.push({
        provider: 'gemini',
        name: 'Google Gemini',
        model: modelConfig.gemini.model,
        displayName: `Google ${modelConfig.gemini.model}`
      });
    }

    return models;
  }

  /**
   * Generate chat completion with specified provider
   * @param {string} provider - 'openai' or 'gemini' or 'default'
   * @param {string} prompt - The prompt to send
   * @param {object} options - Additional options (temperature, maxTokens, jsonMode)
   */
  async generateCompletion(provider = 'default', prompt, options = {}) {
    console.error(`🔄 generateCompletion called - provider parameter: ${provider}`);

    // Resolve default provider
    if (provider === 'default') {
      provider = modelConfig.defaults.analysis;
      console.error(`⚙️  Resolved 'default' to: ${provider}`);
    }

    // Validate provider is enabled
    if (!modelConfig[provider]?.enabled) {
      throw new Error(`Provider "${provider}" is not configured or enabled. Please check your .env file.`);
    }

    const {
      temperature = 0.7,
      maxTokens = 2000,
      jsonMode = false
    } = options;

    console.error(`✅ Routing to provider: ${provider}`);

    // Route to appropriate provider
    if (provider === 'openai') {
      return await this._generateOpenAI(prompt, { temperature, maxTokens, jsonMode });
    } else if (provider === 'gemini') {
      return await this._generateGemini(prompt, { temperature, maxTokens, jsonMode });
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Generate completion using OpenAI
   */
  async _generateOpenAI(prompt, options) {
    const { temperature, maxTokens, jsonMode } = options;

    const requestOptions = {
      model: modelConfig.openai.model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens
    };

    if (jsonMode) {
      requestOptions.response_format = { type: "json_object" };
    }

    try {
      const response = await this.openai.chat.completions.create(requestOptions);

      return {
        provider: 'openai',
        model: modelConfig.openai.model,
        content: response.choices[0].message.content,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        }
      };
    } catch (error) {
      // Handle context length errors with user-friendly messages
      if (error.message && error.message.includes('maximum context length')) {
        const match = error.message.match(/maximum context length is (\d+) tokens/);
        const maxTokens = match ? match[1] : 'unknown';
        const usedMatch = error.message.match(/resulted in (\d+) tokens/);
        const usedTokens = usedMatch ? usedMatch[1] : 'unknown';

        throw new Error(`Context limit exceeded: This request uses ${usedTokens} tokens, but the model's maximum is ${maxTokens} tokens. Please reduce the size of your input or conversation history.`);
      }

      // Handle rate limit errors
      if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
        throw new Error('Rate limit exceeded: Too many requests. Please try again in a moment.');
      }

      // Handle API key errors
      if (error.status === 401 || (error.message && error.message.includes('Incorrect API key'))) {
        throw new Error('Authentication failed: Invalid or missing API key. Please check your configuration.');
      }

      // Re-throw other errors with context
      throw new Error(`OpenAI API error: ${error.message || 'Unknown error occurred'}`);
    }
  }

  /**
   * Generate completion using Gemini
   */
  async _generateGemini(prompt, options) {
    const { temperature, maxTokens, jsonMode } = options;

    const model = this.gemini.getGenerativeModel({
      model: modelConfig.gemini.model,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(jsonMode && { responseMimeType: "application/json" })
      }
    });

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return {
        provider: 'gemini',
        model: modelConfig.gemini.model,
        content: text,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (error) {
      // Handle context length errors
      if (error.message && (error.message.includes('context length') || error.message.includes('token limit'))) {
        throw new Error('Context limit exceeded: The input is too large for the model. Please reduce the size of your input or conversation history.');
      }

      // Handle rate limit errors
      if (error.status === 429 || (error.message && error.message.includes('quota'))) {
        throw new Error('Rate limit exceeded: Too many requests or quota exhausted. Please try again later.');
      }

      // Handle API key errors
      if (error.status === 401 || error.status === 403 || (error.message && error.message.includes('API key'))) {
        throw new Error('Authentication failed: Invalid or missing API key. Please check your configuration.');
      }

      // Re-throw other errors with context
      throw new Error(`Gemini API error: ${error.message || 'Unknown error occurred'}`);
    }
  }

  /**
   * Chat-specific method (uses default chat model)
   */
  async chat(prompt, options = {}) {
    const provider = options.provider || modelConfig.defaults.chat;
    return await this.generateCompletion(provider, prompt, options);
  }

  /**
   * Analysis-specific method (uses default analysis model)
   */
  async analyze(prompt, options = {}) {
    const provider = options.provider || modelConfig.defaults.analysis;
    console.error(`🤖 MultiModelService.analyze - Using provider: ${provider} (received: ${options.provider || 'not specified'})`);
    return await this.generateCompletion(provider, prompt, { ...options, jsonMode: true });
  }
}

// Export singleton instance
export const multiModelService = new MultiModelService();

// Export class for testing
export { MultiModelService };
